package com.taskmgr.project.web;

import com.taskmgr.project.orgs.OrganizationEntity;
import com.taskmgr.project.orgs.OrganizationMemberEntity;
import com.taskmgr.project.orgs.OrganizationMemberRepository;
import com.taskmgr.project.orgs.OrganizationRepository;
import com.taskmgr.project.projects.ProjectEntity;
import com.taskmgr.project.projects.ProjectRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping
public class ProjectController {

  private final OrganizationRepository orgs;
  private final OrganizationMemberRepository members;
  private final ProjectRepository projects;

  public ProjectController(OrganizationRepository orgs, OrganizationMemberRepository members, ProjectRepository projects) {
    this.orgs = orgs;
    this.members = members;
    this.projects = projects;
  }

  public record OrgCreateRequest(@NotBlank String name) {}
  public record OrgView(String id, String name) {}

  public record ProjectCreateRequest(@NotBlank String name, String description) {}
  public record ProjectView(String id, String orgId, String name, String description) {}

  public record AddMemberRequest(@NotNull UUID userId, String role) {}
  public record MemberView(String orgId, String userId, String role) {}

  private boolean isRoot(String raw) {
    return raw != null && raw.equalsIgnoreCase("true");
  }

  private void forbidIfRoot(String raw) {
    if (isRoot(raw)) {
      throw new WebException(HttpStatus.FORBIDDEN, "Root admin is read-only");
    }
  }

  @PostMapping("/orgs")
  @ResponseStatus(HttpStatus.CREATED)
  public OrgView createOrg(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @Valid @RequestBody OrgCreateRequest request
  ) {
    forbidIfRoot(root);
    UUID uid = UUID.fromString(userId);

    UUID orgId = UUID.randomUUID();
    OrganizationEntity org = new OrganizationEntity(orgId, request.name(), uid, OffsetDateTime.now());
    orgs.save(org);

    members.save(new OrganizationMemberEntity(orgId, uid, "ADMIN", OffsetDateTime.now()));

    return new OrgView(org.getId().toString(), org.getName());
  }

  @PostMapping("/orgs/{orgId}/members")
  @ResponseStatus(HttpStatus.CREATED)
  public MemberView addMember(
      @RequestHeader("X-User-Id") String requesterUserId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String orgId,
      @Valid @RequestBody AddMemberRequest request
  ) {
    forbidIfRoot(root);
    UUID requesterId = UUID.fromString(requesterUserId);
    UUID oid = UUID.fromString(orgId);

    OrganizationMemberEntity requesterMembership = members.findByOrgIdAndUserId(oid, requesterId)
        .orElseThrow(() -> new WebException(HttpStatus.FORBIDDEN, "Not a member of org"));

    if (!"ADMIN".equalsIgnoreCase(requesterMembership.getRole())) {
      throw new WebException(HttpStatus.FORBIDDEN, "Admin role required");
    }

    UUID newMemberUserId = request.userId();
    if (members.existsByOrgIdAndUserId(oid, newMemberUserId)) {
      OrganizationMemberEntity existing = members.findByOrgIdAndUserId(oid, newMemberUserId)
          .orElseThrow(() -> new WebException(HttpStatus.CONFLICT, "User is already a member"));
      return new MemberView(existing.getOrgId().toString(), existing.getUserId().toString(), existing.getRole());
    }

    String role = (request.role() == null || request.role().isBlank()) ? "MEMBER" : request.role().trim().toUpperCase();
    if (!role.equals("ADMIN") && !role.equals("MEMBER")) {
      throw new WebException(HttpStatus.BAD_REQUEST, "Role must be ADMIN or MEMBER");
    }

    OrganizationMemberEntity member = new OrganizationMemberEntity(oid, newMemberUserId, role, OffsetDateTime.now());
    members.save(member);

    return new MemberView(member.getOrgId().toString(), member.getUserId().toString(), member.getRole());
  }

  @GetMapping("/orgs/{orgId}/members")
  public List<MemberView> listMembers(
      @RequestHeader("X-User-Id") String requesterUserId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String orgId
  ) {
    UUID requesterId = UUID.fromString(requesterUserId);
    UUID oid = UUID.fromString(orgId);

    if (!isRoot(root) && !members.existsByOrgIdAndUserId(oid, requesterId)) {
      throw new WebException(HttpStatus.FORBIDDEN, "Not a member of org");
    }

    return members.findByOrgId(oid)
        .stream()
        .map(m -> new MemberView(m.getOrgId().toString(), m.getUserId().toString(), m.getRole()))
        .toList();
  }

  @DeleteMapping("/orgs/{orgId}/members/{userId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void removeMember(
      @RequestHeader("X-User-Id") String requesterUserId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String orgId,
      @PathVariable String userId
  ) {
    forbidIfRoot(root);
    UUID requesterId = UUID.fromString(requesterUserId);
    UUID oid = UUID.fromString(orgId);
    UUID targetUserId = UUID.fromString(userId);

    OrganizationMemberEntity requesterMembership = members.findByOrgIdAndUserId(oid, requesterId)
        .orElseThrow(() -> new WebException(HttpStatus.FORBIDDEN, "Not a member of org"));

    if (!"ADMIN".equalsIgnoreCase(requesterMembership.getRole())) {
      throw new WebException(HttpStatus.FORBIDDEN, "Admin role required");
    }

    if (requesterId.equals(targetUserId)) {
      throw new WebException(HttpStatus.BAD_REQUEST, "You cannot remove yourself");
    }

    OrganizationMemberEntity target = members.findByOrgIdAndUserId(oid, targetUserId)
        .orElseThrow(() -> new WebException(HttpStatus.NOT_FOUND, "Member not found"));

    if ("ADMIN".equalsIgnoreCase(target.getRole())) {
      long adminCount = members.findByOrgId(oid)
          .stream()
          .filter(m -> "ADMIN".equalsIgnoreCase(m.getRole()))
          .count();
      if (adminCount <= 1) {
        throw new WebException(HttpStatus.CONFLICT, "Cannot remove the last admin");
      }
    }

    members.delete(target);
  }

  @GetMapping("/orgs")
  public List<OrgView> listOrgs(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root
  ) {
    if (isRoot(root)) {
      return orgs.findAll().stream().map(o -> new OrgView(o.getId().toString(), o.getName())).toList();
    }
    UUID uid = UUID.fromString(userId);
    return members.findByUserId(uid)
        .stream()
        .map(m -> orgs.findById(m.getOrgId()).orElse(null))
        .filter(o -> o != null)
        .map(o -> new OrgView(o.getId().toString(), o.getName()))
        .toList();
  }

  @PostMapping("/orgs/{orgId}/projects")
  @ResponseStatus(HttpStatus.CREATED)
  public ProjectView createProject(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String orgId,
      @Valid @RequestBody ProjectCreateRequest request
  ) {
    forbidIfRoot(root);
    UUID uid = UUID.fromString(userId);
    UUID oid = UUID.fromString(orgId);

    OrganizationMemberEntity membership = members.findByOrgIdAndUserId(oid, uid)
        .orElseThrow(() -> new WebException(HttpStatus.FORBIDDEN, "Not a member of org"));

    if (!"ADMIN".equalsIgnoreCase(membership.getRole())) {
      throw new WebException(HttpStatus.FORBIDDEN, "Admin role required");
    }

    UUID pid = UUID.randomUUID();
    ProjectEntity project = new ProjectEntity(pid, oid, request.name(), request.description(), uid, OffsetDateTime.now());
    projects.save(project);

    return new ProjectView(project.getId().toString(), project.getOrgId().toString(), project.getName(), project.getDescription());
  }

  @GetMapping("/orgs/{orgId}/projects")
  public List<ProjectView> listProjects(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String orgId
  ) {
    UUID uid = UUID.fromString(userId);
    UUID oid = UUID.fromString(orgId);

    if (!isRoot(root) && !members.existsByOrgIdAndUserId(oid, uid)) {
      throw new WebException(HttpStatus.FORBIDDEN, "Not a member of org");
    }

    return projects.findByOrgId(oid)
        .stream()
        .map(p -> new ProjectView(p.getId().toString(), p.getOrgId().toString(), p.getName(), p.getDescription()))
        .toList();
  }

  @GetMapping("/projects/{projectId}")
  public ProjectView getProject(
      @RequestHeader("X-User-Id") String userId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String projectId
  ) {
    UUID uid = UUID.fromString(userId);
    ProjectEntity project = projects.findById(UUID.fromString(projectId))
        .orElseThrow(() -> new WebException(HttpStatus.NOT_FOUND, "Project not found"));

    if (!isRoot(root) && !members.existsByOrgIdAndUserId(project.getOrgId(), uid)) {
      throw new WebException(HttpStatus.FORBIDDEN, "Not a member of org");
    }

    return new ProjectView(project.getId().toString(), project.getOrgId().toString(), project.getName(), project.getDescription());
  }

  @DeleteMapping("/projects/{projectId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteProject(
      @RequestHeader("X-User-Id") String requesterUserId,
      @RequestHeader(value = "X-User-Root", required = false) String root,
      @PathVariable String projectId
  ) {
    forbidIfRoot(root);
    UUID requesterId = UUID.fromString(requesterUserId);
    UUID pid = UUID.fromString(projectId);

    ProjectEntity project = projects.findById(pid)
        .orElseThrow(() -> new WebException(HttpStatus.NOT_FOUND, "Project not found"));

    OrganizationMemberEntity requesterMembership = members.findByOrgIdAndUserId(project.getOrgId(), requesterId)
        .orElseThrow(() -> new WebException(HttpStatus.FORBIDDEN, "Not a member of org"));

    if (!"ADMIN".equalsIgnoreCase(requesterMembership.getRole())) {
      throw new WebException(HttpStatus.FORBIDDEN, "Admin role required");
    }

    projects.delete(project);
  }
}
