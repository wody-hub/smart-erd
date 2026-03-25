#    CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

- **항상 한글로 답변한다.**

## Build & Run Commands

### Backend (Spring Boot)

```bash
./gradlew bootRun                    # Start backend on :9500 (Docker PostgreSQL auto-start)
./gradlew build                      # Full build (compile + test)
./gradlew test                       # Run all tests
./gradlew test --tests "com.smarterd.SomeTest.methodName"  # Single test
./gradlew clean build                # Clean rebuild
./gradlew compileJava                # Compile only (triggers QueryDSL/Lombok annotation processors)
```

### Frontend (Vite + React)

```bash
cd client
npm run dev                          # Dev server on :4500, proxies /api → :9500
npm run build                        # Production build (tsc + vite)
npm run lint                         # ESLint
```

**Note:** npm has cache permission issues on this machine. Use `--cache /tmp/npm-cache-smarterd` for install commands.

### Formatting (Prettier — Java + TypeScript unified)

```bash
npm run format                       # Format all (Java + TypeScript)
npm run format:java                  # Java only
npm run format:client                # TypeScript only
npm run format:check                 # Check formatting (CI)
```

### Environment Variables

| Variable               | Description              | Default                                   |
| ---------------------- | ------------------------ | ----------------------------------------- |
| `SMART_ERD_JWT_SECRET` | JWT signing key (Base64) | Dev default embedded in `application.yml` |

## Code Quality — SonarQube 준수

- **SonarQube / SonarLint 규칙을 최대한 준수한다.** 코드 작성 시 SonarQube가 경고하는 코드 스멜, 버그, 취약점을 사전에 방지한다.
- null 반환 대신 빈 컬렉션/빈 배열 반환 (`Return an empty array instead of null`)
- 사용하지 않는 변수/import 제거
- 인라인 조건문 대신 명시적 블록 사용
- 예외를 무시하지 않고 적절히 처리 또는 로깅
- Prettier와 충돌하는 S1611(람다 괄호)은 Prettier 우선으로 억제 (`sonar-project.properties`, VS Code `sonarlint.rules`)

## Architecture

### Backend: Spring Boot 3.5.11 / Java 25

Base package: `com.smarterd`

```text
src/main/java/com/smarterd/
├── SmartErdApplication.java         # Application entry point (@SpringBootApplication)
├── package-info.java                # @NonNullApi (non-null by default for all sub-packages)
├── api/                             # HTTP interface layer (Controller + DTO only)
│   ├── auth/                        #   AuthController (login, signup) + dto/ (record)
│   ├── team/                        #   TeamController (CRUD + members) + dto/
│   ├── project/                     #   ProjectController (CRUD) + dto/
│   ├── dictionary/                  #   DomainController, TermController (CRUD) + dto/
│   └── common/                      #   GlobalExceptionHandler (404/403/409/400 mapping)
├── config/                          # Configuration
│   ├── SecurityConfig.java          #   Spring Security (OAuth2 Resource Server JWT, CSRF disabled)
│   ├── JwtConfig.java               #   JwtEncoder / JwtDecoder beans (NimbusJwtDecoder, HS256)
│   ├── JwtProperties.java           #   @ConfigurationProperties("smart-erd.jwt")
│   ├── CorsConfig.java              #   @ConfigurationProperties("smart-erd.cors")
│   ├── LocaleConfig.java            #   AcceptHeaderLocaleResolver (ko/en, default: en)
│   ├── ValidationConfig.java        #   LocalValidatorFactoryBean + MessageSource
│   ├── QuerydslConfig.java          #   JPAQueryFactory bean
│   ├── BlazeConfig.java             #   CriteriaBuilderFactory bean
│   ├── OpenApiConfig.java           #   Swagger/OpenAPI config (JWT Bearer auth)
│   └── PrettySqlFormat.java         #   p6spy SQL formatter
└── domain/                          # Domain layer (Services live here too)
    ├── common/
    │   ├── entity/                   #   BaseTimeEntity (createdAt, updatedAt auto-audit)
    │   └── exception/               #   LocalizedException + 4 subtypes (404/403/409/400)
    ├── user/                        #   User, RefreshToken, AuthService, JwtTokenService
    ├── team/                        #   Team, TeamMember(@IdClass), TeamService
    ├── project/                     #   Project, ProjectService
    ├── diagram/                     #   Diagram (TEXT content — serialized React Flow JSON)
    └── dictionary/                  #   Domain, Term, DomainService, TermService
```

**Entity ownership chain:** User → Team → (Project → Diagram, Domain, Term). TeamMember is a join table with `@IdClass(TeamMemberId)` record composite key (team_id + user_id) and role enum (ADMIN, MEMBER, VIEWER).

**Package convention:** `api/` layer holds HTTP interface only (Controller + DTO). Business logic (Service) resides in `domain/` layer under the relevant domain package. DTOs are Java `record` types with `@Valid` annotations.

**Security:** JWT stateless auth with Spring Security OAuth2 Resource Server. Built-in `BearerTokenAuthenticationFilter` validates Bearer tokens via `JwtDecoder` (NimbusJwtDecoder, HMAC-SHA256).

| Path                                | Access        |
| ----------------------------------- | ------------- |
| `/api/auth/**`                      | Public        |
| `/swagger-ui/**`, `/v3/api-docs/**` | Public        |
| All other paths                     | Authenticated |

**Configuration:** Custom properties are namespaced under `smart-erd.*` in `application.yml`. JWT and CORS settings use `@ConfigurationProperties` for type-safe binding (`smart-erd.jwt.*`, `smart-erd.cors.*`).

**Backend i18n:** All error messages localized via Spring `MessageSource`. Bundles: `src/main/resources/i18n/messages.properties` (en) + `messages_ko.properties` (ko). `AcceptHeaderLocaleResolver` resolves locale from `Accept-Language` header. Bean Validation `{key}` interpolation connected to `MessageSource` via `ValidationConfig`. Frontend sends `Accept-Language: i18n.language` on every request.

**Database:** PostgreSQL 17 (Docker). `spring-boot-docker-compose`가 `compose.yaml`을 자동 감지하여 컨테이너를 시작하고, datasource를 자동 주입한다. `ddl-auto: update`. Docker Desktop이 실행 중이어야 한다.

**SQL 로깅:** p6spy로 실제 바인딩 파라미터가 채워진 완성 SQL 로깅. `PrettySqlFormat` (FormatStyle.BASIC). 설정: `spy.properties` + `application.yml` (`decorator.datasource.p6spy.*`). Hibernate 기본 `show-sql`/`format_sql`은 미사용.

### Frontend: Vite 6 + React 19 + TypeScript + shadcn/ui + React Query

```text
client/
├── index.html                       # SPA entry point
├── package.json                     # "type": "module" (ESM)
├── tailwind.config.js               # CSS variable colors, darkMode: ["class"]
├── vite.config.ts                   # @/ alias → ./src, proxy /api → :9500
├── tsconfig.app.json                # paths: { "@/*": ["./src/*"] }
└── src/
    ├── main.tsx                     # createRoot + StrictMode
    ├── App.tsx                      # QueryClientProvider + BrowserRouter + Routes
    ├── index.css                    # Tailwind directives + CSS variables (light/dark)
    ├── i18n/
    │   ├── index.ts                 # i18next initialization (LanguageDetector + initReactI18next)
    │   ├── i18next.d.ts             # Type augmentation (translation key autocomplete)
    │   └── locales/{en,ko}/         # translation.json (~200 keys each)
    ├── api/
    │   ├── axiosInstance.ts         # baseURL: /api, JWT auto-attach + 401 Refresh Token rotation
    │   ├── authApi.ts               # login(), signup()
    │   ├── teamApi.ts               # fetchTeams(), fetchTeam(), createTeam(), fetchMembers(), inviteMember(), removeMember()
    │   ├── projectApi.ts            # fetchProjects(), createProject(), deleteProject()
    │   ├── diagramApi.ts            # fetchDiagrams(), fetchDiagram(), createDiagram(), saveDiagram(), renameDiagram(), deleteDiagram()
    │   ├── domainApi.ts             # fetchDomains(), createDomain(), updateDomain(), deleteDomain()
    │   └── termApi.ts               # fetchTerms(), createTerm(), updateTerm(), deleteTerm()
    ├── constants/
    │   ├── keybindings.ts           # KEYBINDINGS — keyboard shortcut key registry
    │   ├── storage.ts               # STORAGE_KEYS — localStorage key constants
    │   ├── routes.ts                # ROUTES — route path constants
    │   └── query-keys.ts            # queryKeys — React Query cache key hierarchy
    ├── hooks/
    │   ├── useInlineEdit.ts         # Inline text editing (startEdit, confirmEdit, cancelEdit)
    │   └── useFkConnectMode.ts      # FK connect mode (parent→child 2-click flow)
    ├── components/
    │   ├── auth/ProtectedRoute.tsx   # Auth guard (redirects to /login)
    │   ├── erd/                      # ERDCanvas, TableNode, CanvasToolbar, EdgeContextMenu, DeleteEdgeDialog
    │   ├── layout/                   # Header, LanguageSwitcher, Sidebar, SidebarTableItem
    │   ├── dictionary/               # DomainTab, TermTab, DomainFormDialog, TermFormDialog
    │   ├── team/MembersDialog.tsx    # Team member management
    │   └── ui/                       # shadcn/ui + confirm-dialog, create-resource-dialog, spinner
    ├── lib/
    │   ├── utils.ts                 # cn() = clsx + tailwind-merge
    │   ├── api-error.ts             # getErrorMessage() — server error extraction
    │   ├── query-client.ts          # QueryClient (staleTime: 30s, retry: 1)
    │   └── auto-layout.ts           # dagre-based auto layout (LR direction)
    ├── pages/                       # auth/, team/, project/, dictionary/, diagram/
    ├── stores/
    │   ├── useAuthStore.ts          # Zustand: auth state + localStorage sync
    │   └── useCanvasStore.ts        # Zustand: nodes, edges, serialize/deserialize
    └── types/                       # erd.ts, auth.ts, team.ts, project.ts, diagram.ts, dictionary.ts
```

**Frontend conventions:**

- `api/` — API module per domain. Pages never call `axiosInstance` directly.
- `constants/` — Magic strings forbidden. All localStorage keys, route paths, query keys defined as constants.
- `types/` — Shared TypeScript interfaces per domain. Inline type definitions in pages forbidden.
- `hooks/` — Reusable custom hooks. Extract when pattern repeats across 2+ components.
- `components/ui/` — Reusable primitives (shadcn/ui + shared dialogs). No domain logic.
- `components/{domain}/` — Domain-specific components (dictionary, team, auth, erd, layout).
- `pages/` — Domain-based subdirectories. Each page groups code in standard order (see "Page Component Code Ordering").
- `lib/` — Pure utility functions and configurations (no React dependencies except query-client).
- Use `@/` alias for imports (`@/components/ui/button`, `@/lib/utils`).
- State management: Zustand for client-only state (`stores/`), React Query for server state.
- ESM only (`"type": "module"`) — never use `require()`, use ESM imports.
- Adding new shadcn/ui components: create file in `components/ui/`, use `cn()`, `ref`는 일반 prop으로 전달 (`forwardRef` 사용 금지 — React 19).
- **i18n (Frontend):** `react-i18next` — `t('key')` 사용, 하드코딩 문자열 금지. Key convention: `{domain}.{screen}.{usage}`. `useTranslation()` 위치: `useQueryClient` 다음.
- **i18n (Backend):** 예외는 message code 사용 (예: `"error.not-found.user"`), `GlobalExceptionHandler`가 `MessageSource` + `Locale`로 해석. DTO 검증: `@NotBlank(message = "{validation.not-blank.login-id}")`.

**Routes:** `/login`, `/signup`, `/teams`, `/teams/:teamId/projects`, `/teams/:teamId/dictionary`, `/teams/:teamId/projects/:projectId/diagrams`, `/teams/:teamId/projects/:projectId/diagrams/:diagramId`. All routes except `/login` and `/signup` are protected by `ProtectedRoute`.

### Axios Instance

```text
baseURL: /api  →  Vite 프록시  →  localhost:9500
요청 인터셉터: Accept-Language (i18n.language) + localStorage Access Token → Authorization: Bearer <token>
응답 인터셉터: 401 → Refresh Token으로 갱신 시도 (큐 패턴) → 실패 시 로그인 리다이렉트
```

- 페이지에서 `axiosInstance`를 직접 호출하지 않는다. `api/` 모듈 함수를 통해서만 호출.
- 서버 에러 메시지 추출: `getErrorMessage(err, fallback)` (`lib/api-error.ts`)
- 401 발생 시 큐 패턴으로 동시 요청 관리: 갱신 중 다른 401 요청은 큐에 대기 → 갱신 완료 후 일괄 재시도

### Key Conventions

- **Handle IDs:** `{nodeId}-{colId}-source` / `{nodeId}-{colId}-target` — enables column-level relationships
- **Edge IDs:** `e-{sourceHandle}-{targetHandle}`
- **extractColId helper:** `extractColId(handleId, nodeId)` — Handle ID에서 컬럼 ID 추출 (`useCanvasStore.ts`)
- **Diagram persistence:** `useCanvasStore.serialize()` → JSON string stored in `Diagram.content` (TEXT)
- **Type assertion needed:** `applyNodeChanges()` returns generic `Node[]`, must cast to `Node<TableNodeData>[]`
- **Keyboard shortcuts:** `constants/keybindings.ts`의 `KEYBINDINGS` + `useHotkeys()`. 네이티브 `addEventListener('keydown')` + 매직 스트링 금지.
- **KEYBINDINGS registry:** `SAVE` (`mod+s`), `DELETE` (`delete, backspace`), `ESCAPE` (`escape`)

### Entity Relationships

```text
User ─┬─< TeamMember >─── Team ─┬─< Project ─< Diagram
      │   (record 복합키)        ├─< Domain
      └── owner_id ─────────────┘└─< Term ──> Domain (nullable)
```

- **User** : 사용자 (`loginId`로 인증, BCrypt 비밀번호)
- **Team** : 프로젝트와 데이터 사전을 소유하는 조직 단위
- **TeamMember** : 팀-사용자 다대다 조인 (`@IdClass(TeamMemberId)` record, 역할: ADMIN, MEMBER, VIEWER)
- **Project** : ERD 프로젝트 그룹 (Team 소속)
- **Diagram** : React Flow JSON을 TEXT로 저장하는 ERD 다이어그램 (Project 소속)
- **Domain** : 논리명→물리 데이터타입 매핑 사전 (예: "금액" → `DECIMAL(15,2)`)
- **Term** : 논리명→물리명 매핑 사전 (예: "사용자명" → `user_name`), Domain 참조 가능

모든 엔티티는 `BaseTimeEntity`를 상속하여 `createdAt`, `updatedAt`을 UTC 기준 `Instant`로 자동 기록한다.

### API Endpoints

#### 인증 (`/api/auth/**` — 공개)

| Method | Path                | 설명      | Request Body                       | Response                                       |
| ------ | ------------------- | --------- | ---------------------------------- | ---------------------------------------------- |
| POST   | `/api/auth/signup`  | 회원가입  | `{ loginId, password (8+), name }` | `{ accessToken, refreshToken, loginId, name }` |
| POST   | `/api/auth/login`   | 로그인    | `{ loginId, password }`            | `{ accessToken, refreshToken, loginId, name }` |
| POST   | `/api/auth/refresh` | 토큰 갱신 | `{ refreshToken }`                 | `{ accessToken, refreshToken }`                |
| POST   | `/api/auth/logout`  | 로그아웃  | `{ refreshToken }`                 | —                                              |

#### 팀 (`/api/teams/**` — 인증 필요)

| Method | Path                               | 설명       | Request Body        |
| ------ | ---------------------------------- | ---------- | ------------------- |
| POST   | `/api/teams`                       | 팀 생성    | `{ name }`          |
| GET    | `/api/teams`                       | 내 팀 목록 | —                   |
| GET    | `/api/teams/{id}`                  | 팀 상세    | —                   |
| GET    | `/api/teams/{id}/members`          | 멤버 목록  | —                   |
| POST   | `/api/teams/{id}/members`          | 멤버 초대  | `{ loginId, role }` |
| DELETE | `/api/teams/{id}/members/{userId}` | 멤버 제거  | —                   |
| PATCH  | `/api/teams/{id}/members/{userId}` | 역할 변경  | `{ role }`          |

#### 프로젝트 (`/api/teams/{teamId}/projects/**`)

| Method | Path       | 설명          | Request Body |
| ------ | ---------- | ------------- | ------------ |
| POST   | `/`        | 프로젝트 생성 | `{ name }`   |
| GET    | `/`        | 프로젝트 목록 | —            |
| GET    | `/{id}`    | 프로젝트 상세 | —            |
| DELETE | `/{id}`    | 프로젝트 삭제 | —            |

#### 도메인 사전 (`/api/teams/{teamId}/domains/**`)

CRUD (5 endpoints): POST 생성, GET 목록, GET `/{domainId}` 상세, PUT `/{domainId}` 수정, DELETE `/{domainId}` 삭제
Body: `{ logicalName, physicalType, description? }`

#### 용어 사전 (`/api/teams/{teamId}/terms/**`)

CRUD (5 endpoints): POST 생성, GET 목록, GET `/{termId}` 상세, PUT `/{termId}` 수정, DELETE `/{termId}` 삭제
Body: `{ logicalName, physicalName, domainId?, description? }`

Swagger UI: `http://localhost:9500/swagger-ui/index.html`

### Authentication Flow

```text
Client                                    Server
  │ POST /api/auth/login {loginId, pw} ──► AuthenticationManager 검증
  │ ◄── {accessToken, refreshToken}        Access(30분) + Refresh(24시간) 발급
  │ GET /api/... Authorization: Bearer ──► JwtDecoder (HS256) 검증
  │ ◄── 200 OK / 401
  │ (401) POST /api/auth/refresh ────────► Refresh Token 검증 + 로테이션
  │ ◄── 새 Access + 새 Refresh              기존 Refresh 폐기
```

- **Access Token**: HMAC-SHA256 JWT, 만료 30분
- **Refresh Token**: UUID, 만료 24시간, 로테이션 전략 (사용 시 새 토큰 발급 + 기존 폐기)
- 프론트엔드는 `localStorage`에 두 토큰 저장, Axios 인터셉터로 자동 첨부

### Timezone Policy (UTC 표준화)

- **백엔드 엔티티 시간 타입:** `Instant` (Java Time)
- **DB 컬럼 타입:** `TIMESTAMP WITH TIME ZONE` (`timestamptz`)
- **JPA/Jackson 설정:** `hibernate.jdbc.time_zone: UTC`, `spring.jackson.time-zone: UTC`
- **API 응답 시간 포맷:** ISO-8601 UTC (예: `2026-02-09T07:23:34.065Z`)
- **프론트 표시:** 브라우저 로컬 시간대로 변환하되, 포맷은 현재 선택 언어(`i18n`) 기준으로 렌더링

### Error Response Format

모든 에러는 통일된 JSON 형식, `Accept-Language` 헤더에 따라 다국어 메시지 반환:

```text
Accept-Language: en → { "error": "User not found: testuser" }
Accept-Language: ko → { "error": "사용자를 찾을 수 없습니다: testuser" }
```

| HTTP 상태 | 발생 조건                            |
| --------- | ------------------------------------ |
| 400       | 유효성 검증 실패, 비즈니스 규칙 위반 |
| 401       | JWT 토큰 없음 또는 만료              |
| 403       | 팀 미소속, ADMIN 권한 필요           |
| 404       | 엔티티 미존재                        |
| 409       | 중복 리소스 (멤버, 로그인 ID)        |

### Tech Stack

| Layer         | Stack                                                                            |
| ------------- | -------------------------------------------------------------------------------- |
| Backend       | Spring Boot 3.5.11, Java 25, Gradle 8.12, Spring Security 6.x, Spring Data JPA   |
| Query         | QueryDSL 5.1.0:jakarta, Blaze-Persistence 1.6.17                                 |
| Auth          | Spring OAuth2 Resource Server (HMAC-SHA256 JWT + Refresh Token rotation), BCrypt |
| DB            | PostgreSQL 17 (Docker), Testcontainers (test)                                    |
| Frontend      | React 19, TypeScript 5.6, Vite 6, Tailwind CSS 3.4, shadcn/ui                    |
| Data Fetching | @tanstack/react-query 5 (useQuery, useMutation, cache invalidation)              |
| ERD Canvas    | @xyflow/react 12, Zustand 5                                                      |
| Layout/Editor | dagre 0.8, @monaco-editor/react 4.6                                              |
| Shortcuts     | react-hotkeys-hook 5                                                             |
| i18n          | i18next, react-i18next (FE) + Spring MessageSource (BE)                          |
| Misc          | p6spy 1.12.1, Sonner, Prettier + prettier-plugin-java, ESLint, SonarQube        |

## SOLID 원칙 (MUST)

아키텍처와 코드는 반드시 SOLID 원칙을 준수해야 하며, 위반해서는 안 된다.

| 원칙 | 설명 | 점검 기준 |
|------|------|----------|
| **S — 단일 책임 원칙 (SRP)** | 하나의 클래스/모듈/훅은 하나의 변경 사유만 가진다 | 여러 관심사(렌더링+동기화+직렬화 등)가 하나의 파일에 혼재하면 위반 |
| **O — 개방-폐쇄 원칙 (OCP)** | 확장에는 열려 있고 수정에는 닫혀 있다 | 새 기능(플러그인, 핸들러, Projector 등) 추가 시 기존 코드 수정이 필요하면 위반 |
| **L — 리스코프 치환 원칙 (LSP)** | 구현체는 상위 타입의 계약을 준수한다 | 구현체가 예외를 던지거나 부분적으로만 동작하면 위반 |
| **I — 인터페이스 분리 원칙 (ISP)** | 클라이언트는 사용하지 않는 메서드에 의존하지 않는다 | 거대 인터페이스 대신 역할별 포트(Command/Query/Subscription)로 분리 |
| **D — 의존성 역전 원칙 (DIP)** | 상위 모듈은 하위 모듈의 구체 타입에 직접 의존하지 않는다 | View가 Y.Doc 등 CRDT 구현체에 직접 의존하면 위반. 추상(인터페이스/포트)에 의존 |

## Code Standards

### Modern Java Idioms (MUST follow)

- **`var`** / **`final var`** for local variables where type is obvious from RHS. Use `final var` for non-reassigned variables, `var` for reassigned variables: `final var user = findUserByLoginId(loginId);`
- **`record`** for DTOs and composite key classes: `public record TeamMemberId(Long team, Long user) implements Serializable {}`
- **`List.of()`** instead of `Collections.emptyList()` for immutable empty collections
- **Stream API** with `.toList()` for collection transformations
- **Optional** with `.orElseThrow()` for JPA single-entity lookups

### Import Rules

- **No wildcard imports (`.*`)** — all imports must be explicit
- Prettier auto-formats on save, VS Code `organizeImports` removes unused imports

### Exception Hierarchy

Use domain-specific custom exceptions (NOT `IllegalArgumentException`). All exceptions extend `LocalizedException` and carry a message code + args for i18n resolution.

| Exception                      | HTTP Status | Usage                                          |
| ------------------------------ | ----------- | ---------------------------------------------- |
| `EntityNotFoundException`      | 404         | Entity lookup failure                          |
| `DomainAccessDeniedException`  | 403         | Permission denied (not a member, not ADMIN)    |
| `DuplicateException`           | 409         | Duplicate resource (member, login ID)          |
| `BusinessException`            | 400         | Business rule violation (removing owner, etc.) |

All exceptions extend `LocalizedException(messageCode, messageArgs...)` in `domain/common/exception/`. `GlobalExceptionHandler` resolves the message code via `MessageSource` + request `Locale`.

```java
// Good — message code + args (resolved via MessageSource)
throw new EntityNotFoundException("error.not-found.user", loginId);
throw new DuplicateException("error.duplicate.login-id", request.loginId());

// Bad — hardcoded message string
throw new EntityNotFoundException("User not found: " + loginId);
```

### Transaction Pattern

- Class-level `@Transactional(readOnly = true)` — default read-only
- Method-level `@Transactional` override for writes only

### JPA Dirty Checking

Use setter methods for state changes, NOT delete+save:

```java
member.changeRole(request.role());  // Good — dirty checking
```

### Null Safety

- Root package `@NonNullApi` → non-null by default
- `@SuppressWarnings("null")` is forbidden in `src/main/**`; test code in `src/test/**` may use it when needed
- Method parameters must use Spring `@NonNull` (`org.springframework.lang.NonNull`)
- If SonarQube still reports null-related warnings even with `@NonNull`, add explicit guard with `Objects.requireNonNull(...)` at method entry

### QueryDSL Custom Repository Pattern

`@Query` JPQL 대신 QueryDSL `JPAQueryFactory`로 타입 안전한 쿼리를 작성한다. Spring Data의 Custom Repository 컨벤션을 따른다.

```text
XxxRepository (interface)
  extends JpaRepository<Xxx, Id>, XxxRepositoryCustom

XxxRepositoryCustom (interface)          — QueryDSL 메서드 시그니처
XxxRepositoryCustomImpl (class)          — QueryDSL 구현체 (JPAQueryFactory 주입)
```

**규칙:**

- Impl 클래스에 `@Repository`/`@Component` 붙이지 않음 (Spring Data가 `{Repository이름}Impl` 네이밍으로 자동 감지)
- `JPAQueryFactory`는 `@RequiredArgsConstructor`로 생성자 주입
- Q클래스는 static import로 사용: `import static com.smarterd.domain.xxx.entity.QXxx.xxx;`
- Bulk DELETE/UPDATE는 영속성 컨텍스트를 우회 (기존 `@Modifying`과 동일 동작)
- Spring Data 파생 쿼리 메서드(`findByUser`, `existsByTeamAndUser` 등)는 QueryDSL로 전환하지 않음

```java
@RequiredArgsConstructor
public class TeamRepositoryCustomImpl implements TeamRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public Optional<Team> findByIdWithOwner(Long id) {
        var result = queryFactory.selectFrom(team).join(team.owner).fetchJoin().where(team.id.eq(id)).fetchOne();
        return Optional.ofNullable(result);
    }
}
```

**Config 빈:** `QuerydslConfig` — `JPAQueryFactory` 빈 등록 (EntityManager 주입, 스레드 안전). `BlazeConfig` — `CriteriaBuilderFactory` 빈.

### Frontend Code Standards (MUST follow)

#### Data Fetching — React Query

Server state는 반드시 React Query (`useQuery`/`useMutation`)로 관리한다. 수동 `useEffect` + `useState(loading)` 패턴은 사용 금지.

```typescript
// Good — React Query
const { data: teams = [], isLoading } = useQuery({
    queryKey: queryKeys.teams.all,
    queryFn: fetchTeams,
});

// Bad — manual fetching
const [teams, setTeams] = useState([]);
useEffect(() => { fetchTeams().then(setTeams); }, []);
```

Mutation 후 캐시 무효화는 `invalidateQueries`로 선언적으로 수행. 에러 처리는 반드시 `toast.error()` + `getErrorMessage(err, t('key'))` 패턴 (인라인 에러 표시 금지).

```typescript
const createMutation = useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
        toast.success(t('teams.createSuccess'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('teams.createError'))),
});
```

인증 페이지(Login, Signup)를 포함한 **모든 페이지**에서 서버 변경 작업에 `useMutation`을 사용한다.

#### API Layer

- Pages never call `axiosInstance` directly. Always go through `api/` module functions.
- Each API function is typed with explicit return types and has JSDoc with `@param`.
- Error handling: `onError`에서 `toast.error(getErrorMessage(err, t('key')))` 패턴으로 통일.

#### Constants — No Magic Strings

- localStorage keys → `STORAGE_KEYS.*`
- Route paths → `ROUTES.*`
- React Query cache keys → `queryKeys.*`
- Keyboard shortcuts → `KEYBINDINGS.*` + `useHotkeys()` (네이티브 `addEventListener('keydown')` + 매직 스트링 금지)
- Inline string literals for these are forbidden.

#### Types — Shared Definitions

- All server response types are defined in `types/` directory, one file per domain.
- Inline interface definitions in page files are forbidden. Always import from `@/types/*`.

#### Shared Components — DRY

- Repeating UI patterns (2+ occurrences) must be extracted into shared components.
- `CreateResourceDialog` — generic create dialog (Team/Project/Diagram)
- `ConfirmDialog` — replaces `window.confirm()` with async-capable dialog
- `MembersDialog` — team member management (uses React Query internally)
- `Spinner` — loading spinner (Loader2 animate-spin + optional text)
- `useInlineEdit` hook — inline text editing pattern (SidebarTableItem, TableNode)
- `useFkConnectMode` hook — FK connection mode (2-click parent→child flow, column auto-naming)

#### Styling — Design Token System (MUST follow)

CSS Variable 기반 디자인 토큰 체계를 사용한다. **하드코딩 색상(`bg-gray-*`, `text-blue-*`, `#hex` 등)은 금지**한다.

**토큰 구조:**
```text
index.css (:root / .dark)  →  CSS Variable 정의 (HSL 값)
tailwind.config.js         →  Tailwind 시맨틱 색상 매핑 (hsl(var(--token)))
컴포넌트                    →  시맨틱 클래스 사용 (bg-card, text-muted-foreground 등)
```

**shadcn/ui 기본 토큰:** `bg-background`, `bg-card`, `bg-muted`, `bg-accent`, `bg-popover`, `text-foreground`, `text-muted-foreground`, `text-card-foreground`, `bg-primary`, `bg-secondary`, `bg-destructive`, `border-border`, `border-input`

**ERD 전용 토큰:** `bg-header`, `text-header-foreground`, `text-header-muted`, `bg-erd-table-header`, `text-erd-table-header-foreground`, `text-erd-pk`, `text-erd-fk`, `text-erd-nn`, `bg-erd-handle`, `border-erd-handle-border`, `text-erd-warning`

**규칙:**
- 새 컴포넌트에서 Tailwind 기본 팔레트 색상 직접 사용 금지
- 새 색상: `index.css` CSS Variable → `tailwind.config.js` 매핑 → 시맨틱 클래스
- 인터랙티브: `hover:bg-accent`, `focus:bg-accent`
- prop 색상: `hsl(var(--token-name))` 형식

#### Accessibility (a11y)

- **아이콘 전용 버튼**: 반드시 `aria-label` 속성 추가
- **토글 버튼**: `aria-label`에 대상 컨텍스트 포함
- **form 요소**: `<label>` 연결 불가 시 `aria-label` 추가
- shadcn/ui 컴포넌트는 Radix UI가 접근성 처리하므로 추가 작업 불필요

#### Page Component Code Ordering (MUST follow)

페이지 컴포넌트 내부의 코드는 다음 순서로 그룹핑하여 정렬한다:

| 순번 | 그룹 | 예시 |
|------|------|------|
| 1 | URL 파라미터 | `useParams` |
| 2 | 라우터 훅 | `useNavigate` |
| 3 | Query Client | `useQueryClient` |
| 3.5 | 다국어 | `useTranslation` |
| 4 | 로컬 상태 | `useState` |
| 5 | 스토어 셀렉터 | `useCanvasStore`, `useAuthStore` |
| 6 | 파생값/상수 | computed values |
| 7 | 쿼리 | `useQuery` |
| 8 | 뮤테이션 | `useMutation` |
| 9 | 이벤트 핸들러 | `handleSave`, `handleSubmit` 등 |
| 10 | 사이드 이펙트 | `useEffect` |
| 11 | 조건부 리턴 | loading/error early return |
| 12 | JSX | `return (...)` |

같은 그룹 내에서는 선언 순서를 자유롭게 하되, **그룹 간 순서는 반드시 준수**한다. `useEffect`가 쿼리/뮤테이션 사이에 끼어들지 않도록 주의한다.

#### Loading States

- 로딩 상태에는 `Spinner` 컴포넌트 (`components/ui/spinner.tsx`)를 사용한다
- `<p>Loading...</p>` 텍스트만 표시하는 것은 금지한다
- 사용법: `<Spinner text="Loading..." />`

#### Documentation — JSDoc

All functions, components, interfaces, and important variables must have JSDoc:

- **Functions**: Multi-line JSDoc with `@param` for each parameter and `@returns` for return value.
- **Interface fields**: Single-line `/** 설명 */` format.
- **State variables (`useState`)**: Single-line `/** 설명 */` above the declaration.
- **Constants**: Top-level `/** 설명 */` on the object + single-line on each field.
- **shadcn/ui components** (`components/ui/button.tsx` etc.): Auto-generated, JSDoc not required.

```typescript
/**
 * 팀에 멤버를 초대한다.
 *
 * @param teamId  대상 팀 ID
 * @param loginId 초대할 사용자 로그인 ID
 * @param role    부여할 역할 (MEMBER, VIEWER)
 */
export async function inviteMember(teamId: string, loginId: string, role: string): Promise<void> { ... }

export interface Team {
  /** 팀 고유 ID */
  id: number;
  /** 팀 이름 */
  name: string;
}

/** 삭제 확인 대상 프로젝트 ID (null이면 다이얼로그 닫힘) */
const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
```

### Formatting — Prettier

- Root `.prettierrc.json` with `prettier-plugin-java`
- Java: tabWidth 4, printWidth 120
- TypeScript: tabWidth 2, printWidth 100
- Prettier와 SonarQube S1611 충돌: **Prettier 우선** — `sonar-project.properties`에서 S1611 전역 무시, VS Code에서 `sonarlint.rules: java:S1611: off`

### VS Code Development Environment

`.vscode/settings.json` 주요 설정:

- `editor.formatOnSave: true` (Prettier), `source.organizeImports: explicit` (미사용 import 제거)
- `files.autoSave: afterDelay` (1초), `trimTrailingWhitespace`, `insertFinalNewline`
- `java.compile.nullAnalysis.mode: automatic` (`@NonNullApi` null 분석)
- 기본 포맷터: `esbenp.prettier-vscode` (Java + TypeScript)

### Database

PostgreSQL 17 (Docker). `spring-boot-docker-compose`가 `compose.yaml` 자동 감지.

- **개발:** `./gradlew bootRun` → Docker 자동 시작 (`lifecycle-management: start-only`)
- **테스트:** Testcontainers 임시 PostgreSQL 자동 생성/폐기
- **스키마:** `ddl-auto: update`
- **시간 컬럼:** `timestamptz` (UTC 기준)
- **전제 조건:** Docker Desktop 실행 중, 포트 5432 사용 가능

### Gradle Annotation Processor Order

Lombok must be declared before QueryDSL in `annotationProcessor` dependencies — otherwise QueryDSL code generation fails.

```groovy
// Lombok (first)
annotationProcessor 'org.projectlombok:lombok'
// QueryDSL (after)
annotationProcessor 'com.querydsl:querydsl-apt:5.1.0:jakarta'
```
