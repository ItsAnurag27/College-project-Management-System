package com.taskmgr.task.model;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskRepository extends JpaRepository<TaskEntity, UUID> {
  List<TaskEntity> findByProjectIdOrderByCreatedAtDesc(UUID projectId);
  List<TaskEntity> findByAssignedToUserIdOrderByCreatedAtDesc(UUID assignedToUserId);
}
