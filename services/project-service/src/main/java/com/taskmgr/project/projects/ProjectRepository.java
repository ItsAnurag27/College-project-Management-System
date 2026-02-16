package com.taskmgr.project.projects;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<ProjectEntity, UUID> {
  List<ProjectEntity> findByOrgId(UUID orgId);
}
