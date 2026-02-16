package com.taskmgr.task.web;

import com.taskmgr.task.model.CommentEntity;
import com.taskmgr.task.model.CommentRepository;
import com.taskmgr.task.model.TaskEntity;
import com.taskmgr.task.model.TaskRepository;
import com.taskmgr.task.model.TaskStatus;
import com.taskmgr.task.notifications.NotificationClient;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TaskController {

  private final TaskRepository tasks;
  private final CommentRepository comments;
  private final NotificationClient notifications;

  public TaskController(TaskRepository tasks, CommentRepository comments, NotificationClient notifications) {
    this.tasks = tasks;
    this.comments = comments;
    this.notifications = notifications;
  }

  public record CreateTaskRequest(
      @NotBlank String title,
      String description,
      String status,
      String deadline,
      String assignedToUserId
  ) {}

  public record UpdateTaskRequest(String status, String deadline, String assignedToUserId) {}

  public record TaskView(
      String id,
      String projectId,
      String title,
      String description,
      String status,
      String deadline,
      String assignedToUserId
  ) {}

  public record CreateCommentRequest(@NotBlank String body) {}

  public record CommentView(String id, String taskId, String authorUserId, String body, String createdAt) {}

  private boolean isRoot(String raw) {
    return raw != null && raw.equalsIgnoreCase("true");
  }

  private void forbidIfRoot(String raw) {
    if (isRoot(raw)) {
      throw new WebException(HttpStatus.FORBIDDEN, "Root admin is read-only");
    }
  }

  @PostMapping("/projects/{projectId}/tasks")
  @ResponseStatus(HttpStatus.CREATED)
  public TaskView createTask(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String projectId,
      @Valid @RequestBody CreateTaskRequest request
  ) {
    forbidIfRoot(root);
    UUID uid = UUID.fromString(userId);
    UUID pid = UUID.fromString(projectId);

    TaskStatus status = parseStatus(request.status());
    LocalDate deadline = null;
    if (request.deadline() != null && !request.deadline().isBlank()) {
      try {
        deadline = LocalDate.parse(request.deadline());
      } catch (DateTimeParseException ex) {
        throw new WebException(HttpStatus.BAD_REQUEST, "Invalid deadline (use YYYY-MM-DD)");
      }
    }
    UUID assignee = request.assignedToUserId() == null || request.assignedToUserId().isBlank() ? null : UUID.fromString(request.assignedToUserId());

    TaskEntity task = new TaskEntity(
        UUID.randomUUID(),
        pid,
        request.title(),
        request.description(),
        status,
        deadline,
        assignee,
        uid,
        OffsetDateTime.now()
    );

    tasks.save(task);

    if (assignee != null) {
      notifications.createNotification(
          assignee.toString(),
          "TASK_ASSIGNED",
          "You were assigned a task: " + task.getTitle(),
          "TASK",
          task.getId().toString()
      );
    }

    return toView(task);
  }

  @GetMapping("/projects/{projectId}/tasks")
  public List<TaskView> listTasks(@RequestHeader("X-User-Id") String userId, @PathVariable String projectId) {
    UUID pid = UUID.fromString(projectId);
    return tasks.findByProjectIdOrderByCreatedAtDesc(pid).stream().map(this::toView).toList();
  }

  @GetMapping("/tasks")
  public List<TaskView> listTasksByAssignee(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @RequestParam(name = "assignedToUserId", required = false) String assignedToUserId
  ) {
    if (assignedToUserId == null || assignedToUserId.isBlank()) {
      throw new WebException(HttpStatus.BAD_REQUEST, "assignedToUserId is required");
    }

    UUID requesterId = UUID.fromString(userId);
    UUID targetAssignee = UUID.fromString(assignedToUserId);
    if (!isRoot(root) && !requesterId.equals(targetAssignee)) {
      throw new WebException(HttpStatus.FORBIDDEN, "Forbidden");
    }

    return tasks.findByAssignedToUserIdOrderByCreatedAtDesc(targetAssignee)
        .stream()
        .map(this::toView)
        .toList();
  }

  @PatchMapping("/tasks/{taskId}")
  public TaskView updateTask(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String taskId,
      @RequestBody UpdateTaskRequest request
  ) {
    forbidIfRoot(root);
    TaskEntity task = tasks.findById(UUID.fromString(taskId))
        .orElseThrow(() -> new WebException(HttpStatus.NOT_FOUND, "Task not found"));

    UUID previousAssignee = task.getAssignedToUserId();

    if (request.status() != null && !request.status().isBlank()) {
      task.setStatus(parseStatus(request.status()));
    }

    if (request.deadline() != null) {
      if (request.deadline().isBlank()) {
        task.setDeadline(null);
      } else {
        try {
          task.setDeadline(LocalDate.parse(request.deadline()));
        } catch (DateTimeParseException ex) {
          throw new WebException(HttpStatus.BAD_REQUEST, "Invalid deadline (use YYYY-MM-DD)");
        }
      }
    }

    if (request.assignedToUserId() != null) {
      task.setAssignedToUserId(request.assignedToUserId().isBlank() ? null : UUID.fromString(request.assignedToUserId()));
    }

    tasks.save(task);

    UUID newAssignee = task.getAssignedToUserId();
    if (newAssignee != null && (previousAssignee == null || !newAssignee.equals(previousAssignee))) {
      notifications.createNotification(
          newAssignee.toString(),
          "TASK_ASSIGNED",
          "You were assigned a task: " + task.getTitle(),
          "TASK",
          task.getId().toString()
      );
    }

    return toView(task);
  }

  @PostMapping("/tasks/{taskId}/comments")
  @ResponseStatus(HttpStatus.CREATED)
  public CommentView addComment(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String taskId,
      @Valid @RequestBody CreateCommentRequest request
  ) {
    forbidIfRoot(root);
    UUID uid = UUID.fromString(userId);
    TaskEntity task = tasks.findById(UUID.fromString(taskId))
        .orElseThrow(() -> new WebException(HttpStatus.NOT_FOUND, "Task not found"));

    CommentEntity c = new CommentEntity(UUID.randomUUID(), task.getId(), uid, request.body(), OffsetDateTime.now());
    comments.save(c);

    UUID assignee = task.getAssignedToUserId();
    if (assignee != null && !assignee.equals(uid)) {
      notifications.createNotification(
          assignee.toString(),
          "TASK_COMMENT",
          "New comment on task: " + task.getTitle(),
          "TASK",
          task.getId().toString()
      );
    }

    return new CommentView(c.getId().toString(), c.getTaskId().toString(), c.getAuthorUserId().toString(), c.getBody(), c.getCreatedAt().toString());
  }

  @GetMapping("/tasks/{taskId}/comments")
  public List<CommentView> listComments(@RequestHeader("X-User-Id") String userId, @PathVariable String taskId) {
    UUID tid = UUID.fromString(taskId);
    return comments.findByTaskIdOrderByCreatedAtAsc(tid)
        .stream()
        .map(c -> new CommentView(c.getId().toString(), c.getTaskId().toString(), c.getAuthorUserId().toString(), c.getBody(), c.getCreatedAt().toString()))
        .toList();
  }

  @DeleteMapping("/tasks/{taskId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteTask(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String taskId
  ) {
    forbidIfRoot(root);
    UUID tid = UUID.fromString(taskId);
    TaskEntity task = tasks.findById(tid)
        .orElseThrow(() -> new WebException(HttpStatus.NOT_FOUND, "Task not found"));

    comments.deleteByTaskId(task.getId());
    tasks.delete(task);
  }

  @DeleteMapping("/projects/{projectId}/tasks")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteTasksForProject(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String projectId
  ) {
    forbidIfRoot(root);
    UUID pid = UUID.fromString(projectId);
    List<TaskEntity> projectTasks = tasks.findByProjectIdOrderByCreatedAtDesc(pid);
    for (TaskEntity t : projectTasks) {
      comments.deleteByTaskId(t.getId());
      tasks.delete(t);
    }
  }

  @DeleteMapping("/tasks/{taskId}/comments/{commentId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteComment(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String taskId,
      @PathVariable String commentId
  ) {
    forbidIfRoot(root);
    UUID tid = UUID.fromString(taskId);
    UUID cid = UUID.fromString(commentId);

    CommentEntity c = comments.findById(cid)
        .orElseThrow(() -> new WebException(HttpStatus.NOT_FOUND, "Comment not found"));

    if (!tid.equals(c.getTaskId())) {
      throw new WebException(HttpStatus.NOT_FOUND, "Comment not found");
    }

    comments.delete(c);
  }

  private TaskView toView(TaskEntity task) {
    return new TaskView(
        task.getId().toString(),
        task.getProjectId().toString(),
        task.getTitle(),
        task.getDescription(),
        task.getStatus().name(),
        task.getDeadline() == null ? null : task.getDeadline().toString(),
        task.getAssignedToUserId() == null ? null : task.getAssignedToUserId().toString()
    );
  }

  private TaskStatus parseStatus(String raw) {
    if (raw == null || raw.isBlank()) {
      return TaskStatus.TODO;
    }

    return switch (raw.trim().toUpperCase()) {
      case "TODO", "TO_DO" -> TaskStatus.TODO;
      case "IN_PROGRESS", "INPROGRESS" -> TaskStatus.IN_PROGRESS;
      case "DONE" -> TaskStatus.DONE;
      default -> throw new WebException(HttpStatus.BAD_REQUEST, "Invalid status: " + raw);
    };
  }
}
