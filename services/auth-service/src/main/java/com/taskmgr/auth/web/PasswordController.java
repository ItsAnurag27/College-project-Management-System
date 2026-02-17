package com.taskmgr.auth.web;

import com.taskmgr.auth.otp.EmailOtpService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth/password")
public class PasswordController {

  private final EmailOtpService emailOtpService;

  public PasswordController(EmailOtpService emailOtpService) {
    this.emailOtpService = emailOtpService;
  }

  public record ResetPasswordRequest(
      @Email @NotBlank String email,
      @NotBlank String code,
      @NotBlank String newPassword
  ) {}

  public record ResetPasswordResponse(boolean reset) {}

  @PostMapping("/reset")
  @ResponseStatus(HttpStatus.OK)
  public ResetPasswordResponse reset(@Valid @RequestBody ResetPasswordRequest request) {
    EmailOtpService.PasswordReset res = emailOtpService.resetPassword(request.email(), request.code(), request.newPassword());
    return new ResetPasswordResponse(res.reset());
  }
}
