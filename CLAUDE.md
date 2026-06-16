#    CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

- **항상 한글로 답변한다.**

## gstack

- 브라우저 QA, 배포 확인, 리뷰, 조사 워크플로우가 필요하면 gstack 계열 스킬을 우선 사용한다.

## Design System

- 시각/UI 작업 전에는 항상 `DESIGN.md`를 먼저 읽는다.
- 폰트, 색상, 간격, 표면 처리, 헤더/카드/버튼 언어는 `DESIGN.md`를 기준으로 판단한다.
- 명시적 사용자 승인 없이 `DESIGN.md`에서 벗어나는 새 시각 방향을 도입하지 않는다.
- QA/리뷰 시 `DESIGN.md`와 어긋나는 UI는 버그 또는 편차로 보고한다.
- 프리뷰/목업 산출물이 있으면 `DESIGN.md`와 토큰을 동일하게 유지한다. 충돌 시 `DESIGN.md`를 정본으로 본다.

## Build & Run Commands

### Backend (Spring Boot)

```bash
./bootRun-dev.sh                    # Start backend on :9503 (Docker PostgreSQL auto-start)
./bootRun-local.sh                  # Start backend on :9501
./bootRun-test.sh                   # Start backend on :9502
./gradlew build                      # Full build (compile + test)
./gradlew test                       # Run all tests
./gradlew test --tests "com.smarterd.SomeTest.methodName"  # Single test
./gradlew clean build                # Clean rebuild
./gradlew compileJava                # Compile only (triggers QueryDSL/Lombok annotation processors)
```

### Frontend (Vite + React)

```bash
cd client
npm run dev                          # Dev server on :4503, proxies /api → :9503
npm run local                        # Dev server on :4501, proxies /api → :9501
npm run test:frontend                # Dev server on :4502, proxies /api → :9502
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

- **SonarQube / SonarLint 규칙을 최대한 준수한다.**
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
├── vite.config.ts                   # @/ alias → ./src, proxy /api → :9503 (frontend-test는 :9502)
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
baseURL: /api  →  Vite 프록시  →  localhost:9503
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

Swagger UI: `http://localhost:9503/swagger-ui/index.html`

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

- 백엔드 시간 타입 `Instant`, DB 컬럼 `timestamptz`, API 응답 ISO-8601 UTC (설정: `hibernate.jdbc.time_zone: UTC`, `spring.jackson.time-zone: UTC`)
- 프론트 표시: 브라우저 로컬 시간대로 변환, 포맷은 현재 선택 언어(`i18n`) 기준

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

- 아키텍처와 코드는 SOLID 원칙을 준수한다.
- 프로젝트 특이 규칙 (DIP): View가 Y.Doc 등 CRDT 구현체에 직접 의존하면 위반 — 항상 추상(인터페이스/포트)에 의존한다.
- 프로젝트 특이 규칙 (OCP): 새 기능(플러그인, 핸들러, Projector 등)은 기존 협업 코어 수정 없이 확장 가능해야 한다.

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

- 포맷 규칙의 정본은 루트 `.prettierrc.json` (+ `prettier-plugin-java`) — Java tabWidth 4/printWidth 120, TS tabWidth 2/printWidth 100
- Prettier와 SonarQube S1611 충돌: **Prettier 우선** (IDE/CI 설정은 README.md "개발 환경" 참조)

### Database

PostgreSQL 17 (Docker). `spring-boot-docker-compose`가 `compose.yaml` 자동 감지.

- **개발:** `./bootRun-dev.sh` → Docker 자동 시작 (`lifecycle-management: start-only`)
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

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Smart-ERD: SI 프로젝트 관리 플랫폼**

SI 프로젝트의 전체 생명주기를 관리하는 실시간 협업 플랫폼. 팀 > 프로젝트 체계 아래에서 사업 개요, 인력 투입, WBS, 마일스톤, 화면설계서, ERD, 기술 문서, 비용 관리, 일일/주간/월간 보고서를 통합 관리한다.

현재는 ERD 다이어그램 설계와 마크다운 기반 문서 편집을 시범 구현한 상태이며, 이 두 기능이 플랫폼의 실시간 협업 코어(Yjs + WebSocket)와 문서 플러그인 아키텍처를 검증하는 역할을 한다.

**Core Value:** SI 프로젝트에서 발생하는 모든 산출물과 관리 활동을 **하나의 실시간 협업 플랫폼**에서 일관된 체계로 관리할 수 있어야 한다.

### Constraints

- **1인 개발:** 모든 설계/구현/테스트를 혼자 수행 — 페이즈 단위로 점진적 확장 필수
- **Tech stack 고정:** Spring Boot + React + PostgreSQL + Yjs — 현재 스택 유지
- **코어 수정 제로 원칙:** 새 플러그인은 기존 협업 코어 계약만으로 동작해야 함
- **Electron 호환:** 웹/데스크톱 동시 지원 유지
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Java 25 - 백엔드 (Spring Boot), `build.gradle` toolchain `languageVersion = JavaLanguageVersion.of(25)`
- TypeScript ~5.6.2 - 프론트엔드 (React), `client/package.json`
- SQL - Flyway 마이그레이션 (`src/main/resources/db/migration/V*.sql`), QueryDSL 쿼리
- CSS - Tailwind CSS 기반 스타일링 (`client/src/index.css`)
## Runtime
- JVM (Java 25) - Spring Boot 백엔드
- Node.js - Vite 개발 서버 및 빌드
- Electron 40.x - 데스크톱 앱 배포 (Mac/Win)
- Gradle 9.4.0 (wrapper) - 백엔드 빌드, `gradle/wrapper/gradle-wrapper.properties`
- npm - 프론트엔드 패키지 관리, `client/package.json` (`"type": "module"`)
- Lockfile: `gradle.lockfile` 미사용, `package-lock.json` 존재
## Frameworks
- Spring Boot 3.5.11 - 백엔드 프레임워크, `build.gradle` plugin
- Spring Security 6.x - 인증/인가 (OAuth2 Resource Server JWT)
- Spring Data JPA - ORM/데이터 액세스
- React 19.2.x - 프론트엔드 UI 프레임워크
- Vite 6.x - 프론트엔드 빌드/개발 서버, `client/vite.config.ts`
- JUnit 5 (JUnit Platform) - 백엔드 단위/통합 테스트
- Spring Boot Test + Spring Security Test - 백엔드 테스트 지원
- Testcontainers (PostgreSQL) - 테스트용 DB 격리
- Playwright 1.58.x - E2E 테스트, `client/playwright.config.*`
- Node.js built-in test runner - 프론트엔드 유닛 테스트 (`node --test`)
- Gradle 9.4.0 - 백엔드 빌드 (`./gradlew build`)
- Vite 6.x - 프론트엔드 빌드 (`tsc -b && vite build`)
- electron-vite 5.x - Electron 빌드 (`electron-vite build`)
- electron-builder 26.x - 데스크톱 패키징 (DMG/NSIS), `client/electron-builder.yml`
## Key Dependencies
- `spring-boot-starter-web` - REST API 서버
- `spring-boot-starter-websocket` - Yjs 실시간 협업 WebSocket
- `spring-boot-starter-data-jpa` - JPA/Hibernate ORM
- `spring-boot-starter-oauth2-resource-server` - JWT 인증 (HMAC-SHA256)
- `spring-boot-starter-validation` - Bean Validation (Jakarta)
- `spring-boot-starter-data-redis` - WebSocket 티켓 저장소 (선택적, 기본 in-memory)
- `querydsl-jpa:5.1.0:jakarta` - 타입 안전 동적 쿼리
- `blaze-persistence-core-api-jakarta:1.6.17` - 고급 JPA 쿼리 빌더
- `postgresql` - PostgreSQL JDBC 드라이버
- `springdoc-openapi-starter-webmvc-ui:2.8.6` - Swagger UI/OpenAPI 문서
- `p6spy-spring-boot-starter:1.12.1` - SQL 로깅 (바인딩 파라미터 포함)
- `poi-ooxml:5.4.1` - Excel import/export
- `commons-lang3:3.17.0` / `commons-collections4:4.4` - Apache Commons 유틸리티
- `lombok` - 보일러플레이트 코드 제거
- `spring-boot-testcontainers` + `testcontainers:postgresql` - 테스트 DB 격리
- `@xyflow/react:^12.0.0` - ERD 캔버스 (React Flow)
- `zustand:^5.0.0` - 클라이언트 상태 관리
- `@tanstack/react-query:^5.90.20` - 서버 상태 관리 (캐싱, 무효화)
- `axios:^1.7.0` - HTTP 클라이언트
- `yjs:^13.6.29` - CRDT 실시간 협업
- `react-router-dom:^7.13.0` - SPA 라우팅
- `@radix-ui/*` (dialog, dropdown-menu, select, tabs 등) - shadcn/ui 기반 프리미티브
- `lucide-react:^0.563.0` - 아이콘
- `tailwind-merge:^3.4.0` + `clsx:^2.1.1` - CSS 클래스 유틸리티
- `class-variance-authority:^0.7.1` - 컴포넌트 variant 관리
- `tailwindcss-animate:^1.0.7` - 애니메이션
- `sonner:^2.0.7` - 토스트 알림
- `cmdk:^1.1.1` - 커맨드 팔레트
- `@monaco-editor/react:^4.6.0` + `monaco-editor:^0.55.1` - 코드 에디터 (DSL/DDL)
- `dagre:^0.8.5` - ERD 자동 레이아웃 (방향 그래프)
- `node-sql-parser:^5.4.0` - SQL DDL 파싱 (PostgreSQL/MySQL/MSSQL)
- `html-to-image:^1.11.13` + `jspdf:^4.1.0` - ERD 이미지/PDF 내보내기
- `dompurify:^3.2.7` - HTML 새니타이징
- `marked:^14.0.0` - Markdown 렌더링
- `js-yaml:^4.1.1` - YAML 파싱
- `@dnd-kit/core:^6.3.1` + `@dnd-kit/sortable:^10.0.0` - 드래그 앤 드롭
- `react-hotkeys-hook:^5.2.4` - 키보드 단축키
- `i18next:^25.8.4` + `react-i18next:^16.5.4` - 다국어 (ko/en)
- `electron-store:^11.0.2` - Electron 로컬 저장소
## Configuration
- 백엔드: `application.yml` (`smart-erd.*` 네임스페이스), 환경변수 오버라이드
- 프론트엔드: `.env.frontend-dev`, `.env.frontend-local`, `.env.frontend-test` (Vite 모드별)
- `.envrc` 파일 존재 (direnv 사용)
- 주요 환경변수: `SMART_ERD_JWT_SECRET`, `SERVER_PORT`, `SMART_ERD_CORS_ORIGINS`, `SMART_ERD_DB_*`, `VITE_*`
- `build.gradle` - Gradle 빌드 설정 (annotation processor 순서: Lombok -> QueryDSL)
- `client/vite.config.ts` - Vite 빌드 (수동 chunk splitting, `@/` alias, proxy 설정)
- `client/electron.vite.config.ts` - Electron 빌드
- `client/electron-builder.yml` - 데스크톱 패키징 (Mac DMG universal, Win NSIS/portable)
- `client/tsconfig.app.json` - TypeScript 설정 (`@/*` 경로 별칭)
- `.prettierrc.json` - Prettier (Java tabWidth 4/printWidth 120, TS tabWidth 2/printWidth 100)
- Flyway 마이그레이션: `src/main/resources/db/migration/V*.sql` (12개 파일)
- `ddl-auto: update` 병행 사용
## Platform Requirements
- Java 25 JDK
- Node.js (ESM 지원 버전)
- Docker Desktop 실행 필수 (PostgreSQL 17 컨테이너)
- npm 캐시 이슈: `--cache /tmp/npm-cache-smarterd` 사용 권장
- JVM (Java 25)
- PostgreSQL 17
- Redis 7 (선택적, WebSocket 티켓/벌크 검증 저장소)
- Electron 데스크톱 앱: macOS (universal), Windows (x64)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Conventions
### Backend (Java)
- PascalCase: `DiagramService`, `TeamController`, `EntityNotFoundException`
- Suffix 규칙: Service (`DiagramService`), Controller (`TeamController`), Repository (`DiagramRepository`), UseCase (`SaveDiagramUseCase`)
- Custom Repository: `XxxRepositoryCustom` (인터페이스) + `XxxRepositoryCustomImpl` (구현체)
- DTO: Java `record` 타입 사용 (`TeamMemberId`, request/response DTO)
- camelCase: `findByIdWithOwner()`, `validateAndConsume()`
- 조회: `find*`, `fetch*`, `get*`
- 변경: `save*`, `create*`, `update*`, `delete*`, `change*`
- 검증: `validate*`, `check*`
- `var` / `final var` 사용 (타입이 RHS에서 명확한 경우)
- `final var` = 재할당 없는 변수, `var` = 재할당 있는 변수
- 예: `final var user = findUserByLoginId(loginId);`
- Base package: `com.smarterd`
- `api/` = HTTP interface layer (Controller + DTO only)
- `domain/` = 비즈니스 로직 (Entity + Repository + Service)
- `config/` = 설정 클래스
- `application/` = UseCase 클래스
### Frontend (TypeScript/React)
- Components: PascalCase (`TableNode.tsx`, `ProtectedRoute.tsx`)
- Hooks: camelCase `use` prefix (`useInlineEdit.ts`, `useFkConnectMode.ts`)
- API modules: camelCase + `Api` suffix (`teamApi.ts`, `diagramApi.ts`)
- Stores: camelCase `use` prefix + `Store` suffix (`useAuthStore.ts`, `useCanvasStore.ts`)
- Types: camelCase domain name (`team.ts`, `diagram.ts`)
- Constants: camelCase (`query-keys.ts`, `keybindings.ts`)
- Test files (unit): kebab-case (`erd-diff-apply.test.ts`)
- Test files (E2E): kebab-case + `.spec.ts` (`diagram-loading.spec.ts`)
- camelCase: `fetchTeams()`, `createTeam()`, `handleSave()`
- API 함수: `fetch*`, `create*`, `update*`, `delete*` prefix
- 이벤트 핸들러: `handle*` prefix
- 상수 객체: camelCase (`queryKeys`, `KEYBINDINGS`, `STORAGE_KEYS`, `ROUTES`)
- State: camelCase (`deleteTarget`, `isLoading`)
- PascalCase: `Team`, `TeamMember`, `TableNodeData`, `DiffPlan`
## Code Style
### Formatting (Prettier)
- Config: `.prettierrc.json` (루트)
- Plugin: `prettier-plugin-java` (Java + TypeScript 통합 포맷팅)
- `tabWidth: 4`, `printWidth: 120`
- `tabWidth: 2`, `printWidth: 100`, `singleQuote: true`
- `semi: true`, `trailingComma: "all"`, `bracketSpacing: true`
- `arrowParens: "always"`, `endOfLine: "lf"`
### Linting (ESLint)
- Config: `client/eslint.config.js`
- 기반: `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-config-prettier`
- Plugins: `react-hooks`, `react-refresh`, `prettier`
- Key rules:
### SonarQube
- Config: `sonar-project.properties`
- S1611 (lambda parentheses) 전역 무시 (Prettier 우선)
- null 반환 대신 빈 컬렉션/빈 배열 반환
- 사용하지 않는 변수/import 제거
- 예외를 무시하지 않고 적절히 처리 또는 로깅
## Import Rules
### Backend (Java)
- **와일드카드 임포트 (`.*`) 금지** --- 모든 import는 명시적
- static import는 Q클래스에 사용: `import static com.smarterd.domain.xxx.entity.QXxx.xxx;`
- Prettier가 save 시 자동 정렬, VS Code `organizeImports`가 미사용 import 제거
### Frontend (TypeScript)
- `@/` alias 사용 필수: `@/components/ui/button`, `@/lib/utils`
- ESM only (`"type": "module"`) --- `require()` 금지
## Error Handling
### Backend Exception Hierarchy
| Exception | HTTP Status | 용도 |
|-----------|-------------|------|
| `EntityNotFoundException` | 404 | 엔티티 조회 실패 |
| `DomainAccessDeniedException` | 403 | 권한 부족 (미소속, 비ADMIN) |
| `DuplicateException` / `ConflictException` | 409 | 중복 리소스 |
| `TooManyRequestsException` | 429 | 요청 횟수 초과 (로그인 속도 제한 등) |
| `BusinessException` | 400 | 비즈니스 규칙 위반 |
- Base class: `com.smarterd.domain.common.exception.LocalizedException`
- Handler: `com.smarterd.api.common.GlobalExceptionHandler`
### Backend Error Response Format
- `Accept-Language` 헤더에 따라 다국어 메시지 반환
- `MessageSource` + `Locale`로 해석
### Frontend Error Handling
- `onError`에서 `toast.error(getErrorMessage(err, t('key')))` 패턴 통일
- `getErrorMessage()` 유틸: `client/src/lib/api-error.ts`
- 인라인 에러 표시 금지 --- 항상 `toast.error()` 사용
## Transaction Pattern (Backend)
- 클래스 레벨: `@Transactional(readOnly = true)` --- 기본 읽기 전용
- 메서드 레벨: `@Transactional` --- 쓰기 작업에만 override
- JPA Dirty Checking 활용: setter로 상태 변경, delete+save 금지
## Null Safety (Backend)
- 루트 `package-info.java`에 `@NonNullApi` 선언 (`com.smarterd`)
- 하위 패키지 전체 non-null by default
- null 허용 시 `@Nullable` 명시
- `@SuppressWarnings("null")` --- `src/main/` 금지, `src/test/`에서만 허용
- SonarQube null 경고 시 `Objects.requireNonNull(...)` 가드 추가
## Documentation (JSDoc/Javadoc)
### Backend (Javadoc)
- 모든 Service, UseCase, Entity 클래스에 클래스 레벨 Javadoc
- `@param`, `@returns` 사용
- 필드에 `/** 설명 */` single-line 주석
### Frontend (JSDoc)
- **모든 함수/컴포넌트/인터페이스에 JSDoc 필수**
- 함수: multi-line JSDoc + `@param` + `@returns`
- Interface 필드: single-line `/** 설명 */`
- State 변수 (`useState`): single-line `/** 설명 */`
- 상수: top-level `/** 설명 */` + 각 필드 설명
- shadcn/ui 컴포넌트 (`components/ui/`): auto-generated, JSDoc 불요
## i18n (Internationalization)
### Backend
- `Spring MessageSource` 기반
- 번들 위치: `src/main/resources/i18n/messages.properties` (en), `messages_ko.properties` (ko)
- `AcceptHeaderLocaleResolver`로 `Accept-Language` 헤더에서 locale 해석
- 예외 message code: `"error.not-found.user"` 형식
- Bean Validation: `@NotBlank(message = "{validation.not-blank.login-id}")`
### Frontend
- `react-i18next` (`i18next` + `LanguageDetector`)
- 설정: `client/src/i18n/index.ts`
- 번역 파일: `client/src/i18n/locales/{en,ko}/translation.json` (~200 keys each)
- Key convention: `{domain}.{screen}.{usage}`
- **하드코딩 문자열 금지** --- 항상 `t('key')` 사용
- `useTranslation()` 위치: `useQueryClient` 다음 (Page Component Code Ordering 규칙)
- Type augmentation: `client/src/i18n/i18next.d.ts` (번역 키 자동 완성)
- Axios 인터셉터가 모든 요청에 `Accept-Language: i18n.language` 헤더 자동 첨부
## Page Component Code Ordering (Frontend)
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
| 9 | 이벤트 핸들러 | `handleSave` |
| 10 | 사이드 이펙트 | `useEffect` |
| 11 | 조건부 리턴 | loading/error early return |
| 12 | JSX | `return (...)` |
## Magic String 금지 (Frontend)
| 카테고리 | 상수 | 파일 |
|----------|------|------|
| localStorage keys | `STORAGE_KEYS.*` | `client/src/constants/storage.ts` |
| Route paths | `ROUTES.*` | `client/src/constants/routes.ts` |
| Query cache keys | `queryKeys.*` | `client/src/constants/query-keys.ts` |
| Keyboard shortcuts | `KEYBINDINGS.*` | `client/src/constants/keybindings.ts` |
## Styling (Frontend)
- CSS Variable 기반 디자인 토큰 체계
- `index.css` (:root / .dark) -> `tailwind.config.js` -> 시맨틱 클래스
- **하드코딩 색상 (`bg-gray-*`, `text-blue-*`, `#hex`) 금지**
- shadcn/ui 토큰: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground` 등
- ERD 전용 토큰: `bg-erd-table-header`, `text-erd-pk`, `text-erd-fk` 등
- 새 색상 추가: `index.css` CSS Variable -> `tailwind.config.js` 매핑 -> 시맨틱 클래스
## Accessibility (Frontend)
- 아이콘 전용 버튼: `aria-label` 필수
- 토글 버튼: `aria-label`에 대상 컨텍스트 포함
- form 요소: `<label>` 연결 불가 시 `aria-label` 추가
## Data Fetching (Frontend)
- 서버 상태: React Query (`useQuery` / `useMutation`) 필수
- 수동 `useEffect` + `useState(loading)` 패턴 금지
- Mutation 후: `invalidateQueries`로 캐시 무효화
- 페이지에서 `axiosInstance` 직접 호출 금지 --- `api/` 모듈 함수 경유
## QueryDSL Custom Repository Pattern (Backend)
- Impl 클래스에 `@Repository`/`@Component` 붙이지 않음
- `JPAQueryFactory`는 `@RequiredArgsConstructor`로 생성자 주입
- Q클래스는 static import
- Spring Data 파생 쿼리 메서드는 QueryDSL로 전환하지 않음
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Backend: 4-layer architecture (API / Application / Collaboration / Domain)
- Frontend: Feature-based SPA with Zustand (client state) + React Query (server state) + Yjs (CRDT collaboration)
- Real-time: Raw WebSocket + Yjs binary protocol, plugin 기반 채널 확장 구조
- 문서 타입 플러그인 시스템: ERD와 Markdown 두 가지 문서 플러그인이 동일한 협업 프레임워크 위에서 동작
## Layers
- Purpose: HTTP 인터페이스 (Controller + DTO). 비즈니스 로직 없음
- Location: `src/main/java/com/smarterd/api/`
- Contains: Controller, Request/Response DTO (Java record), Validator
- Depends on: `domain/` 서비스, `application/` 유스케이스
- Used by: 프론트엔드 HTTP 클라이언트
- 도메인별 하위 패키지: `auth/`, `diagram/`, `dictionary/`, `project/`, `team/`
- DTO는 `dto/` 하위 디렉토리에 record 타입으로 정의
- Purpose: 유스케이스 조율 (Cross-domain orchestration). 여러 도메인 서비스를 조합하는 복합 비즈니스 로직
- Location: `src/main/java/com/smarterd/application/`
- Contains: UseCase 클래스, Port 인터페이스, Model (payload/result record)
- Depends on: `domain/` 서비스, `collaboration/` 인프라
- Used by: `api/` Controller, WebSocket handler
- 하위 패키지: `collaboration/command/`, `collaboration/query/`, `diagram/command/`, `diagram/model/`, `diagram/port/`
- 예시: `SaveDiagramAuthoritativeContentUseCase`, `IssueDiagramCollaborationTicketUseCase`
- Purpose: 도메인 무관 실시간 협업 인프라 프레임워크 (채널, 세션, 스냅샷, 문서 엔진)
- Location: `src/main/java/com/smarterd/collaboration/`
- Contains: 채널 플러그인 인터페이스, 세션 관리, 스냅샷 저장소, 문서 엔진 추상화
- Depends on: 없음 (독립 모듈)
- Used by: `domain/diagram/collaboration/` (다이어그램 채널 구현), `application/` (유스케이스)
- 핵심 추상화: `CollaborationChannelPlugin`, `CollaborationWebSocketBinding`, `SharedDocumentEngine`, `CollaborationSnapshotStore`
- 하위 패키지: `channel/` (채널 등록/인증/바인딩), `document/` (문서 엔진), `handoff/` (핸드오프), `metadata/`, `persistence/`, `plugin/` (플러그인 레지스트리), `session/`, `snapshot/`
- Purpose: 엔티티, 리포지토리, 도메인 서비스. 핵심 비즈니스 규칙
- Location: `src/main/java/com/smarterd/domain/`
- Contains: JPA Entity, Spring Data Repository (+ QueryDSL Custom), Service
- Depends on: `collaboration/` (diagram 도메인의 협업 구현체만)
- Used by: `api/`, `application/`
- 하위 패키지: `common/`, `user/`, `team/`, `project/`, `diagram/`, `dictionary/`, `markdown/`
- Purpose: Spring 설정 빈, 보안, WebSocket, 스케줄러
- Location: `src/main/java/com/smarterd/config/`
- Contains: `@Configuration` 클래스, `@ConfigurationProperties`, Scheduler
- 하위 패키지: `dictionary/`, `i18n/`, `openapi/`, `persistence/`, `scheduler/`, `security/`, `support/`, `websocket/`
## Data Flow
- **Server State:** React Query (`@tanstack/react-query`) — API 데이터 캐싱, 자동 갱신, mutation + invalidation
- **Client State:** Zustand — `useAuthStore` (인증 토큰), `useCanvasStore` (ERD 노드/엣지 React Flow 상태), `useCollaborationStore` (협업 세션 상태)
- **CRDT State:** Yjs `Y.Doc` — 실시간 협업 문서 동기화, WebSocket 경유 update 전파
## Key Abstractions
- Purpose: 도메인별 실시간 협업 채널을 프레임워크에 등록하는 확장점
- Interface: `CollaborationChannelPlugin` (`collaboration/channel/`)
- Implementation: `DiagramCollaborationChannelPlugin` (`domain/diagram/collaboration/`)
- Pattern: Strategy + Registry — `CollaborationChannelRegistry`가 모든 채널 플러그인을 수집하고 채널 타입으로 라우팅
- 관련 support 인터페이스: `CollaborationTicketSupport`, `CollaborationRuntimeSupport`, `CollaborationWebSocketBinding`
- Purpose: ERD / Markdown 등 문서 타입별 협업 로직을 분리
- Core contracts: `client/src/collaboration/core/contracts/` (document-bootstrap, document-plugin, shared-document-engine 등)
- ERD plugin: `client/src/collaboration/plugins/erd/`
- Markdown plugin: `client/src/collaboration/plugins/markdown/`
- Registry: `client/src/collaboration/registry/` (document-plugin-registry, shared-document-engine-registry)
- Pattern: Plugin Registry — `DocumentEditorRoute`가 pluginId로 ERD/Markdown 페이지를 분기
- Purpose: 단일 유스케이스를 캡슐화하는 서비스 클래스
- Location: `src/main/java/com/smarterd/application/`
- Pattern: Command/Query 분리 — `command/` (상태 변경), `query/` (조회)
- 예시: `SaveDiagramAuthoritativeContentUseCase`, `IssueCollaborationTicketUseCase`, `LoadCollaborationHandoffUseCase`
- Port 인터페이스: `DiagramPresencePort`, `DiagramRealtimeSessionPort` (DIP 적용)
- Purpose: 타입 안전한 복합 쿼리
- Pattern: `XxxRepository extends JpaRepository, XxxRepositoryCustom` → `XxxRepositoryCustomImpl`
- 예시: `DiagramRepositoryCustomImpl`, `TeamRepositoryCustomImpl`, `TeamMemberRepositoryCustomImpl`, `RefreshTokenRepositoryCustomImpl`, `TermRepositoryCustomImpl`
- Purpose: 메시지 타입별 처리 로직 분리
- Location: `src/main/java/com/smarterd/domain/diagram/websocket/relay/handler/`
- Handlers: `YjsUpdateMessageHandler`, `AwarenessMessageHandler`, `SyncRelayMessageHandler`, `CompactedSnapshotMessageHandler`, `PresenceSnapshotRequestMessageHandler`, `SnapshotRequestMessageHandler`
- Dispatcher: `DiagramWebSocketMessageDispatcher`
## Entry Points
- Location: `src/main/java/com/smarterd/SmartErdApplication.java`
- Triggers: `./bootRun-dev.sh`, `./gradlew bootRun`
- Responsibilities: Spring Boot 자동 구성, JPA Auditing, Scheduling 활성화
- Location: `client/src/main.tsx` → `client/src/App.tsx`
- Triggers: `npm run dev`
- Responsibilities: React root 생성, QueryClientProvider, Router, 라우트 정의, ProtectedRoute 가드
- Location: `src/main/java/com/smarterd/domain/diagram/websocket/transport/DiagramWebSocketHandler.java`
- Triggers: WebSocket 연결 (`/ws/diagram/{diagramId}`)
- Responsibilities: 바이너리 메시지 수신 → 타입별 핸들러 디스패치 → Room 릴레이
- Location: `client/src/pages/document/DocumentEditorRoute.tsx`
- Triggers: `/teams/:teamId/projects/:projectId/diagrams/:diagramId` 라우트
- Responsibilities: pluginId 기반 ERD/Markdown 문서 편집기 분기
## Error Handling
- `LocalizedException` 기반 예외 계층: `EntityNotFoundException`(404), `DomainAccessDeniedException`(403), `DuplicateException`(409), `BusinessException`(400), `ConflictException`(409), `TooManyRequestsException`(429)
- 모든 예외는 `messageCode + messageArgs` 패턴으로 생성 → `GlobalExceptionHandler`에서 `MessageSource` + `Locale`로 해석
- Location: `src/main/java/com/smarterd/domain/common/exception/`, `src/main/java/com/smarterd/api/common/GlobalExceptionHandler.java`
- `getErrorMessage(err, fallback)` (`client/src/lib/api-error.ts`): 서버 에러 메시지 추출
- `toast.error(getErrorMessage(err, t('key')))`: 모든 mutation `onError` 핸들러에서 사용
- 401 응답 → Axios 인터셉터에서 Refresh Token 갱신 시도 (큐 패턴) → 실패 시 로그인 리다이렉트
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->
