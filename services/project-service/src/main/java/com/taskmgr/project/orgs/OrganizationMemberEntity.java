package com.taskmgr.project.orgs;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "organization_members")
@IdClass(OrganizationMemberEntity.Pk.class)
public class OrganizationMemberEntity {

  @Id
  @Column(name = "org_id", columnDefinition = "uuid")
  private UUID orgId;

  @Id
  @Column(name = "user_id", columnDefinition = "uuid")
  private UUID userId;

  @Column(nullable = false)
  private String role;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  protected OrganizationMemberEntity() {}

  public OrganizationMemberEntity(UUID orgId, UUID userId, String role, OffsetDateTime createdAt) {
    this.orgId = orgId;
    this.userId = userId;
    this.role = role;
    this.createdAt = createdAt;
  }

  public UUID getOrgId() {
    return orgId;
  }

  public UUID getUserId() {
    return userId;
  }

  public String getRole() {
    return role;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public static class Pk implements Serializable {
    public UUID orgId;
    public UUID userId;

    public Pk() {}

    public Pk(UUID orgId, UUID userId) {
      this.orgId = orgId;
      this.userId = userId;
    }

    @Override
    public int hashCode() {
      return (orgId + ":" + userId).hashCode();
    }

    @Override
    public boolean equals(Object obj) {
      if (this == obj) return true;
      if (!(obj instanceof Pk other)) return false;
      return orgId.equals(other.orgId) && userId.equals(other.userId);
    }
  }
}
