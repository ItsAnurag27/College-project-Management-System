package com.taskmgr.task.web;

import org.springframework.http.HttpStatus;

public class WebException extends RuntimeException {
  private final HttpStatus status;

  public WebException(HttpStatus status, String message) {
    super(message);
    this.status = status;
  }

  public HttpStatus getStatus() {
    return status;
  }
}
