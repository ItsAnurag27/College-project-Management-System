package com.taskmgr.task.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "tasks")
public class TaskEntity {

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "project_id", nullable = false, columnDefinition = "uuid")
  private UUID projectId;

  @Column(nullable = false)
  private String title;

  @Column
  private String description;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private TaskStatus status;

  @Column
  private LocalDate deadline;

  @Column(name = "assigned_to_user_id", columnDefinition = "uuid")
  private UUID assignedToUserId;

  @Column(name = "created_by_user_id", nullable = false, columnDefinition = "uuid")
  private UUID createdByUserId;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  protected TaskEntity() {}

  public TaskEntity(UUID id, UUID projectId, String title, String description, TaskStatus status, LocalDate deadline, UUID assignedToUserId, UUID createdByUserId, OffsetDateTime createdAt) {
    this.id = id;
    this.projectId = projectId;
    this.title = title;
    this.description = description;
    this.status = status;
    this.deadline = deadline;
    this.assignedToUserId = assignedToUserId;
    this.createdByUserId = createdByUserId;
    this.createdAt = createdAt;
  }

  public UUID getId() {
    return id;
  }

  public UUID getProjectId() {
    return projectId;
  }

  public String getTitle() {
    return title;
  }

  public String getDescription() {
    return description;
  }

  public TaskStatus getStatus() {
    return status;
  }

  public LocalDate getDeadline() {
    return deadline;
  }

  public UUID getAssignedToUserId() {
    return assignedToUserId;
  }

  public UUID getCreatedByUserId() {
    return createdByUserId;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public void setStatus(TaskStatus status) {
    this.status = status;
  }

  public void setDeadline(LocalDate deadline) {
    this.deadline = deadline;
  }

  public void setAssignedToUserId(UUID assignedToUserId) {
    this.assignedToUserId = assignedToUserId;
  }
}
