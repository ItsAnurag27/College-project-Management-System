package com.taskmgr.notif.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications")
public class NotificationEntity {

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
  private UUID userId;

  @Column(nullable = false)
  private String type;

  @Column(nullable = false)
  private String message;

  @Column(name = "ref_type")
  private String refType;

  @Column(name = "ref_id")
  private String refId;

  @Column(name = "is_read", nullable = false)
  private boolean isRead;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  protected NotificationEntity() {}

  public NotificationEntity(UUID id, UUID userId, String type, String message, String refType, String refId, boolean isRead, OffsetDateTime createdAt) {
    this.id = id;
    this.userId = userId;
    this.type = type;
    this.message = message;
    this.refType = refType;
    this.refId = refId;
    this.isRead = isRead;
    this.createdAt = createdAt;
  }

  public UUID getId() {
    return id;
  }

  public UUID getUserId() {
    return userId;
  }

  public String getType() {
    return type;
  }

  public String getMessage() {
    return message;
  }

  public String getRefType() {
    return refType;
  }

  public String getRefId() {
    return refId;
  }

  public boolean isRead() {
    return isRead;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public void markRead() {
    this.isRead = true;
  }
}
