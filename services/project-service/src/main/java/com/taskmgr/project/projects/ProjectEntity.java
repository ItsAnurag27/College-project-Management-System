package com.taskmgr.project.projects;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "projects")
public class ProjectEntity {

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "org_id", nullable = false, columnDefinition = "uuid")
  private UUID orgId;

  @Column(nullable = false)
  private String name;

  @Column
  private String description;

  @Column(name = "created_by_user_id", nullable = false, columnDefinition = "uuid")
  private UUID createdByUserId;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  protected ProjectEntity() {}

  public ProjectEntity(UUID id, UUID orgId, String name, String description, UUID createdByUserId, OffsetDateTime createdAt) {
    this.id = id;
    this.orgId = orgId;
    this.name = name;
    this.description = description;
    this.createdByUserId = createdByUserId;
    this.createdAt = createdAt;
  }

  public UUID getId() {
    return id;
  }

  public UUID getOrgId() {
    return orgId;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public UUID getCreatedByUserId() {
    return createdByUserId;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }
}
