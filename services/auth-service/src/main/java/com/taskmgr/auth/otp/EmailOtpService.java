package com.taskmgr.auth.otp;

import com.taskmgr.auth.jwt.JwtService;
import com.taskmgr.auth.users.UserEntity;
import com.taskmgr.auth.users.UserRepository;
import com.taskmgr.auth.web.WebException;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailOtpService {

  private final EmailOtpRepository otps;
  private final UserRepository users;
  private final JwtService jwtService;
  private final PasswordEncoder passwordEncoder;
  private final ObjectProvider<JavaMailSender> mailSender;
  private final SecureRandom secureRandom = new SecureRandom();

  private final int ttlMinutes;
  private final int maxAttempts;
  private final int rateEmail10Min;
  private final int rateEmailDay;
  private final int rateIp10Min;
  private final String mailFrom;
  private final String otpHashSecret;
  private final String mailHost;

  public EmailOtpService(
      EmailOtpRepository otps,
      UserRepository users,
      JwtService jwtService,
      PasswordEncoder passwordEncoder,
      ObjectProvider<JavaMailSender> mailSender,
      @Value("${app.otp.ttlMinutes:10}") int ttlMinutes,
      @Value("${app.otp.maxAttempts:5}") int maxAttempts,
      @Value("${app.otp.rate.perEmailPer10Min:3}") int rateEmail10Min,
      @Value("${app.otp.rate.perEmailPerDay:10}") int rateEmailDay,
      @Value("${app.otp.rate.perIpPer10Min:15}") int rateIp10Min,
      @Value("${app.mail.from:no-reply@unitify.local}") String mailFrom,
        @Value("${app.jwt.secret:dev_super_secret_change_me}") String otpHashSecret,
        @Value("${spring.mail.host:}") String mailHost
  ) {
    this.otps = otps;
    this.users = users;
    this.jwtService = jwtService;
    this.passwordEncoder = passwordEncoder;
    this.mailSender = mailSender;
    this.ttlMinutes = ttlMinutes;
    this.maxAttempts = maxAttempts;
    this.rateEmail10Min = rateEmail10Min;
    this.rateEmailDay = rateEmailDay;
    this.rateIp10Min = rateIp10Min;
    this.mailFrom = mailFrom;
    this.otpHashSecret = otpHashSecret;
    this.mailHost = mailHost;
  }

  public record OtpRequested(int expiresInSeconds) {}

  public record OtpVerified(boolean verified, String accessToken, String userId) {}

  public record PasswordReset(boolean reset) {}

  public OtpRequested requestOtp(String emailRaw, OtpPurpose purpose, String requestIp) {
    String email = normalizeEmail(emailRaw);
    OffsetDateTime now = OffsetDateTime.now();

    // Rate limiting (email + IP)
    long recentEmail = otps.countRecentByEmailAndPurpose(email, purpose, now.minus(10, ChronoUnit.MINUTES));
    if (recentEmail >= rateEmail10Min) {
      throw new WebException(HttpStatus.TOO_MANY_REQUESTS, "Too many OTP requests. Try again later.");
    }

    long recentDay = otps.countRecentByEmail(email, now.minus(1, ChronoUnit.DAYS));
    if (recentDay >= rateEmailDay) {
      throw new WebException(HttpStatus.TOO_MANY_REQUESTS, "Too many OTP requests today. Try again later.");
    }

    if (requestIp != null && !requestIp.isBlank()) {
      long recentIp = otps.countRecentByIp(requestIp, now.minus(10, ChronoUnit.MINUTES));
      if (recentIp >= rateIp10Min) {
        throw new WebException(HttpStatus.TOO_MANY_REQUESTS, "Too many OTP requests. Try again later.");
      }
    }

    Optional<UserEntity> user = users.findByEmailIgnoreCase(email);

    String code = generateSixDigitCode();
    String hash = hashOtp(email, purpose, code);
    OffsetDateTime expiresAt = now.plus(ttlMinutes, ChronoUnit.MINUTES);

    EmailOtpEntity entity = new EmailOtpEntity(
        UUID.randomUUID(),
        user.map(UserEntity::getId).orElse(null),
        email,
        purpose,
        hash,
        now,
        expiresAt,
        0,
        maxAttempts,
        requestIp
    );
    otps.save(entity);

    sendEmail(email, purpose, code, expiresAt);

    return new OtpRequested((int) ChronoUnit.SECONDS.between(now, expiresAt));
  }

  @Transactional
  public OtpVerified verifyOtp(String emailRaw, OtpPurpose purpose, String codeRaw) {
    String email = normalizeEmail(emailRaw);
    String code = codeRaw == null ? "" : codeRaw.trim();

    OffsetDateTime now = OffsetDateTime.now();
    EmailOtpEntity otp = otps.findLatestValidForUpdate(email, purpose, now, PageRequest.of(0, 1))
        .stream()
        .findFirst()
        .orElseThrow(() -> new WebException(HttpStatus.BAD_REQUEST, "Invalid or expired code"));

    if (otp.getAttempts() >= otp.getMaxAttempts()) {
      otp.consume(now);
      otps.save(otp);
      throw new WebException(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Request a new code.");
    }

    String expectedHash = hashOtp(email, purpose, code);
    if (!constantTimeEquals(otp.getOtpHash(), expectedHash)) {
      otp.incrementAttempts();
      if (otp.getAttempts() >= otp.getMaxAttempts()) {
        otp.consume(now);
      }
      otps.save(otp);
      throw new WebException(HttpStatus.BAD_REQUEST, "Invalid or expired code");
    }

    otp.consume(now);
    otps.save(otp);

    if (purpose == OtpPurpose.VERIFY_EMAIL) {
      UserEntity user = users.findByEmailIgnoreCase(email)
          .orElseThrow(() -> new WebException(HttpStatus.NOT_FOUND, "User not found"));
      user.setEmailVerified(true);
      users.save(user);
      return new OtpVerified(true, null, user.getId().toString());
    }

    if (purpose == OtpPurpose.LOGIN) {
      UserEntity user = users.findByEmailIgnoreCase(email)
          .orElseThrow(() -> new WebException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
      String token = jwtService.issueToken(user.getId(), user.getEmail(), user.getName(), user.isRootAdmin());
      return new OtpVerified(true, token, user.getId().toString());
    }

    if (purpose == OtpPurpose.RESET_PASSWORD) {
      // Purpose handled by /auth/password/reset endpoint.
      return new OtpVerified(true, null, null);
    }

    return new OtpVerified(true, null, null);
  }

  @Transactional
  public PasswordReset resetPassword(String emailRaw, String codeRaw, String newPasswordRaw) {
    String email = normalizeEmail(emailRaw);
    String code = codeRaw == null ? "" : codeRaw.trim();
    String newPassword = newPasswordRaw == null ? "" : newPasswordRaw;

    if (newPassword.isBlank()) {
      throw new WebException(HttpStatus.BAD_REQUEST, "Password is required");
    }

    OffsetDateTime now = OffsetDateTime.now();

    EmailOtpEntity otp = otps.findLatestValidForUpdate(email, OtpPurpose.RESET_PASSWORD, now, PageRequest.of(0, 1))
        .stream()
        .findFirst()
        .orElseThrow(() -> new WebException(HttpStatus.BAD_REQUEST, "Invalid or expired code"));

    if (otp.getAttempts() >= otp.getMaxAttempts()) {
      otp.consume(now);
      otps.save(otp);
      throw new WebException(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Request a new code.");
    }

    String expectedHash = hashOtp(email, OtpPurpose.RESET_PASSWORD, code);
    if (!constantTimeEquals(otp.getOtpHash(), expectedHash)) {
      otp.incrementAttempts();
      if (otp.getAttempts() >= otp.getMaxAttempts()) {
        otp.consume(now);
      }
      otps.save(otp);
      throw new WebException(HttpStatus.BAD_REQUEST, "Invalid or expired code");
    }

    otp.consume(now);
    otps.save(otp);

    UserEntity user = users.findByEmailIgnoreCase(email)
        .orElseThrow(() -> new WebException(HttpStatus.BAD_REQUEST, "Invalid or expired code"));

    user.setPasswordHash(passwordEncoder.encode(newPassword));
    users.save(user);

    return new PasswordReset(true);
  }

  public static String getClientIp(HttpServletRequest request) {
    String forwardedFor = request.getHeader("X-Forwarded-For");
    if (forwardedFor != null && !forwardedFor.isBlank()) {
      // first value is the original client
      String first = forwardedFor.split(",")[0].trim();
      if (!first.isBlank()) return first;
    }
    String realIp = request.getHeader("X-Real-IP");
    if (realIp != null && !realIp.isBlank()) return realIp.trim();
    return request.getRemoteAddr();
  }

  private String normalizeEmail(String email) {
    if (email == null) return "";
    return email.trim().toLowerCase();
  }

  private String generateSixDigitCode() {
    int n = secureRandom.nextInt(1_000_000);
    return String.format("%06d", n);
  }

  private String hashOtp(String email, OtpPurpose purpose, String code) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      String material = email + ":" + purpose.name() + ":" + code + ":" + otpHashSecret;
      byte[] bytes = digest.digest(material.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(bytes);
    } catch (Exception ex) {
      throw new IllegalStateException("Unable to hash OTP", ex);
    }
  }

  private boolean constantTimeEquals(String a, String b) {
    if (a == null || b == null) return false;
    byte[] ab = a.getBytes(StandardCharsets.UTF_8);
    byte[] bb = b.getBytes(StandardCharsets.UTF_8);
    if (ab.length != bb.length) return false;
    int r = 0;
    for (int i = 0; i < ab.length; i++) {
      r |= ab[i] ^ bb[i];
    }
    return r == 0;
  }

  private void sendEmail(String email, OtpPurpose purpose, String code, OffsetDateTime expiresAt) {
    JavaMailSender sender = mailSender.getIfAvailable();
    String subject;
    String body;

    if (purpose == OtpPurpose.VERIFY_EMAIL) {
      subject = "Your Unitify verification code";
      body = "Your verification code is: " + code + "\n\nIt expires at: " + expiresAt + "\n";
    } else if (purpose == OtpPurpose.LOGIN) {
      subject = "Your Unitify login code";
      body = "Your login code is: " + code + "\n\nIt expires at: " + expiresAt + "\n";
    } else {
      subject = "Your Unitify password reset code";
      body = "Your password reset code is: " + code + "\n\nIt expires at: " + expiresAt + "\n";
    }

    if (sender == null || mailHost == null || mailHost.isBlank()) {
      // Dev fallback: avoid failing the request when SMTP isn't configured.
      System.out.println("[OTP] To=" + email + " purpose=" + purpose + " code=" + code + " expiresAt=" + expiresAt);
      return;
    }

    SimpleMailMessage msg = new SimpleMailMessage();
    msg.setFrom(mailFrom);
    msg.setTo(email);
    msg.setSubject(subject);
    msg.setText(body);
    try {
      sender.send(msg);
    } catch (Exception ex) {
      // Don't block OTP flows in dev/staging if SMTP is misconfigured.
      System.out.println("[OTP] Email send failed (falling back to log). To=" + email + " purpose=" + purpose + " code=" + code);
      ex.printStackTrace(System.out);
    }
  }
}
