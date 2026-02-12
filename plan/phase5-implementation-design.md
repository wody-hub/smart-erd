# 5단계: 프로젝트 관리 (고급) — 구현 설계서

## 개요

Phase 5 기획서를 기반으로 팀 설정, 권한 세분화, 프로젝트 설정, SQL DDL 내보내기 기능을 구현한다.
기존 아키텍처 패턴(Controller+DTO / Service+Entity / React Query+Zustand)을 일관되게 따르며,
최소 변경 원칙으로 기능을 추가한다.

---

## 1. API 설계

### 1.1 신규 엔드포인트

| Method | Path | 설명 | Auth | 권한 |
|--------|------|------|------|------|
| `GET` | `/api/teams/{teamId}/me` | 내 역할 조회 | Bearer JWT | 팀 멤버 |
| `PUT` | `/api/teams/{teamId}` | 팀 이름 변경 | Bearer JWT | ADMIN |
| `DELETE` | `/api/teams/{teamId}` | 팀 삭제 | Bearer JWT | ADMIN |
| `PUT` | `/api/teams/{teamId}/projects/{projectId}` | 프로젝트 수정 | Bearer JWT | ADMIN, MEMBER |

### 1.2 기존 엔드포인트 권한 강화 (변경 없이 서비스 로직만 수정)

| 엔드포인트 | 현재 | 변경 후 |
|-----------|------|---------|
| `POST /api/teams/{tid}/projects` | verifyMembership | verifyEditable (VIEWER 차단) |
| `DELETE /api/teams/{tid}/projects/{id}` | verifyMembership | verifyEditable (VIEWER 차단) |
| `POST .../diagrams` | verifyMembership | verifyEditable |
| `PUT .../diagrams/{id}` | verifyMembership | verifyEditable |
| `PATCH .../diagrams/{id}` | verifyMembership | verifyEditable |
| `DELETE .../diagrams/{id}` | verifyMembership | verifyEditable |
| `POST .../domains` | verifyMembership | verifyEditable |
| `PUT .../domains/{id}` | verifyMembership | verifyEditable |
| `DELETE .../domains/{id}` | verifyMembership | verifyEditable |
| `POST .../terms` | verifyMembership | verifyEditable |
| `PUT .../terms/{id}` | verifyMembership | verifyEditable |
| `DELETE .../terms/{id}` | verifyMembership | verifyEditable |

### 1.3 요청/응답 스키마

#### GET /api/teams/{teamId}/me

- **Request**: 없음 (JWT에서 loginId 추출)
- **Response**: `{ "role": "ADMIN" | "MEMBER" | "VIEWER" }`
- **에러**: 404 (팀 미존재), 403 (팀 멤버 아님)

#### PUT /api/teams/{teamId}

- **Request**: `{ "name": "string" }` (`@NotBlank`, `@Size(min=1, max=100)`)
- **Response**: `TeamResponse` (기존 형식)
- **에러**: 400 (유효성 검증 실패), 403 (ADMIN 아님), 404 (팀 미존재)

#### DELETE /api/teams/{teamId}

- **Request**: 없음
- **Response**: 204 No Content
- **에러**: 403 (ADMIN 아님), 404 (팀 미존재)

#### PUT /api/teams/{teamId}/projects/{projectId}

- **Request**: `{ "name": "string", "description": "string?" }` (`name`: `@NotBlank`, `@Size(max=100)`, `description`: `@Size(max=500)` nullable)
- **Response**: `ProjectResponse` (description 필드 추가된 버전)
- **에러**: 400 (유효성 검증), 403 (VIEWER 차단), 404 (팀/프로젝트 미존재)

---

## 2. 데이터 모델

### 2.1 엔티티 변경

#### Project 엔티티 — `description` 필드 추가

```java
// src/main/java/com/smarterd/domain/project/entity/Project.java

/** 프로젝트 설명 (최대 500자, nullable) */
@Column(length = 500)
private String description;

// Builder에 description 추가
@Builder
public Project(String name, String description, Team team) {
    this.name = name;
    this.description = description;
    this.team = team;
}

/** 프로젝트 정보를 변경한다. */
public void update(String name, String description) {
    this.name = name;
    this.description = description;
}
```

#### Team 엔티티 — `rename` 메서드 추가

```java
// src/main/java/com/smarterd/domain/team/entity/Team.java

/** 팀 이름을 변경한다. */
public void rename(String name) {
    this.name = name;
}
```

### 2.2 DB 영향

- `projects` 테이블에 `description VARCHAR(500)` 컬럼 추가 (nullable, `ddl-auto: update`가 자동 처리)
- 팀 삭제 시 CASCADE: `teamRepository.delete(team)` -> orphanRemoval로 `TeamMember` 자동 삭제, `Project`/`Domain`/`Term`/`Diagram`은 별도 삭제 필요

### 2.3 팀 삭제 CASCADE 전략

현재 `Team` -> `TeamMember`만 cascade/orphanRemoval 설정되어 있다. `Project`, `Domain`, `Term`은 `@ManyToOne(team)` 관계만 있고 cascade 없다. 팀 삭제 시 다음 순서로 명시적 삭제한다:

```text
1. Diagram 삭제 (projects 하위)
2. Project 삭제
3. Term 삭제 (domain 참조 있으므로 term 먼저)
4. Domain 삭제
5. Team 삭제 (members는 orphanRemoval로 자동)
```

**구현 방법**: `TeamService.deleteTeam()`에서 각 repository의 bulk delete 메서드를 순차 호출한다. DB FK constraint에 `ON DELETE CASCADE`를 설정하는 방법도 있으나, 현재 `ddl-auto: update` 정책에서는 JPA 레벨에서 명시적으로 처리하는 것이 안전하다.

### 2.4 신규 Repository 메서드

| Repository | 메서드 | 설명 |
|-----------|--------|------|
| `DiagramRepository` | `deleteByProjectIn(List<Project> projects)` | 프로젝트 목록에 속한 다이어그램 일괄 삭제 |
| `ProjectRepository` | `findByTeam(Team team)` | 이미 존재 |
| `ProjectRepository` | `deleteByTeam(Team team)` | 팀의 프로젝트 일괄 삭제 |
| `DomainRepository` | `deleteByTeam(Team team)` | 팀의 도메인 일괄 삭제 |
| `TermRepository` | `deleteByTeam(Team team)` | 팀의 용어 일괄 삭제 |
| `TeamMemberRepository` | `findByTeamAndUser(Team, User)` | 이미 존재 -- `getMyRole()`에 재사용 |

---

## 3. 백엔드 서비스 설계

### 3.1 TeamService 변경

#### 신규 메서드

```java
/**
 * 현재 사용자의 팀 내 역할을 조회한다.
 *
 * @param loginId 요청 사용자의 로그인 ID
 * @param teamId  팀 ID
 * @return 역할 응답
 */
public MyRoleResponse getMyRole(String loginId, Long teamId) {
    final var user = authService.findUserByLoginId(loginId);
    final var team = findTeamById(teamId);
    final var member = teamMemberRepository
        .findByTeamAndUser(team, user)
        .orElseThrow(() -> new DomainAccessDeniedException(
            MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code()));
    return new MyRoleResponse(member.getRole());
}

/**
 * 팀 이름을 변경한다. (ADMIN 전용)
 *
 * @param loginId 요청 사용자의 로그인 ID
 * @param teamId  팀 ID
 * @param request 팀 수정 요청
 * @return 수정된 팀 응답
 */
@Transactional
public TeamResponse updateTeam(String loginId, Long teamId, UpdateTeamRequest request) {
    final var user = authService.findUserByLoginId(loginId);
    final var team = findTeamById(teamId);
    verifyAdmin(team, user);
    team.rename(request.name());
    return TeamResponse.from(team);
}

/**
 * 팀을 삭제한다. 모든 하위 리소스를 함께 삭제한다. (ADMIN 전용)
 *
 * @param loginId 요청 사용자의 로그인 ID
 * @param teamId  팀 ID
 */
@Transactional
public void deleteTeam(String loginId, Long teamId) {
    final var user = authService.findUserByLoginId(loginId);
    final var team = findTeamById(teamId);
    verifyAdmin(team, user);

    // CASCADE 삭제: Diagram -> Project -> Term -> Domain -> Team(+Members)
    final var projects = projectRepository.findByTeam(team);
    if (!projects.isEmpty()) {
        diagramRepository.deleteByProjectIn(projects);
        projectRepository.deleteByTeam(team);
    }
    termRepository.deleteByTeam(team);
    domainRepository.deleteByTeam(team);
    teamRepository.delete(team); // members는 orphanRemoval
}

/**
 * 사용자가 팀에서 편집 가능한 역할(ADMIN 또는 MEMBER)인지 확인한다.
 * VIEWER는 읽기 전용이므로 DomainAccessDeniedException을 발생시킨다.
 *
 * @param team 팀 엔티티
 * @param user 사용자 엔티티
 */
public void verifyEditable(Team team, User user) {
    final var member = teamMemberRepository
        .findByTeamAndUser(team, user)
        .orElseThrow(() -> new DomainAccessDeniedException(
            MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code()));
    if (member.getRole() == TeamMemberRole.VIEWER) {
        throw new DomainAccessDeniedException(
            MessageCode.ERROR_ACCESS_DENIED_VIEWER_READONLY.code());
    }
}
```

#### 기존 `verifyAdmin` 가시성

`verifyAdmin()`은 현재 `private`이다. `TeamController`에서 직접 호출하지 않고 `TeamService` 내부에서만 사용하므로 그대로 유지한다.

#### 의존성 추가

`TeamService`에 `ProjectRepository`, `DiagramRepository`, `DomainRepository`, `TermRepository` 주입이 필요하다. 순환 의존을 피하기 위해, **팀 삭제 전용으로 repository를 직접 사용**하고 다른 서비스를 경유하지 않는다.

### 3.2 ProjectService 변경

#### 신규 메서드

```java
/**
 * 프로젝트를 수정한다. (ADMIN/MEMBER 전용)
 *
 * @param loginId   요청 사용자의 로그인 ID
 * @param teamId    팀 ID
 * @param projectId 프로젝트 ID
 * @param request   프로젝트 수정 요청
 * @return 수정된 프로젝트 응답
 */
@Transactional
public ProjectResponse updateProject(
    String loginId, Long teamId, Long projectId, UpdateProjectRequest request
) {
    final var user = authService.findUserByLoginId(loginId);
    final var team = teamService.findTeamById(teamId);
    teamService.verifyEditable(team, user);

    final var project = findProjectById(projectId);
    verifyProjectBelongsToTeam(project, teamId);

    project.update(request.name(), request.description());
    return ProjectResponse.from(project);
}
```

#### 기존 메서드 권한 변경

`createProject()`, `deleteProject()`에서 `teamService.verifyMembership(team, user)` -> `teamService.verifyEditable(team, user)` 변경.

### 3.3 DiagramService 변경

`verifyAccess()` 메서드를 읽기/쓰기 용도로 분리한다.

```java
/** 읽기 전용 접근 검증 (모든 멤버) */
private Project verifyReadAccess(String loginId, Long teamId, Long projectId) {
    final var user = authService.findUserByLoginId(loginId);
    final var team = teamService.findTeamById(teamId);
    teamService.verifyMembership(team, user);
    final var project = projectService.findProjectById(projectId);
    projectService.verifyProjectBelongsToTeam(project, teamId);
    return project;
}

/** 쓰기 접근 검증 (ADMIN/MEMBER만) */
private Project verifyWriteAccess(String loginId, Long teamId, Long projectId) {
    final var user = authService.findUserByLoginId(loginId);
    final var team = teamService.findTeamById(teamId);
    teamService.verifyEditable(team, user);
    final var project = projectService.findProjectById(projectId);
    projectService.verifyProjectBelongsToTeam(project, teamId);
    return project;
}
```

| 메서드 | 검증 |
|--------|------|
| `getDiagrams()` | `verifyReadAccess` |
| `getDiagram()` | `verifyReadAccess` |
| `createDiagram()` | `verifyWriteAccess` |
| `saveDiagram()` | `verifyWriteAccess` |
| `renameDiagram()` | `verifyWriteAccess` |
| `deleteDiagram()` | `verifyWriteAccess` |

### 3.4 DomainService / TermService 변경

동일 패턴: 쓰기 메서드에서 `verifyMembership` -> `verifyEditable` 변경.

| 서비스 | 읽기 (verifyMembership 유지) | 쓰기 (verifyEditable 변경) |
|--------|---------------------------|--------------------------|
| `DomainService` | `getDomains()`, `getDomain()` | `createDomain()`, `updateDomain()`, `deleteDomain()` |
| `TermService` | `getTerms()`, `getTerm()` | `createTerm()`, `updateTerm()`, `deleteTerm()` |
| `DomainBulkService` | 검증 전용 | `bulkSaveDomains()` |
| `TermBulkService` | 검증 전용 | `bulkSaveTerms()` |

### 3.5 TeamController 변경

```java
// 신규 엔드포인트 3개 추가

@Operation(summary = "내 역할 조회")
@GetMapping("/{teamId}/me")
public ResponseEntity<MyRoleResponse> getMyRole(
    @AuthenticationPrincipal Jwt jwt,
    @PathVariable Long teamId
) {
    return ResponseEntity.ok(teamService.getMyRole(jwt.getSubject(), teamId));
}

@Operation(summary = "팀 이름 변경")
@PutMapping("/{teamId}")
public ResponseEntity<TeamResponse> updateTeam(
    @AuthenticationPrincipal Jwt jwt,
    @PathVariable Long teamId,
    @Valid @RequestBody UpdateTeamRequest request
) {
    return ResponseEntity.ok(teamService.updateTeam(jwt.getSubject(), teamId, request));
}

@Operation(summary = "팀 삭제")
@DeleteMapping("/{teamId}")
public ResponseEntity<Void> deleteTeam(
    @AuthenticationPrincipal Jwt jwt,
    @PathVariable Long teamId
) {
    teamService.deleteTeam(jwt.getSubject(), teamId);
    return ResponseEntity.noContent().build();
}
```

### 3.6 ProjectController 변경

```java
// 신규 엔드포인트 1개 추가

@Operation(summary = "프로젝트 수정")
@PutMapping("/{projectId}")
public ResponseEntity<ProjectResponse> updateProject(
    @AuthenticationPrincipal Jwt jwt,
    @PathVariable Long teamId,
    @PathVariable Long projectId,
    @Valid @RequestBody UpdateProjectRequest request
) {
    return ResponseEntity.ok(
        projectService.updateProject(jwt.getSubject(), teamId, projectId, request));
}
```

---

## 4. 신규 DTO

### 4.1 백엔드 DTO

| DTO | 패키지 | 필드 |
|-----|--------|------|
| `UpdateTeamRequest` | `api/team/dto/` | `@NotBlank @Size(max=100) String name` |
| `UpdateProjectRequest` | `api/project/dto/` | `@NotBlank @Size(max=100) String name`, `@Size(max=500) String description` (nullable) |
| `MyRoleResponse` | `api/team/dto/` | `TeamMemberRole role` |

### 4.2 ProjectResponse 변경

```java
// description 필드 추가
public record ProjectResponse(
    Long id,
    String name,
    String description,    // 추가
    Long teamId,
    Instant createdAt
) {
    public static ProjectResponse from(Project project) {
        return new ProjectResponse(
            project.getId(),
            project.getName(),
            project.getDescription(),  // 추가
            project.getTeam().getId(),
            project.getCreatedAt()
        );
    }
}
```

---

## 5. 신규 MessageCode 및 i18n

### 5.1 MessageCode enum 추가

```java
ERROR_ACCESS_DENIED_VIEWER_READONLY("error.access-denied.viewer-readonly"),
```

### 5.2 messages.properties (영문)

```properties
error.access-denied.viewer-readonly=Viewers cannot modify resources
```

> `validation.size.description`은 이미 존재하므로 추가 불필요.

### 5.3 messages_ko.properties (한글)

```properties
error.access-denied.viewer-readonly=조회자 역할은 수정할 수 없습니다
```

---

## 6. 프론트엔드 설계

### 6.1 라우팅 변경

라우팅 변경 없음. 모든 신규 기능은 기존 페이지 내 다이얼로그/컴포넌트로 구현한다.

### 6.2 타입 정의 변경

#### `types/team.ts` -- MyRoleResponse 추가

```typescript
/** 내 팀 역할 응답 */
export interface MyRoleResponse {
  /** 팀 내 역할 */
  role: TeamMemberRole;
}
```

#### `types/project.ts` -- description 추가

```typescript
export interface Project {
  /** 프로젝트 고유 ID */
  id: number;
  /** 프로젝트 이름 */
  name: string;
  /** 프로젝트 설명 (nullable) */
  description: string | null;
  /** 소속 팀 ID */
  teamId: number;
  /** 생성일시 (ISO-8601 UTC) */
  createdAt: string;
}
```

#### `types/erd.ts` -- DDL 관련 타입 추가

```typescript
/** 지원 DBMS 타입 */
export type DbmsType = 'postgresql' | 'mysql' | 'oracle' | 'sqlserver' | 'ansi';
```

### 6.3 API 모듈 변경

#### `api/teamApi.ts` -- 신규 함수

```typescript
/**
 * 현재 사용자의 팀 내 역할을 조회한다.
 *
 * @param teamId 팀 ID
 * @returns 내 역할 응답
 */
export async function fetchMyRole(teamId: string): Promise<MyRoleResponse> {
  const res = await axiosInstance.get<MyRoleResponse>(`/teams/${teamId}/me`);
  return res.data;
}

/**
 * 팀 이름을 변경한다.
 *
 * @param teamId 팀 ID
 * @param name   새 팀 이름
 * @returns 수정된 팀 응답
 */
export async function updateTeam(teamId: string, name: string): Promise<Team> {
  const res = await axiosInstance.put<Team>(`/teams/${teamId}`, { name });
  return res.data;
}

/**
 * 팀을 삭제한다.
 *
 * @param teamId 삭제할 팀 ID
 */
export async function deleteTeam(teamId: string): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}`);
}
```

#### `api/projectApi.ts` -- 신규 함수

```typescript
/**
 * 프로젝트를 수정한다.
 *
 * @param teamId      팀 ID
 * @param projectId   프로젝트 ID
 * @param data        수정 데이터 (name, description)
 * @returns 수정된 프로젝트 응답
 */
export async function updateProject(
  teamId: string,
  projectId: number,
  data: { name: string; description?: string | null },
): Promise<Project> {
  const res = await axiosInstance.put<Project>(
    `/teams/${teamId}/projects/${projectId}`,
    data,
  );
  return res.data;
}
```

### 6.4 상수 변경

#### `constants/query-keys.ts` -- myRole 키 추가

```typescript
teams: {
  all: ['teams'] as const,
  detail: (teamId: string) => ['teams', teamId] as const,
  members: (teamId: string) => ['teams', teamId, 'members'] as const,
  myRole: (teamId: string) => ['teams', teamId, 'myRole'] as const,  // 추가
},
```

### 6.5 신규 훅: `useTeamRole`

**파일**: `client/src/hooks/useTeamRole.ts`

```typescript
/**
 * 현재 사용자의 팀 내 역할을 조회하는 훅.
 *
 * @param teamId 팀 ID
 * @returns { role, isAdmin, canEdit, isLoading }
 */
export function useTeamRole(teamId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.teams.myRole(teamId!),
    queryFn: () => fetchMyRole(teamId!),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000, // 5분 -- 역할은 자주 변경되지 않음
  });

  const role = data?.role ?? null;

  return {
    /** 현재 역할 (null이면 로딩 중) */
    role,
    /** ADMIN 여부 -- 팀 설정, 멤버 관리 표시 */
    isAdmin: role === 'ADMIN',
    /** 편집 가능 여부 (ADMIN 또는 MEMBER) -- 생성/수정/삭제 버튼 표시 */
    canEdit: role === 'ADMIN' || role === 'MEMBER',
    /** 로딩 중 여부 */
    isLoading,
  };
}
```

### 6.6 컴포넌트 트리

#### ProjectsPage (수정)

```text
ProjectsPage
  +-- Header (기존, 팀 이름 표시)
  |   +-- MembersDialog (기존, isAdmin prop 추가)
  |   +-- TeamSettingsDialog (신규, isAdmin일 때만 표시)
  |   +-- 사전/새 프로젝트 버튼 (canEdit 조건부 렌더링)
  +-- ProjectCard[] (기존)
  |   +-- ProjectSettingsDialog (신규, canEdit일 때만 표시)
  |   +-- 삭제 버튼 (canEdit 조건부)
  +-- CreateResourceDialog (기존, canEdit 조건부)
```

#### DiagramPage (수정)

```text
DiagramPage
  +-- Header (기존)
  |   +-- 저장 버튼 (canEdit 조건부)
  +-- Sidebar (기존)
  |   +-- 테이블 추가 버튼 (canEdit 조건부)
  |   +-- SidebarTableItem (canEdit -> 이름변경/삭제)
  +-- ERDCanvas (기존)
      +-- CanvasToolbar (수정)
      |   +-- FK 연결 (canEdit 조건부)
      |   +-- 자동 정렬 (canEdit 조건부)
      |   +-- 내보내기 드롭다운 (항상)
      |   |   +-- PNG/JPG/SVG/PDF (기존)
      |   |   +-- SQL DDL (신규 -> DdlExportDialog)
      |   +-- 유효성 검사 (항상)
      +-- TableNode (수정, canEdit prop)
      +-- DdlExportDialog (신규)
```

#### DictionaryPage (수정)

```text
DictionaryPage
  +-- DomainTab (수정, canEdit prop 전달)
  |   +-- 추가/수정/삭제/업로드 버튼 (canEdit 조건부)
  +-- TermTab (수정, canEdit prop 전달)
      +-- 추가/수정/삭제/업로드 버튼 (canEdit 조건부)
```

### 6.7 신규 컴포넌트 상세

#### TeamSettingsDialog

**파일**: `client/src/components/team/TeamSettingsDialog.tsx`

| Prop | Type | 설명 |
|------|------|------|
| `open` | `boolean` | 다이얼로그 열림 여부 |
| `onOpenChange` | `(open: boolean) => void` | 열림 상태 변경 |
| `team` | `Team` | 팀 정보 (이름 초기값, 삭제 확인용) |
| `teamId` | `string` | 팀 ID (API 호출용) |

**내부 상태**: `useState(name)`, `useState(deleteConfirmOpen)`, `useState(deleteConfirmValue)`

**뮤테이션**:
- `updateTeamMutation` -> `updateTeam(teamId, name)` -> `invalidateQueries(teams.detail(teamId))` + `invalidateQueries(teams.all)`
- `deleteTeamMutation` -> `deleteTeam(teamId)` -> `navigate(ROUTES.TEAMS)` + `invalidateQueries(teams.all)`

**삭제 확인**: 팀 이름을 정확히 입력해야 삭제 버튼 활성화 (`deleteConfirmValue === team.name`)

**삭제 성공 후**: `navigate(ROUTES.TEAMS)` + `invalidateQueries(queryKeys.teams.all)`

#### ProjectSettingsDialog

**파일**: `client/src/components/project/ProjectSettingsDialog.tsx`

| Prop | Type | 설명 |
|------|------|------|
| `open` | `boolean` | 다이얼로그 열림 여부 |
| `onOpenChange` | `(open: boolean) => void` | 열림 상태 변경 |
| `project` | `Project` | 프로젝트 정보 (초기값) |
| `teamId` | `string` | 팀 ID (API 호출용) |

**내부 상태**: `useState(name)`, `useState(description)`

**뮤테이션**: `updateProjectMutation` -> `updateProject(teamId, project.id, { name, description })`

**성공 후**: `invalidateQueries(queryKeys.projects.byTeam(teamId))`

#### DdlExportDialog

**파일**: `client/src/components/erd/DdlExportDialog.tsx`

| Prop | Type | 설명 |
|------|------|------|
| `open` | `boolean` | 다이얼로그 열림 여부 |
| `onOpenChange` | `(open: boolean) => void` | 열림 상태 변경 |
| `diagramName` | `string` | 파일 다운로드 시 사용할 다이어그램 이름 |

**내부 상태**: `useState<DbmsType>('postgresql')`

**데이터 소스**: `useCanvasStore()`에서 `nodes`, `edges` 직접 참조

**DDL 생성**: `useMemo(() => generateDdl(nodes, edges, dbms), [nodes, edges, dbms])`

**미리보기**: Monaco Editor (읽기 전용, language: `sql`)

**클립보드 복사**: `navigator.clipboard.writeText(ddl)` -> `toast.success()`

**파일 다운로드**: Blob -> `URL.createObjectURL` -> `<a>` 클릭 -> 파일명 `{diagramName}.sql`

#### Textarea (shadcn/ui)

**파일**: `client/src/components/ui/textarea.tsx`

기존 shadcn/ui 패턴대로 생성. `cn()` + `ref` 일반 prop (React 19).

### 6.8 기존 컴포넌트 수정 상세

#### MembersDialog 수정

`isAdmin` prop 추가:

| 요소 | `isAdmin=true` | `isAdmin=false` |
|------|---------------|----------------|
| 초대 폼 | 표시 | 숨김 |
| 멤버 제거 버튼 | 표시 (owner 제외) | 숨김 |
| 역할 변경 드롭다운 | 활성 (owner 제외) | 비활성 (텍스트 표시) |

#### CanvasToolbar 수정

`canEdit` prop 추가:

- `canEdit=false`: FK 연결, 자동 정렬 버튼 숨김
- 내보내기 드롭다운에 "SQL DDL" 항목 추가 (`DropdownMenuItem`)

#### ERDCanvas 수정

`canEdit` prop 추가:

- `canEdit=false`: `nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable={false}`
- 엣지 삭제, 노드 삭제 비활성화
- FK 연결 모드 진입 차단

#### TableNode 수정

`canEdit` 전달 방법: ERDCanvas에서 React Context (`ErdPermissionContext`)를 생성하고, TableNode 내부에서 `useContext`로 소비한다.

- `canEdit=false`: 컬럼 추가/삭제 버튼 숨김, PK/FK/Nullable 토글 비활성화, 인라인 편집 비활성화, 논리명/도메인 선택 비활성화

> **설계 결정**: ERD 에디터 내부의 깊은 중첩(ERDCanvas -> TableNode -> ColumnRow)에서는 prop drilling 대신 React Context가 적합하다. 기존 `ErdDictionaryContext` 패턴이 있으므로 동일 패턴을 따른다.

#### Header 수정

`canEdit` prop 추가:

- `canEdit=false`: 저장 버튼, 백업 관련 UI 숨김

#### Sidebar 수정

`canEdit` prop 추가:

- `canEdit=false`: 테이블 추가 버튼 숨김, SidebarTableItem의 삭제/이름변경 비활성화

#### DomainTab / TermTab 수정

`canEdit` prop 추가:

- `canEdit=false`: 추가/수정/삭제/업로드 버튼 숨김

---

## 7. DDL 생성기 알고리즘

### 7.1 파일 구조

**파일**: `client/src/lib/ddl-generator.ts`

### 7.2 함수 시그니처

```typescript
/**
 * ERD 노드/엣지 데이터를 SQL DDL 문자열로 변환한다.
 *
 * @param nodes  React Flow 테이블 노드 배열
 * @param edges  React Flow 엣지 배열 (FK 관계)
 * @param dbms   대상 DBMS 타입
 * @returns SQL DDL 문자열
 */
export function generateDdl(
  nodes: TableNode[],
  edges: ERDEdge[],
  dbms: DbmsType,
): string
```

### 7.3 알고리즘 단계

```text
1. 노드 -> 테이블 목록 변환
   - node.data.label -> 테이블명
   - node.data.columns -> 컬럼 목록 (name, type, pk, fk, nullable, logicalName)

2. 엣지 -> FK 관계 추출
   - sourceHandle: "{sourceNodeId}-{sourceColId}-source"
   - targetHandle: "{targetNodeId}-{targetColId}-target"
   - extractColId() 헬퍼로 컬럼 ID 추출
   - nodeId + colId -> 테이블명 + 컬럼명 매핑

3. 위상 정렬 (Topological Sort)
   - FK 참조 그래프 기반으로 부모 테이블이 먼저 오도록 정렬
   - 순환 참조 시 원본 순서 유지 (FK는 별도 ALTER TABLE이므로 순서 무관)

4. DBMS별 방언(Dialect) 적용
   - quoteIdentifier(name): DBMS별 인용 부호 적용
   - columnDefinition(col): 컬럼 정의 문자열 생성
   - primaryKeyConstraint(tableName, pkCols): PK 제약조건
   - foreignKeyConstraint(fkInfo): FK ALTER TABLE 문
   - commentStatement(table, column, comment): COMMENT 문

5. DDL 문자열 조합
   - 헤더 주석 (Generated by Smart ERD, DBMS, Date)
   - CREATE TABLE 문 (위상 정렬 순)
   - ALTER TABLE ... ADD CONSTRAINT FK 문 (마지막)
   - COMMENT 문 (논리명이 있는 컬럼)
```

### 7.4 DBMS 방언 구조

```typescript
interface DbmsDialect {
  /** 식별자 인용 (테이블명, 컬럼명) */
  quote(name: string): string;
  /** 문장 구분자 */
  statementSeparator: string;
  /** COMMENT 문 생성 (null이면 미지원) */
  comment?(table: string, column: string, text: string): string;
  /** 테이블 생성 후 추가 옵션 (예: ENGINE=InnoDB) */
  tableOptions?: string;
}
```

| DBMS | quote | separator | comment | tableOptions |
|------|-------|-----------|---------|-------------|
| PostgreSQL | `"name"` | `;` | `COMMENT ON COLUMN "t"."c" IS 'text';` | -- |
| MySQL | `` `name` `` | `;` | 인라인 `COMMENT 'text'` | `ENGINE=InnoDB` |
| Oracle | `"name"` | `;` + 줄바꿈 + `/` | `COMMENT ON COLUMN "t"."c" IS 'text';` | -- |
| SQL Server | `[name]` | `;\nGO` | -- (생략) | -- |
| ANSI | `"name"` | `;` | -- | -- |

### 7.5 순수 함수 특성

- **서버 API 호출 없음** -- `useCanvasStore`의 nodes/edges만 사용
- **사이드 이펙트 없음** -- 입력 -> 문자열 출력
- **테스트 용이** -- 노드/엣지 mock 데이터로 단위 테스트 가능

---

## 8. 프론트엔드 i18n 키

### 8.1 팀 설정

| 키 | ko | en |
|----|----|----|
| `team.settings.title` | 팀 설정 | Team Settings |
| `team.settings.nameLabel` | 팀 이름 | Team Name |
| `team.settings.save` | 저장 | Save |
| `team.settings.dangerZone` | 위험 구역 | Danger Zone |
| `team.settings.deleteWarning` | 이 팀과 모든 하위 리소스(프로젝트, 다이어그램, 사전)가 영구 삭제됩니다. | This team and all its resources (projects, diagrams, dictionaries) will be permanently deleted. |
| `team.settings.deleteButton` | 팀 삭제 | Delete Team |
| `team.settings.deleteConfirmTitle` | 팀 삭제 확인 | Confirm Team Deletion |
| `team.settings.deleteConfirmDescription` | 확인을 위해 팀 이름 "{{name}}"을 정확히 입력하세요. | Type the team name "{{name}}" to confirm. |
| `team.settings.deleteConfirmPlaceholder` | 팀 이름 입력 | Type team name |
| `team.toast.updated` | 팀 이름이 변경되었습니다 | Team name updated |
| `team.toast.updateFailed` | 팀 이름 변경에 실패했습니다 | Failed to update team name |
| `team.toast.deleted` | 팀이 삭제되었습니다 | Team deleted |
| `team.toast.deleteFailed` | 팀 삭제에 실패했습니다 | Failed to delete team |
| `team.aria.settings` | 팀 설정 | Team settings |

### 8.2 프로젝트 설정

| 키 | ko | en |
|----|----|----|
| `project.settings.title` | 프로젝트 설정 | Project Settings |
| `project.settings.nameLabel` | 프로젝트 이름 | Project Name |
| `project.settings.descriptionLabel` | 설명 | Description |
| `project.settings.descriptionPlaceholder` | 프로젝트 설명을 입력하세요 (선택) | Enter project description (optional) |
| `project.settings.cancel` | 취소 | Cancel |
| `project.settings.save` | 저장 | Save |
| `project.toast.updated` | 프로젝트가 수정되었습니다 | Project updated |
| `project.toast.updateFailed` | 프로젝트 수정에 실패했습니다 | Failed to update project |
| `project.aria.settings` | 프로젝트 {{name}} 설정 | Settings for project {{name}} |
| `project.list.noDescription` | 설명 없음 | No description |

### 8.3 DDL 내보내기

| 키 | ko | en |
|----|----|----|
| `erd.ddlExport.title` | SQL DDL 내보내기 | Export SQL DDL |
| `erd.ddlExport.dbmsLabel` | 대상 DBMS | Target DBMS |
| `erd.ddlExport.dbms.postgresql` | PostgreSQL | PostgreSQL |
| `erd.ddlExport.dbms.mysql` | MySQL | MySQL |
| `erd.ddlExport.dbms.oracle` | Oracle | Oracle |
| `erd.ddlExport.dbms.sqlserver` | SQL Server | SQL Server |
| `erd.ddlExport.dbms.ansi` | 범용 SQL (ANSI) | Generic SQL (ANSI) |
| `erd.ddlExport.preview` | 미리보기 | Preview |
| `erd.ddlExport.copy` | 클립보드 복사 | Copy to Clipboard |
| `erd.ddlExport.download` | 파일 다운로드 | Download File |
| `erd.ddlExport.copied` | 클립보드에 복사되었습니다 | Copied to clipboard |
| `erd.ddlExport.copyFailed` | 클립보드 복사에 실패했습니다 | Failed to copy to clipboard |
| `erd.ddlExport.noTables` | 내보낼 테이블이 없습니다 | No tables to export |
| `erd.toolbar.ddlExport` | SQL DDL | SQL DDL |

### 8.4 권한 관련

| 키 | ko | en |
|----|----|----|
| `permission.viewerReadonly` | 조회 권한만 있습니다 | You have view-only access |

---

## 9. 파일 배치 계획

### 9.1 생성할 파일

| 파일 경로 | 담당 | 설명 |
|-----------|------|------|
| `src/main/java/com/smarterd/api/team/dto/UpdateTeamRequest.java` | be | 팀 수정 요청 DTO |
| `src/main/java/com/smarterd/api/team/dto/MyRoleResponse.java` | be | 내 역할 응답 DTO |
| `src/main/java/com/smarterd/api/project/dto/UpdateProjectRequest.java` | be | 프로젝트 수정 요청 DTO |
| `client/src/hooks/useTeamRole.ts` | fe | 팀 역할 조회 훅 |
| `client/src/components/team/TeamSettingsDialog.tsx` | fe | 팀 설정 다이얼로그 |
| `client/src/components/project/ProjectSettingsDialog.tsx` | fe | 프로젝트 설정 다이얼로그 |
| `client/src/components/erd/DdlExportDialog.tsx` | fe | DDL 내보내기 다이얼로그 |
| `client/src/components/ui/textarea.tsx` | fe | shadcn/ui Textarea |
| `client/src/lib/ddl-generator.ts` | fe | DDL 생성 순수 함수 |

### 9.2 수정할 파일

| 파일 경로 | 담당 | 변경 내용 |
|-----------|------|-----------|
| **백엔드** | | |
| `domain/team/entity/Team.java` | be | `rename()` 메서드 추가 |
| `domain/project/entity/Project.java` | be | `description` 필드 + `update()` 메서드 추가 |
| `domain/common/message/MessageCode.java` | be | `ERROR_ACCESS_DENIED_VIEWER_READONLY` 추가 |
| `domain/team/service/TeamService.java` | be | `getMyRole()`, `updateTeam()`, `deleteTeam()`, `verifyEditable()` 추가 + repository 의존성 추가 |
| `domain/project/service/ProjectService.java` | be | `updateProject()` 추가, `createProject()`/`deleteProject()` 권한 변경 |
| `domain/diagram/service/DiagramService.java` | be | `verifyAccess` -> `verifyReadAccess`/`verifyWriteAccess` 분리 |
| `domain/dictionary/service/DomainService.java` | be | 쓰기 메서드 `verifyEditable` 적용 |
| `domain/dictionary/service/TermService.java` | be | 쓰기 메서드 `verifyEditable` 적용 |
| `api/team/TeamController.java` | be | `getMyRole()`, `updateTeam()`, `deleteTeam()` 엔드포인트 추가 |
| `api/project/ProjectController.java` | be | `updateProject()` 엔드포인트 추가 |
| `api/project/dto/ProjectResponse.java` | be | `description` 필드 추가 |
| `domain/diagram/repository/DiagramRepository.java` | be | `deleteByProjectIn()` 추가 |
| `domain/project/repository/ProjectRepository.java` | be | `deleteByTeam()` 추가 |
| `domain/dictionary/repository/DomainRepository.java` | be | `deleteByTeam()` 추가 |
| `domain/dictionary/repository/TermRepository.java` | be | `deleteByTeam()` 추가 |
| `src/main/resources/i18n/messages.properties` | be | 신규 메시지 코드 추가 |
| `src/main/resources/i18n/messages_ko.properties` | be | 신규 메시지 코드 추가 |
| **프론트엔드** | | |
| `client/src/types/team.ts` | fe | `MyRoleResponse` 타입 추가 |
| `client/src/types/project.ts` | fe | `description` 필드 추가 |
| `client/src/types/erd.ts` | fe | `DbmsType` 타입 추가 |
| `client/src/api/teamApi.ts` | fe | `fetchMyRole()`, `updateTeam()`, `deleteTeam()` 추가 |
| `client/src/api/projectApi.ts` | fe | `updateProject()` 추가 |
| `client/src/constants/query-keys.ts` | fe | `teams.myRole` 키 추가 |
| `client/src/pages/project/ProjectsPage.tsx` | fe | `useTeamRole` 연동, 역할별 버튼 조건부 렌더링, TeamSettingsDialog/ProjectSettingsDialog 통합 |
| `client/src/pages/diagram/DiagramsPage.tsx` | fe | `useTeamRole` 연동, 역할별 버튼 조건부 렌더링 |
| `client/src/pages/diagram/DiagramPage.tsx` | fe | `useTeamRole` 연동, canEdit을 Header/Sidebar/ERDCanvas에 전달 |
| `client/src/pages/dictionary/DictionaryPage.tsx` | fe | `useTeamRole` 연동, canEdit을 DomainTab/TermTab에 전달 |
| `client/src/components/erd/CanvasToolbar.tsx` | fe | `canEdit` prop + DDL 내보내기 메뉴 항목 추가 |
| `client/src/components/erd/ERDCanvas.tsx` | fe | `canEdit` prop + 읽기 전용 모드 적용 + ErdPermissionContext |
| `client/src/components/erd/TableNode.tsx` | fe | ErdPermissionContext 소비, 편집 비활성화 |
| `client/src/components/layout/Header.tsx` | fe | `canEdit` prop + 저장 버튼 조건부 |
| `client/src/components/layout/Sidebar.tsx` | fe | `canEdit` prop + 추가/삭제/이름변경 조건부 |
| `client/src/components/layout/SidebarTableItem.tsx` | fe | `canEdit` prop + 삭제/이름변경 조건부 |
| `client/src/components/team/MembersDialog.tsx` | fe | `isAdmin` prop + 초대/제거/역할변경 제한 |
| `client/src/components/dictionary/DomainTab.tsx` | fe | `canEdit` prop + CRUD 버튼 조건부 |
| `client/src/components/dictionary/TermTab.tsx` | fe | `canEdit` prop + CRUD 버튼 조건부 |
| `client/src/i18n/locales/ko/translation.json` | fe | 신규 i18n 키 추가 |
| `client/src/i18n/locales/en/translation.json` | fe | 신규 i18n 키 추가 |

---

## 10. 태스크 분해

### Phase A: 기반 작업 (BE/FE 병렬)

| # | 태스크 | 담당 | 의존 | 예상 파일 수 | 설명 |
|---|--------|------|------|------------|------|
| A-1 | Entity 변경 + 신규 DTO + MessageCode + i18n (BE) | be | -- | 8 | Team.rename(), Project.description+update(), UpdateTeamRequest, UpdateProjectRequest, MyRoleResponse, MessageCode 추가, messages*.properties |
| A-2 | Repository 벌크 삭제 메서드 추가 | be | -- | 4 | DiagramRepository.deleteByProjectIn(), ProjectRepository.deleteByTeam(), DomainRepository.deleteByTeam(), TermRepository.deleteByTeam() |
| A-3 | 타입 정의 + API 모듈 + 상수 + i18n (FE) | fe | -- | 8 | types/(team, project, erd), api/(teamApi, projectApi), constants/query-keys, translation.json (ko/en) |
| A-4 | useTeamRole 훅 + Textarea UI | fe | A-3 | 2 | hooks/useTeamRole.ts, components/ui/textarea.tsx |

### Phase B: 핵심 서비스/컴포넌트 (Phase A 완료 후, BE/FE 병렬)

| # | 태스크 | 담당 | 의존 | 예상 파일 수 | 설명 |
|---|--------|------|------|------------|------|
| B-1 | TeamService 변경 (getMyRole, updateTeam, deleteTeam, verifyEditable) | be | A-1, A-2 | 1 | 신규 메서드 4개 + repository 의존성 추가 |
| B-2 | TeamController 엔드포인트 추가 | be | B-1 | 1 | getMyRole, updateTeam, deleteTeam 3개 엔드포인트 |
| B-3 | ProjectService 변경 (updateProject + 권한 강화) + ProjectResponse 변경 | be | B-1 | 3 | updateProject 추가, create/delete의 verifyEditable 적용, description 필드 추가 |
| B-4 | ProjectController 엔드포인트 추가 | be | B-3 | 1 | updateProject 엔드포인트 |
| B-5 | DiagramService 권한 강화 | be | B-1 | 1 | verifyReadAccess/verifyWriteAccess 분리 |
| B-6 | DomainService + TermService + BulkService 권한 강화 | be | B-1 | 4 | 쓰기 메서드 verifyEditable 적용 |
| B-7 | TeamSettingsDialog 구현 | fe | A-4 | 1 | 팀 이름 변경 + 삭제 확인 다이얼로그 |
| B-8 | ProjectSettingsDialog 구현 | fe | A-4 | 1 | 프로젝트 이름/설명 편집 다이얼로그 |
| B-9 | DDL 생성기 구현 | fe | A-3 | 1 | lib/ddl-generator.ts -- 순수 함수 (서버 의존 없음) |
| B-10 | DdlExportDialog 구현 | fe | B-9 | 1 | DBMS 선택 + Monaco 미리보기 + 복사/다운로드 |

### Phase C: 페이지 통합 (Phase B 완료 후)

| # | 태스크 | 담당 | 의존 | 예상 파일 수 | 설명 |
|---|--------|------|------|------------|------|
| C-1 | ProjectsPage 역할 연동 | fe | B-7, B-8 | 1 | useTeamRole 통합, 팀 설정/프로젝트 설정/역할별 버튼 |
| C-2 | DiagramsPage 역할 연동 | fe | A-4 | 1 | useTeamRole, 생성/삭제/이름변경 버튼 조건부 |
| C-3 | DiagramPage + Header + Sidebar 역할 연동 | fe | B-10 | 4 | useTeamRole, canEdit 전파 (Header, Sidebar, SidebarTableItem) |
| C-4 | ERDCanvas + CanvasToolbar + TableNode 권한 적용 | fe | C-3 | 3 | ErdPermissionContext, canEdit prop, DDL 내보내기 메뉴 |
| C-5 | MembersDialog 권한 적용 | fe | A-4 | 1 | isAdmin prop, 초대/제거/역할변경 제한 |
| C-6 | DictionaryPage + DomainTab + TermTab 권한 적용 | fe | A-4 | 3 | useTeamRole + canEdit prop 전달 |

### Phase D: 마무리

| # | 태스크 | 담당 | 의존 | 설명 |
|---|--------|------|------|------|
| D-1 | Prettier 포맷 적용 | be+fe | C-* | `npm run format` 전체 실행 |
| D-2 | 빌드 검증 | be+fe | D-1 | `./gradlew compileJava` + `cd client && npm run build` |

---

## 11. BE 개발자 작업 목록 (순서)

```
1. [A-1] Entity 변경 + 신규 DTO + MessageCode + i18n
   - Team.java: rename() 메서드 추가
   - Project.java: description 필드 + update() 메서드 + Builder 수정
   - MessageCode.java: ERROR_ACCESS_DENIED_VIEWER_READONLY 추가
   - UpdateTeamRequest.java 생성
   - UpdateProjectRequest.java 생성
   - MyRoleResponse.java 생성
   - messages.properties: error.access-denied.viewer-readonly 추가
   - messages_ko.properties: 한글 메시지 추가

2. [A-2] Repository 벌크 삭제 메서드
   - DiagramRepository: deleteByProjectIn(List<Project>) 추가
   - ProjectRepository: deleteByTeam(Team) 추가
   - DomainRepository: deleteByTeam(Team) 추가
   - TermRepository: deleteByTeam(Team) 추가

3. [B-1] TeamService 변경
   - verifyEditable() public 메서드 추가
   - getMyRole() 메서드 추가
   - updateTeam() 메서드 추가
   - deleteTeam() 메서드 추가
   - Repository 의존성 추가 (ProjectRepository, DiagramRepository, DomainRepository, TermRepository)

4. [B-2] TeamController 엔드포인트
   - GET /{teamId}/me -- getMyRole
   - PUT /{teamId} -- updateTeam
   - DELETE /{teamId} -- deleteTeam

5. [B-3] ProjectService + ProjectResponse 변경
   - updateProject() 추가
   - createProject(), deleteProject()의 verifyMembership -> verifyEditable
   - ProjectResponse: description 필드 추가 + from() 수정

6. [B-4] ProjectController 엔드포인트
   - PUT /{projectId} -- updateProject

7. [B-5] DiagramService 권한 강화
   - verifyAccess -> verifyReadAccess / verifyWriteAccess 분리
   - 읽기 메서드: verifyReadAccess
   - 쓰기 메서드: verifyWriteAccess

8. [B-6] DomainService + TermService + BulkService 권한 강화
   - DomainService: create/update/delete의 verifyMembership -> verifyEditable
   - TermService: create/update/delete의 verifyMembership -> verifyEditable
   - DomainBulkService: bulkSave의 verifyMembership -> verifyEditable
   - TermBulkService: bulkSave의 verifyMembership -> verifyEditable
```

## 12. FE 개발자 작업 목록 (순서)

```
1. [A-3] 타입 + API + 상수 + i18n
   - types/team.ts: MyRoleResponse 인터페이스 추가
   - types/project.ts: description 필드 추가
   - types/erd.ts: DbmsType 타입 추가
   - api/teamApi.ts: fetchMyRole, updateTeam, deleteTeam 추가
   - api/projectApi.ts: updateProject 추가
   - constants/query-keys.ts: teams.myRole 키 추가
   - i18n/locales/ko/translation.json: 신규 키 추가
   - i18n/locales/en/translation.json: 신규 키 추가

2. [A-4] useTeamRole 훅 + Textarea UI
   - hooks/useTeamRole.ts 생성
   - components/ui/textarea.tsx 생성

3. [B-7] TeamSettingsDialog 구현
   - components/team/TeamSettingsDialog.tsx 생성

4. [B-8] ProjectSettingsDialog 구현
   - components/project/ProjectSettingsDialog.tsx 생성

5. [B-9] DDL 생성기 구현
   - lib/ddl-generator.ts 생성

6. [B-10] DdlExportDialog 구현
   - components/erd/DdlExportDialog.tsx 생성

7. [C-1] ProjectsPage 역할 연동
   - pages/project/ProjectsPage.tsx 수정
     (useTeamRole, TeamSettingsDialog, ProjectSettingsDialog, 역할별 버튼)

8. [C-2] DiagramsPage 역할 연동
   - pages/diagram/DiagramsPage.tsx 수정

9. [C-3] DiagramPage + Header + Sidebar 역할 연동
   - pages/diagram/DiagramPage.tsx 수정
   - components/layout/Header.tsx 수정
   - components/layout/Sidebar.tsx 수정
   - components/layout/SidebarTableItem.tsx 수정

10. [C-4] ERDCanvas + CanvasToolbar + TableNode 권한 적용
    - components/erd/ERDCanvas.tsx 수정 (ErdPermissionContext 생성)
    - components/erd/CanvasToolbar.tsx 수정 (DDL 메뉴 + canEdit)
    - components/erd/TableNode.tsx 수정

11. [C-5] MembersDialog 권한 적용
    - components/team/MembersDialog.tsx 수정

12. [C-6] DictionaryPage + DomainTab + TermTab 권한 적용
    - pages/dictionary/DictionaryPage.tsx 수정
    - components/dictionary/DomainTab.tsx 수정
    - components/dictionary/TermTab.tsx 수정
```

---

## 13. 리스크 및 고려사항

### 13.1 팀 삭제 CASCADE

- **리스크**: `TeamService.deleteTeam()`에서 여러 repository를 직접 주입하면 의존성이 복잡해진다.
- **대안**: 각 도메인 서비스에 `deleteByTeam()` 메서드를 추가하여 위임하는 방법도 있으나, 순환 의존(`TeamService <-> ProjectService`)이 발생할 수 있다.
- **결정**: `TeamService`에서 repository를 직접 사용하여 cascade 삭제 구현. 서비스 간 순환 의존을 피하기 위함이다.

### 13.2 VIEWER 권한의 실시간 협업

- 현재 실시간 협업 시스템(Yjs/WebSocket)에서는 VIEWER가 편집 데이터를 보내도 Y.Doc에 반영될 수 있다.
- 5단계 범위에서는 **프론트엔드 레벨에서만 편집 UI를 차단**한다. 백엔드 저장 API(`PUT .../diagrams/{id}`)에서 `verifyEditable`이 VIEWER를 차단하므로, VIEWER가 저장을 시도하면 403이 반환된다.
- WebSocket 레벨의 VIEWER 차단은 향후 협업 고도화 시 구현한다.

### 13.3 ProjectResponse 하위 호환성

- `ProjectResponse`에 `description` 필드가 추가되면 기존 프론트엔드 `Project` 타입에도 반영해야 한다.
- `description`은 nullable이므로 `string | null`로 정의한다. 기존 프로젝트는 `null`로 반환된다.

### 13.4 DDL 생성기 정확성

- DDL 생성기는 프론트엔드 순수 함수로, ERD 에디터의 타입 정보(`Column.type`)를 그대로 사용한다.
- 사용자가 입력한 타입이 DBMS에 유효하지 않을 수 있으나, 변환하지 않고 그대로 출력한다 (사용자 책임).
- 예약어 충돌 방지를 위해 테이블명/컬럼명을 항상 인용 부호로 감싼다.

### 13.5 canEdit 전파 전략

- `canEdit`은 여러 컴포넌트에 전달되어야 한다. ERD 에디터 내부에서는 React Context(`ErdPermissionContext`)를 사용하고, 페이지 레벨에서는 prop drilling을 사용한다.
- 이유: ERD 에디터는 TableNode 등 깊은 중첩이 있어 Context가 적합하지만, 페이지 레벨은 1-2단계 prop 전달로 충분하다.
