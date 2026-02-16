package com.taskmgr.auth.jwt;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

  private final Algorithm algorithm;

  public JwtService(@Value("${app.jwt.secret}") String secret) {
    this.algorithm = Algorithm.HMAC256(secret);
  }

  public String issueToken(UUID userId, String email, String name, boolean rootAdmin) {
    Instant now = Instant.now();
    Instant exp = now.plusSeconds(60L * 60L); // 1 hour

    return JWT.create()
        .withSubject(userId.toString())
        .withIssuedAt(now)
        .withExpiresAt(exp)
        .withClaim("email", email)
        .withClaim("name", name)
        .withClaim("root", rootAdmin)
        .sign(algorithm);
  }
}
