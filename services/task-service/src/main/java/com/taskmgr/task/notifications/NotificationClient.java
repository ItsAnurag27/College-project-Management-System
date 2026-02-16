package com.taskmgr.task.notifications;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class NotificationClient {

  private final RestClient restClient;

  public NotificationClient(@Value("${app.notifications.base-url}") String baseUrl) {
    this.restClient = RestClient.builder().baseUrl(baseUrl).build();
  }

  public void createNotification(String userId, String type, String message, String refType, String refId) {
    Map<String, Object> payload = Map.of(
        "userId", userId,
        "type", type,
        "message", message,
        "refType", refType,
        "refId", refId
    );

    try {
      restClient.post()
          .uri("/notifications")
          .contentType(MediaType.APPLICATION_JSON)
          .body(payload)
          .retrieve()
          .toBodilessEntity();
    } catch (Exception ignored) {
      // MVP: best-effort notifications
    }
  }
}
