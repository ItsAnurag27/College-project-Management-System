package com.taskmgr.task.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "comments")
public class CommentEntity {

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "task_id", nullable = false, columnDefinition = "uuid")
  private UUID taskId;

  @Column(name = "author_user_id", nullable = false, columnDefinition = "uuid")
  private UUID authorUserId;

  @Column(nullable = false)
  private String body;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  protected CommentEntity() {}

  public CommentEntity(UUID id, UUID taskId, UUID authorUserId, String body, OffsetDateTime createdAt) {
    this.id = id;
    this.taskId = taskId;
    this.authorUserId = authorUserId;
    this.body = body;
    this.createdAt = createdAt;
  }

  public UUID getId() {
    return id;
  }

  public UUID getTaskId() {
    return taskId;
  }

  public UUID getAuthorUserId() {
    return authorUserId;
  }

  public String getBody() {
    return body;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }
}
