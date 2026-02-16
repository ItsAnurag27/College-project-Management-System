package com.taskmgr.project.orgs;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "organizations")
public class OrganizationEntity {

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(nullable = false)
  private String name;

  @Column(name = "created_by_user_id", nullable = false, columnDefinition = "uuid")
  private UUID createdByUserId;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  protected OrganizationEntity() {}

  public OrganizationEntity(UUID id, String name, UUID createdByUserId, OffsetDateTime createdAt) {
    this.id = id;
    this.name = name;
    this.createdByUserId = createdByUserId;
    this.createdAt = createdAt;
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public UUID getCreatedByUserId() {
    return createdByUserId;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }
}
