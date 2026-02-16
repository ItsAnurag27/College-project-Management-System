package com.taskmgr.gateway.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class JwtUserForwardingFilter implements GlobalFilter, Ordered {

  private final Algorithm algorithm;

  public JwtUserForwardingFilter(@Value("${app.jwt.secret}") String secret) {
    this.algorithm = Algorithm.HMAC256(secret);
  }

  @Override
  public int getOrder() {
    return -100;
  }

  @Override
  public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
    String path = exchange.getRequest().getURI().getPath();

    if ("OPTIONS".equalsIgnoreCase(exchange.getRequest().getMethod().name())) {
      return chain.filter(exchange);
    }

    if (path.equals("/auth/login") || path.equals("/auth/register")) {
      return chain.filter(exchange);
    }

    if (path.startsWith("/actuator/")) {
      return chain.filter(exchange);
    }

    String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
      exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
      return exchange.getResponse().setComplete();
    }

    String token = authHeader.substring("Bearer ".length()).trim();

    try {
      DecodedJWT jwt = JWT.require(algorithm).build().verify(token);
      String userId = jwt.getSubject();
      String email = jwt.getClaim("email").asString();
        Boolean root = jwt.getClaim("root").asBoolean();

      ServerWebExchange mutated = exchange.mutate()
          .request(builder -> builder
              .header("X-User-Id", userId == null ? "" : userId)
              .header("X-User-Email", email == null ? "" : email)
            .header("X-User-Root", (root != null && root) ? "true" : "false")
          )
          .build();

      return chain.filter(mutated);
    } catch (JWTVerificationException ex) {
      exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
      return exchange.getResponse().setComplete();
    }
  }
}
