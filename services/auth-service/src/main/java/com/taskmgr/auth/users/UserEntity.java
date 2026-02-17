package com.taskmgr.auth.users;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserEntity {

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false, unique = true)
  private String email;

  @Column(name = "password_hash", nullable = false)
  private String passwordHash;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  @Column(name = "root_admin", nullable = false)
  private boolean rootAdmin;

  @Column(name = "email_verified", nullable = false)
  private boolean emailVerified;

  protected UserEntity() {}

  public UserEntity(
      UUID id,
      String name,
      String email,
      String passwordHash,
      OffsetDateTime createdAt,
      boolean rootAdmin,
      boolean emailVerified
  ) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.passwordHash = passwordHash;
    this.createdAt = createdAt;
    this.rootAdmin = rootAdmin;
    this.emailVerified = emailVerified;
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public String getEmail() {
    return email;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public void setPasswordHash(String passwordHash) {
    this.passwordHash = passwordHash;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public boolean isRootAdmin() {
    return rootAdmin;
  }

  public boolean isEmailVerified() {
    return emailVerified;
  }

  public void setEmailVerified(boolean emailVerified) {
    this.emailVerified = emailVerified;
  }
}
