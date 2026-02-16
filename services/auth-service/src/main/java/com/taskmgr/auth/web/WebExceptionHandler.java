package com.taskmgr.auth.web;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class WebExceptionHandler {

  @ExceptionHandler(WebException.class)
  public ResponseEntity<Map<String, Object>> handle(WebException ex) {
    return ResponseEntity.status(ex.getStatus())
        .body(Map.of(
            "error", ex.getMessage(),
            "status", ex.getStatus().value()
        ));
  }
}
