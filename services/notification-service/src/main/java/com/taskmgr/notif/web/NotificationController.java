package com.taskmgr.notif.web;

import com.taskmgr.notif.model.NotificationEntity;
import com.taskmgr.notif.model.NotificationRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

  private final NotificationRepository notifications;

  public NotificationController(NotificationRepository notifications) {
    this.notifications = notifications;
  }

  public record CreateNotificationRequest(
      @NotBlank String userId,
      @NotBlank String type,
      @NotBlank String message,
      String refType,
      String refId
  ) {}

  public record NotificationView(
      String id,
      String userId,
      String type,
      String message,
      String refType,
      String refId,
      boolean read,
      String createdAt
  ) {}

  private boolean isRoot(String raw) {
    return raw != null && raw.equalsIgnoreCase("true");
  }

  private void forbidIfRoot(String raw) {
    if (isRoot(raw)) {
      throw new WebException(HttpStatus.FORBIDDEN, "Root admin is read-only");
    }
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public NotificationView create(@Valid @RequestBody CreateNotificationRequest request) {
    NotificationEntity n = new NotificationEntity(
        UUID.randomUUID(),
        UUID.fromString(request.userId()),
        request.type(),
        request.message(),
        request.refType(),
        request.refId(),
        false,
        OffsetDateTime.now()
    );

    notifications.save(n);

    return toView(n);
  }

  @GetMapping
  public List<NotificationView> list(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @RequestParam(name = "userId", required = false) String forUserId,
      @RequestParam(name = "unread", required = false) Boolean unread
  ) {
    UUID uid = UUID.fromString(userId);
    if (isRoot(root) && forUserId != null && !forUserId.isBlank()) {
      uid = UUID.fromString(forUserId);
    }
    List<NotificationEntity> rows = (unread != null)
        ? notifications.findByUserIdAndIsReadOrderByCreatedAtDesc(uid, !unread)
        : notifications.findByUserIdOrderByCreatedAtDesc(uid);

    return rows.stream().map(this::toView).toList();
  }

  @PatchMapping("/{id}/read")
  public NotificationView markRead(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String id
  ) {
    forbidIfRoot(root);
    UUID uid = UUID.fromString(userId);
    NotificationEntity n = notifications.findById(UUID.fromString(id))
        .orElseThrow(() -> new WebException(HttpStatus.NOT_FOUND, "Notification not found"));

    if (!n.getUserId().equals(uid)) {
      throw new WebException(HttpStatus.FORBIDDEN, "Not allowed");
    }

    n.markRead();
    notifications.save(n);
    return toView(n);
  }

  private NotificationView toView(NotificationEntity n) {
    return new NotificationView(
        n.getId().toString(),
        n.getUserId().toString(),
        n.getType(),
        n.getMessage(),
        n.getRefType(),
        n.getRefId(),
        n.isRead(),
        n.getCreatedAt().toString()
    );
  }
}
