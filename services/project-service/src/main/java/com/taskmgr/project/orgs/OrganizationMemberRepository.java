package com.taskmgr.project.orgs;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationMemberRepository extends JpaRepository<OrganizationMemberEntity, OrganizationMemberEntity.Pk> {
  List<OrganizationMemberEntity> findByUserId(UUID userId);
  List<OrganizationMemberEntity> findByOrgId(UUID orgId);
  Optional<OrganizationMemberEntity> findByOrgIdAndUserId(UUID orgId, UUID userId);
  boolean existsByOrgIdAndUserId(UUID orgId, UUID userId);
}
