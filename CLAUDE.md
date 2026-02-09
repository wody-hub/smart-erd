# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

- **항상 한글로 답변한다.**

## Build & Run Commands

### Backend (Spring Boot)

```bash
./gradlew bootRun                    # Start backend on :8080 (Docker PostgreSQL auto-start)
./gradlew build                      # Full build (compile + test)
./gradlew test                       # Run all tests
./gradlew test --tests "com.smarterd.SomeTest.methodName"  # Single test
./gradlew clean build                # Clean rebuild
./gradlew compileJava                # Compile only (triggers QueryDSL/Lombok annotation processors)
```

### Frontend (Vite + React)

```bash
cd client
npm run dev                          # Dev server on :3000, proxies /api → :8080
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

## Architecture

### Backend: Spring Boot 3.5.10 / Java 25

Base package: `com.smarterd`

```text
src/main/java/com/smarterd/
├── SmartErdApplication.java         # Application entry point (@SpringBootApplication)
├── package-info.java                # @NonNullApi (non-null by default for all sub-packages)
├── api/                             # HTTP interface layer (Controller + DTO only)
│   ├── auth/
│   │   ├── AuthController.java      #   POST /api/auth/login, /api/auth/signup
│   │   └── dto/                     #   LoginRequest, SignupRequest, AuthResponse (record)
│   ├── team/
│   │   ├── TeamController.java      #   /api/teams CRUD + /api/teams/{id}/members management
│   │   └── dto/                     #   CreateTeamRequest, TeamResponse, AddMemberRequest, UpdateMemberRoleRequest, TeamMemberResponse
│   ├── project/
│   │   ├── ProjectController.java   #   /api/teams/{teamId}/projects CRUD
│   │   └── dto/                     #   CreateProjectRequest, ProjectResponse
│   └── common/
│       └── GlobalExceptionHandler.java  # @RestControllerAdvice (404/403/409/400 mapping)
├── config/                          # Configuration
│   ├── SecurityConfig.java          #   Spring Security (OAuth2 Resource Server JWT, CSRF disabled)
│   ├── JwtConfig.java               #   JwtEncoder / JwtDecoder beans (NimbusJwtDecoder, HS256)
│   ├── JwtProperties.java           #   @ConfigurationProperties("smart-erd.jwt") — secret, expiration
│   ├── CorsConfig.java              #   @ConfigurationProperties("smart-erd.cors") + CorsProperties inner class
│   ├── QuerydslConfig.java          #   JPAQueryFactory bean (QueryDSL type-safe query builder)
│   ├── BlazeConfig.java             #   CriteriaBuilderFactory bean (Blaze-Persistence advanced queries)
│   └── OpenApiConfig.java           #   Swagger/OpenAPI config (JWT Bearer auth scheme)
└── domain/                          # Domain layer (Services live here too)
    ├── common/
    │   ├── entity/                   #   BaseTimeEntity (createdAt, updatedAt auto-audit)
    │   └── exception/               #   Custom exception hierarchy (4 types)
    │       ├── EntityNotFoundException.java   # → 404 Not Found
    │       ├── AccessDeniedException.java     # → 403 Forbidden
    │       ├── DuplicateException.java        # → 409 Conflict
    │       └── BusinessException.java         # → 400 Bad Request
    ├── user/
    │   ├── entity/                   #   User, RefreshToken (loginId unique, BCrypt password)
    │   ├── repository/              #   UserRepository, RefreshTokenRepository (+Custom — QueryDSL bulk delete)
    │   └── service/                 #   AuthService, AuthUserDetailsService, JwtTokenService
    ├── team/
    │   ├── entity/                  #   Team, TeamMember (@IdClass), TeamMemberId (record), TeamMemberRole
    │   ├── repository/             #   TeamRepository (+Custom), TeamMemberRepository (+Custom) — QueryDSL fetch join
    │   └── service/                #   TeamService (CRUD + member management with ADMIN permission checks)
    ├── project/
    │   ├── entity/                  #   Project (belongs to Team)
    │   ├── repository/             #   ProjectRepository (findByTeam)
    │   └── service/                #   ProjectService (CRUD with team membership checks)
    ├── diagram/
    │   ├── entity/                  #   Diagram (TEXT content — serialized React Flow JSON)
    │   └── repository/             #   DiagramRepository
    └── dictionary/
        ├── entity/                  #   Domain (logical→physical type), Term (logical→physical name)
        └── repository/             #   DomainRepository, TermRepository
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

**Database:** PostgreSQL 17 (Docker). `spring-boot-docker-compose`가 `compose.yaml`을 자동 감지하여 컨테이너를 시작하고, datasource를 자동 주입한다. `ddl-auto: update`. Docker Desktop이 실행 중이어야 한다.

### Frontend: Vite 6 + React 18 + TypeScript + shadcn/ui + React Query

```text
client/
├── index.html                       # SPA entry point
├── package.json                     # "type": "module" (ESM)
├── tailwind.config.js               # CSS variable colors, darkMode: ["class"], tailwindcss-animate
├── postcss.config.js                # tailwindcss + autoprefixer
├── vite.config.ts                   # @/ alias → ./src, proxy /api → :8080
├── tsconfig.app.json                # paths: { "@/*": ["./src/*"] }
├── .prettierrc.json                 # Prettier config
├── .prettierignore                  # Prettier ignore
├── eslint.config.js                 # ESLint flat config (TypeScript + Prettier)
└── src/
    ├── main.tsx                     # createRoot + StrictMode
    ├── App.tsx                      # QueryClientProvider + BrowserRouter + Routes
    ├── index.css                    # Tailwind directives + CSS variables (light/dark)
    ├── vite-env.d.ts                # Vite type reference
    ├── api/
    │   ├── axiosInstance.ts         # baseURL: /api, JWT auto-attach + 401 Refresh Token rotation
    │   ├── authApi.ts               # login(), signup()
    │   ├── teamApi.ts               # fetchTeams(), fetchTeam(), createTeam(), fetchMembers(), inviteMember(), removeMember()
    │   ├── projectApi.ts            # fetchProjects(), createProject(), deleteProject()
    │   └── diagramApi.ts            # fetchDiagrams(), fetchDiagram(), createDiagram(), saveDiagram(), renameDiagram(), deleteDiagram()
    ├── constants/
    │   ├── storage.ts               # STORAGE_KEYS — localStorage key constants
    │   ├── routes.ts                # ROUTES — route path constants (static + parameterized)
    │   └── query-keys.ts            # queryKeys — React Query cache key hierarchy
    ├── hooks/
    │   └── useInlineEdit.ts         # Inline text editing hook (startEdit, confirmEdit, cancelEdit)
    ├── components/
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx   # Auth guard (redirects to /login if no token)
    │   ├── erd/
    │   │   ├── ERDCanvas.tsx        # @xyflow/react canvas (16x16 grid snap, MiniMap, Controls, step edge)
    │   │   └── TableNode.tsx        # Custom node: table header + column rows (PK/FK badges, L/R handles)
    │   ├── layout/
    │   │   ├── Header.tsx           # Top header (h-12, bg-header, user name + logout + save)
    │   │   ├── Sidebar.tsx          # Left sidebar (w-56, table list)
    │   │   └── SidebarTableItem.tsx # Individual table item with inline rename
    │   ├── team/
    │   │   └── MembersDialog.tsx    # Team member management dialog (invite/remove, uses React Query)
    │   └── ui/                      # shadcn/ui + shared UI components
    │       ├── confirm-dialog.tsx   #   Confirmation dialog (replaces window.confirm())
    │       ├── create-resource-dialog.tsx  # Resource creation dialog (Team/Project/Diagram)
    │       ├── button.tsx           #   Button — 6 variants, 4 sizes, asChild (@radix-ui/react-slot)
    │       ├── card.tsx             #   Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter
    │       ├── dialog.tsx           #   Dialog/DialogContent/DialogHeader/DialogFooter/DialogTitle
    │       ├── dropdown-menu.tsx    #   DropdownMenu (full Radix implementation)
    │       ├── input.tsx            #   Input — plain HTML input (shadcn/ui standard)
    │       ├── label.tsx            #   Label — @radix-ui/react-label + CVA
    │       └── spinner.tsx          #   Spinner — Loader2 animate-spin + optional text
    ├── lib/
    │   ├── utils.ts                 # cn() = clsx + tailwind-merge
    │   ├── api-error.ts             # getErrorMessage() — server error message extraction
    │   └── query-client.ts          # QueryClient (staleTime: 30s, retry: 1, refetchOnWindowFocus: false)
    ├── pages/                       # Domain-based page directories
    │   ├── auth/
    │   │   ├── LoginPage.tsx        # Login form (authApi, redirects to /teams on success)
    │   │   └── SignupPage.tsx       # Signup form (authApi, auto-login on success)
    │   ├── team/
    │   │   └── TeamsPage.tsx        # Team list + create (useQuery + useMutation + CreateResourceDialog)
    │   ├── project/
    │   │   └── ProjectsPage.tsx     # Project list + CRUD + member management (useQuery + useMutation)
    │   └── diagram/
    │       ├── DiagramsPage.tsx     # Diagram list + CRUD + inline rename (useQuery + useMutation)
    │       └── DiagramPage.tsx      # Diagram editor: Header + Sidebar + ERDCanvas (useQuery + useMutation)
    ├── stores/
    │   ├── useAuthStore.ts          # Zustand: auth state (tokens, loginId, name) + localStorage sync
    │   └── useCanvasStore.ts        # Zustand: nodes, edges, onChange handlers, serialize/deserialize
    └── types/
        ├── erd.ts                   # Column, TableNodeData, TableNode, ERDEdge
        ├── auth.ts                  # AuthResponse
        ├── team.ts                  # Team, TeamMember, TeamMemberRole
        ├── project.ts              # Project
        └── diagram.ts              # DiagramSummary, DiagramDetail
```

**Frontend conventions:**

- `api/` — API module per domain. Each module exports typed async functions. Pages never call `axiosInstance` directly.
- `constants/` — Magic strings are forbidden. All localStorage keys, route paths, and query keys are defined as constants.
- `types/` — Shared TypeScript interfaces per domain. Inline type definitions in pages are forbidden.
- `hooks/` — Reusable custom hooks. Extract when a pattern repeats across 2+ components.
- `components/ui/` — Reusable primitives (shadcn/ui + shared dialogs). No domain logic.
- `components/team/` — Team domain-specific components (MembersDialog).
- `components/auth/` — Authentication components (ProtectedRoute).
- `components/erd/` — ERD domain-specific components.
- `components/layout/` — Page structure components (Header, Sidebar).
- `pages/` — Domain-based subdirectories (`auth/`, `team/`, `project/`, `diagram/`). Each page groups code in standard order (see "Page Component Code Ordering").
- `lib/` — Pure utility functions and configurations (no React dependencies except query-client).
- Use `@/` alias for imports (`@/components/ui/button`, `@/lib/utils`).
- State management: Zustand for client-only state (`stores/`), React Query for server state (`useQuery`/`useMutation`).
- ESM only (`"type": "module"`) — never use `require()`, use ESM imports.
- Adding new shadcn/ui components: create file in `components/ui/`, use `cn()`, apply `forwardRef` pattern.

**Routes:** `/login`, `/signup`, `/teams`, `/teams/:teamId/projects`, `/teams/:teamId/projects/:projectId/diagrams`, `/teams/:teamId/projects/:projectId/diagrams/:diagramId`. All routes except `/login` and `/signup` are protected by `ProtectedRoute`.

### Key Conventions

- **Handle IDs:** `{nodeId}-{colId}-source` / `{nodeId}-{colId}-target` — enables column-level relationships
- **Edge IDs:** `e-{sourceHandle}-{targetHandle}`
- **Diagram persistence:** `useCanvasStore.serialize()` → JSON string stored in `Diagram.content` (TEXT)
- **Type assertion needed:** `applyNodeChanges()` returns generic `Node[]`, must cast to `Node<TableNodeData>[]`

### Tech Stack

| Layer         | Stack                                                                            |
| ------------- | -------------------------------------------------------------------------------- |
| Backend       | Spring Boot 3.5.10, Java 25, Gradle 8.12, Spring Security 6.x, Spring Data JPA   |
| Query         | QueryDSL 5.1.0:jakarta, Blaze-Persistence 1.6.17                                 |
| Auth          | Spring OAuth2 Resource Server (HMAC-SHA256 JWT + Refresh Token rotation), BCrypt |
| DB            | PostgreSQL 17 (Docker), Testcontainers (test)                                    |
| Frontend      | React 18, TypeScript 5.6, Vite 6, Tailwind CSS 3.4, shadcn/ui                    |
| Data Fetching | @tanstack/react-query 5 (useQuery, useMutation, cache invalidation)              |
| ERD Canvas    | @xyflow/react 12, Zustand 5                                                      |
| Editor        | @monaco-editor/react 4.6                                                         |
| Toast         | Sonner                                                                           |
| Formatting    | Prettier (Java + TypeScript), prettier-plugin-java                               |
| Code Quality  | ESLint, SonarQube / SonarLint                                                    |

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

Use domain-specific custom exceptions (NOT `IllegalArgumentException`):

| Exception                 | HTTP Status | Usage                                          |
| ------------------------- | ----------- | ---------------------------------------------- |
| `EntityNotFoundException` | 404         | Entity lookup failure                          |
| `AccessDeniedException`   | 403         | Permission denied (not a member, not ADMIN)    |
| `DuplicateException`      | 409         | Duplicate resource (member, login ID)          |
| `BusinessException`       | 400         | Business rule violation (removing owner, etc.) |

All exceptions in `domain/common/exception/`, mapped by `GlobalExceptionHandler`.

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
- Service classes: `@SuppressWarnings("null")` to suppress JPA repository null analysis warnings

### QueryDSL Custom Repository Pattern

`@Query` JPQL 대신 QueryDSL `JPAQueryFactory`로 타입 안전한 쿼리를 작성한다. Spring Data의 Custom Repository 컨벤션을 따른다.

**패턴:**

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

**예시:**

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

**Config 빈:**

- `QuerydslConfig` — `JPAQueryFactory` 빈 등록 (`EntityManager` 주입, Spring shared proxy이므로 스레드 안전)
- `BlazeConfig` — `CriteriaBuilderFactory` 빈 등록 (CTE, Keyset Pagination 등 고급 쿼리 인프라)

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
const [loading, setLoading] = useState(true);
useEffect(() => {
    fetchTeams()
        .then(setTeams)
        .finally(() => setLoading(false));
}, []);
```

Mutation 후 캐시 무효화는 `invalidateQueries`로 선언적으로 수행:

```typescript
const createMutation = useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
        toast.success('Team created');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to create team')),
});
```

#### API Layer

- Pages never call `axiosInstance` directly. Always go through `api/` module functions.
- Each API function is typed with explicit return types and has JSDoc with `@param`.
- Error handling: Use `getErrorMessage(err, fallback)` in `onError` callbacks to extract server error messages.

#### Constants — No Magic Strings

- localStorage keys → `STORAGE_KEYS.*`
- Route paths → `ROUTES.*`
- React Query cache keys → `queryKeys.*`
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

#### Styling — Design Token System (MUST follow)

CSS Variable 기반 디자인 토큰 체계를 사용한다. **하드코딩 색상(`bg-gray-*`, `text-blue-*`, `#hex` 등)은 금지**한다.

**토큰 구조:**
```text
index.css (:root / .dark)  →  CSS Variable 정의 (HSL 값)
tailwind.config.js         →  Tailwind 시맨틱 색상 매핑 (hsl(var(--token)))
컴포넌트                    →  시맨틱 클래스 사용 (bg-card, text-muted-foreground 등)
```

**shadcn/ui 기본 토큰** — 리스트 페이지, 폼, 다이얼로그에서 사용:
```
bg-background, bg-card, bg-muted, bg-accent, bg-popover
text-foreground, text-muted-foreground, text-card-foreground
bg-primary, bg-secondary, bg-destructive
border-border, border-input
```

**ERD 전용 토큰** — ERD 편집기(Header, Sidebar, TableNode, ERDCanvas)에서 사용:
```
bg-header, text-header-foreground, text-header-muted        — 헤더 바
bg-erd-table-header, text-erd-table-header-foreground        — 테이블 노드 헤더
text-erd-pk, text-erd-fk, text-erd-nullable                  — PK/FK/nullable 뱃지
bg-erd-handle, border-erd-handle-border                      — Handle (연결점)
text-erd-warning                                              — unsaved 경고
```

**규칙:**
- 새 컴포넌트에서 `gray-*`, `blue-*` 등 Tailwind 기본 팔레트 색상을 직접 사용하지 않는다
- 새 색상이 필요하면 `index.css`에 CSS Variable 추가 → `tailwind.config.js`에 매핑 → 컴포넌트에서 시맨틱 클래스 사용
- `hover:bg-accent`, `focus:bg-accent` — 인터랙티브 상태용 시맨틱 토큰
- MiniMap 등 prop으로 색상을 전달해야 하는 경우: `hsl(var(--token-name))` 형식 사용

#### Accessibility (a11y)

- **아이콘 전용 버튼**: 반드시 `aria-label` 속성을 추가한다 (예: `aria-label="Delete column"`)
- **토글 버튼**: `aria-label`에 대상 컨텍스트를 포함한다 (예: `` aria-label={`Toggle PK for ${col.name}`} ``)
- **form 요소**: `<label>` 연결이 불가능한 경우 `aria-label`을 추가한다
- shadcn/ui 컴포넌트는 Radix UI가 접근성을 처리하므로 추가 작업 불필요

#### Page Component Code Ordering (MUST follow)

페이지 컴포넌트 내부의 코드는 다음 순서로 그룹핑하여 정렬한다:

| 순번 | 그룹 | 예시 |
|------|------|------|
| 1 | URL 파라미터 | `useParams` |
| 2 | 라우터 훅 | `useNavigate` |
| 3 | Query Client | `useQueryClient` |
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
// Function — multi-line with @param
/**
 * 팀에 멤버를 초대한다.
 *
 * @param teamId  대상 팀 ID
 * @param loginId 초대할 사용자 로그인 ID
 * @param role    부여할 역할 (MEMBER, VIEWER)
 */
export async function inviteMember(teamId: string, loginId: string, role: string): Promise<void> { ... }

// Interface field — single-line
export interface Team {
  /** 팀 고유 ID */
  id: number;
  /** 팀 이름 */
  name: string;
}

// State variable — single-line above
/** 삭제 확인 대상 프로젝트 ID (null이면 다이얼로그 닫힘) */
const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
```

### Formatting — Prettier

- Root `.prettierrc.json` with `prettier-plugin-java`
- Java: tabWidth 4, printWidth 120
- TypeScript: tabWidth 2, printWidth 100
- SonarQube S1611 (lambda parentheses) suppressed in favor of Prettier

### Gradle Annotation Processor Order

Lombok must be declared before QueryDSL in `annotationProcessor` dependencies — otherwise QueryDSL code generation fails.

```groovy
// Lombok (first)
annotationProcessor 'org.projectlombok:lombok'
// QueryDSL (after)
annotationProcessor 'com.querydsl:querydsl-apt:5.1.0:jakarta'
```
