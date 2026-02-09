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
    │   ├── entity/                   #   User (loginId unique, BCrypt password)
    │   ├── repository/              #   UserRepository (findByLoginId, existsByLoginId)
    │   └── service/                 #   AuthService, AuthUserDetailsService, JwtTokenService
    ├── team/
    │   ├── entity/                  #   Team, TeamMember (@IdClass), TeamMemberId (record), TeamMemberRole
    │   ├── repository/             #   TeamRepository, TeamMemberRepository (findByUser, findByTeam, existsByTeamAndUser)
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

**Database:** PostgreSQL 17 (Docker). `spring-boot-docker-compose`가 `compose.yaml`을 자동 감지하여 컨테이너를 시작하고, datasource를 자동 주입한다. `ddl-auto: create-drop`. Docker Desktop이 실행 중이어야 한다.

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
    │   │   ├── Header.tsx           # Top header (h-12, bg-gray-900, user name + logout + save)
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
    │       └── label.tsx            #   Label — @radix-ui/react-label + CVA
    ├── lib/
    │   ├── utils.ts                 # cn() = clsx + tailwind-merge
    │   ├── api-error.ts             # getErrorMessage() — server error message extraction
    │   └── query-client.ts          # QueryClient (staleTime: 30s, retry: 1, refetchOnWindowFocus: false)
    ├── pages/
    │   ├── DiagramPage.tsx          # Diagram editor: Header + Sidebar + ERDCanvas (useQuery + useMutation)
    │   ├── DiagramsPage.tsx         # Diagram list + CRUD + inline rename (useQuery + useMutation)
    │   ├── LoginPage.tsx            # Login form (authApi, redirects to /teams on success)
    │   ├── SignupPage.tsx           # Signup form (authApi, auto-login on success)
    │   ├── TeamsPage.tsx            # Team list + create (useQuery + useMutation + CreateResourceDialog)
    │   └── ProjectsPage.tsx         # Project list + CRUD + member management (useQuery + useMutation)
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

- **`var`** for local variables where type is obvious from RHS: `var user = findUserByLoginId(loginId);`
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
- `useInlineEdit` hook — inline text editing pattern (SidebarTableItem, TableNode)

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
