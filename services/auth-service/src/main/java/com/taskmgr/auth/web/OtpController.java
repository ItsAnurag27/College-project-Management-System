package com.taskmgr.auth.web;

import com.taskmgr.auth.otp.EmailOtpService;
import com.taskmgr.auth.otp.OtpPurpose;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth/otp")
public class OtpController {

  private final EmailOtpService emailOtpService;

  public OtpController(EmailOtpService emailOtpService) {
    this.emailOtpService = emailOtpService;
  }

  public record RequestOtpRequest(
      @NotNull OtpPurpose purpose,
      @Email @NotBlank String email
  ) {}

  public record RequestOtpResponse(int expiresInSeconds) {}

  public record VerifyOtpRequest(
      @NotNull OtpPurpose purpose,
      @Email @NotBlank String email,
      @NotBlank String code
  ) {}

  public record VerifyOtpResponse(boolean verified, String accessToken, String userId) {}

  @PostMapping("/request")
  @ResponseStatus(HttpStatus.OK)
  public RequestOtpResponse request(@Valid @RequestBody RequestOtpRequest request, HttpServletRequest http) {
    String ip = EmailOtpService.getClientIp(http);
    EmailOtpService.OtpRequested res = emailOtpService.requestOtp(request.email(), request.purpose(), ip);
    return new RequestOtpResponse(res.expiresInSeconds());
  }

  @PostMapping("/verify")
  @ResponseStatus(HttpStatus.OK)
  public VerifyOtpResponse verify(@Valid @RequestBody VerifyOtpRequest request) {
    EmailOtpService.OtpVerified res = emailOtpService.verifyOtp(request.email(), request.purpose(), request.code());
    return new VerifyOtpResponse(res.verified(), res.accessToken(), res.userId());
  }
}
