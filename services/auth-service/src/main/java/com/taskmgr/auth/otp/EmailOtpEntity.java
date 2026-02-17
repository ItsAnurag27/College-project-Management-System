package com.taskmgr.auth.otp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "email_otps")
public class EmailOtpEntity {

  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "user_id", columnDefinition = "uuid")
  private UUID userId;

  @Column(nullable = false)
  private String email;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private OtpPurpose purpose;

  @Column(name = "otp_hash", nullable = false)
  private String otpHash;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  @Column(name = "expires_at", nullable = false)
  private OffsetDateTime expiresAt;

  @Column(name = "consumed_at")
  private OffsetDateTime consumedAt;

  @Column(nullable = false)
  private int attempts;

  @Column(name = "max_attempts", nullable = false)
  private int maxAttempts;

  @Column(name = "request_ip")
  private String requestIp;

  protected EmailOtpEntity() {}

  public EmailOtpEntity(
      UUID id,
      UUID userId,
      String email,
      OtpPurpose purpose,
      String otpHash,
      OffsetDateTime createdAt,
      OffsetDateTime expiresAt,
      int attempts,
      int maxAttempts,
      String requestIp
  ) {
    this.id = id;
    this.userId = userId;
    this.email = email;
    this.purpose = purpose;
    this.otpHash = otpHash;
    this.createdAt = createdAt;
    this.expiresAt = expiresAt;
    this.attempts = attempts;
    this.maxAttempts = maxAttempts;
    this.requestIp = requestIp;
  }

  public UUID getId() {
    return id;
  }

  public UUID getUserId() {
    return userId;
  }

  public String getEmail() {
    return email;
  }

  public OtpPurpose getPurpose() {
    return purpose;
  }

  public String getOtpHash() {
    return otpHash;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getExpiresAt() {
    return expiresAt;
  }

  public OffsetDateTime getConsumedAt() {
    return consumedAt;
  }

  public int getAttempts() {
    return attempts;
  }

  public int getMaxAttempts() {
    return maxAttempts;
  }

  public String getRequestIp() {
    return requestIp;
  }

  public boolean isConsumed() {
    return consumedAt != null;
  }

  public void consume(OffsetDateTime now) {
    this.consumedAt = now;
  }

  public void incrementAttempts() {
    this.attempts += 1;
  }
}
