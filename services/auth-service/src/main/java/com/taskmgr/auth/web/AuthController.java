package com.taskmgr.auth.web;

import com.taskmgr.auth.jwt.JwtService;
import com.taskmgr.auth.users.UserEntity;
import com.taskmgr.auth.users.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

  private final UserRepository users;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;
  private final String rootAdminKey;

  public AuthController(
      UserRepository users,
      PasswordEncoder passwordEncoder,
      JwtService jwtService,
      @Value("${app.rootAdmin.key:}") String rootAdminKey
  ) {
    this.users = users;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
    this.rootAdminKey = rootAdminKey;
  }

  public record RegisterRequest(
      @NotBlank String name,
      @Email @NotBlank String email,
      @NotBlank String password,
      String rootAdminKey
  ) {}

  public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}

  public record AuthResponse(String accessToken, UserView user) {}

  public record UserView(String id, String name, String email, boolean rootAdmin) {}

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
    Optional<UserEntity> existing = users.findByEmailIgnoreCase(request.email());
    if (existing.isPresent()) {
      throw new WebException(HttpStatus.CONFLICT, "Email already registered");
    }

    boolean wantsRoot = request.rootAdminKey() != null && !request.rootAdminKey().isBlank();
    boolean isRoot = false;
    if (wantsRoot) {
      if (rootAdminKey == null || rootAdminKey.isBlank() || !rootAdminKey.equals(request.rootAdminKey())) {
        throw new WebException(HttpStatus.FORBIDDEN, "Invalid root admin key");
      }
      if (users.countByRootAdminTrue() > 0) {
        throw new WebException(HttpStatus.CONFLICT, "Root admin already exists");
      }
      isRoot = true;
    }

    UUID id = UUID.randomUUID();
    String hash = passwordEncoder.encode(request.password());
    UserEntity user = new UserEntity(id, request.name(), request.email().toLowerCase(), hash, OffsetDateTime.now(), isRoot);
    users.save(user);

    String token = jwtService.issueToken(user.getId(), user.getEmail(), user.getName(), user.isRootAdmin());
    return new AuthResponse(token, new UserView(user.getId().toString(), user.getName(), user.getEmail(), user.isRootAdmin()));
  }

  @PostMapping("/login")
  public AuthResponse login(@Valid @RequestBody LoginRequest request) {
    UserEntity user = users.findByEmailIgnoreCase(request.email())
        .orElseThrow(() -> new WebException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

    if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
      throw new WebException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
    }

    String token = jwtService.issueToken(user.getId(), user.getEmail(), user.getName(), user.isRootAdmin());
    return new AuthResponse(token, new UserView(user.getId().toString(), user.getName(), user.getEmail(), user.isRootAdmin()));
  }

  @GetMapping("/me")
  public UserView me(@RequestHeader(name = "X-User-Id", required = false) String userId) {
    if (userId == null || userId.isBlank()) {
      throw new WebException(HttpStatus.UNAUTHORIZED, "Missing user context");
    }

    UserEntity user = users.findById(UUID.fromString(userId))
        .orElseThrow(() -> new WebException(HttpStatus.NOT_FOUND, "User not found"));

    return new UserView(user.getId().toString(), user.getName(), user.getEmail(), user.isRootAdmin());
  }

  @GetMapping("/users/lookup")
  public UserView lookupByEmail(
      @RequestHeader(name = "X-User-Id", required = false) String requesterUserId,
      @RequestParam("email") @NotNull @Email String email
  ) {
    if (requesterUserId == null || requesterUserId.isBlank()) {
      throw new WebException(HttpStatus.UNAUTHORIZED, "Missing user context");
    }

    UserEntity user = users.findByEmailIgnoreCase(email)
        .orElseThrow(() -> new WebException(HttpStatus.NOT_FOUND, "User not found"));

    return new UserView(user.getId().toString(), user.getName(), user.getEmail(), user.isRootAdmin());
  }

  @GetMapping("/users/{userId}")
  public UserView getUserById(
      @RequestHeader(name = "X-User-Id", required = false) String requesterUserId,
      @PathVariable String userId
  ) {
    if (requesterUserId == null || requesterUserId.isBlank()) {
      throw new WebException(HttpStatus.UNAUTHORIZED, "Missing user context");
    }

    UserEntity user = users.findById(UUID.fromString(userId))
        .orElseThrow(() -> new WebException(HttpStatus.NOT_FOUND, "User not found"));

    return new UserView(user.getId().toString(), user.getName(), user.getEmail(), user.isRootAdmin());
  }
}
