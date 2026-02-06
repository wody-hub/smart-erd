# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

### Backend (Spring Boot)
```bash
./gradlew bootRun                    # Start backend on :8080
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

| Variable | Description | Default |
|----------|-------------|---------|
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
    │   ├── entity/                  #   Diagram (CLOB content — serialized React Flow JSON)
    │   └── repository/             #   DiagramRepository
    └── dictionary/
        ├── entity/                  #   Domain (logical→physical type), Term (logical→physical name)
        └── repository/             #   DomainRepository, TermRepository
```

**Entity ownership chain:** User → Team → (Project → Diagram, Domain, Term). TeamMember is a join table with `@IdClass(TeamMemberId)` record composite key (team_id + user_id) and role enum (ADMIN, MEMBER, VIEWER).

**Package convention:** `api/` layer holds HTTP interface only (Controller + DTO). Business logic (Service) resides in `domain/` layer under the relevant domain package. DTOs are Java `record` types with `@Valid` annotations.

**Security:** JWT stateless auth with Spring Security OAuth2 Resource Server. Built-in `BearerTokenAuthenticationFilter` validates Bearer tokens via `JwtDecoder` (NimbusJwtDecoder, HMAC-SHA256).

| Path | Access |
|------|--------|
| `/api/auth/**` | Public |
| `/h2-console/**` | Public |
| `/swagger-ui/**`, `/v3/api-docs/**` | Public |
| All other paths | Authenticated |

**Configuration:** Custom properties are namespaced under `smart-erd.*` in `application.yml`. JWT and CORS settings use `@ConfigurationProperties` for type-safe binding (`smart-erd.jwt.*`, `smart-erd.cors.*`).

**Database:** H2 in-memory with `ddl-auto: create-drop`. H2 console at `/h2-console`.

### Frontend: Vite 6 + React 18 + TypeScript + shadcn/ui

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
    ├── App.tsx                      # Root component (BrowserRouter + Routes + ProtectedRoute guards)
    ├── index.css                    # Tailwind directives + CSS variables (light/dark)
    ├── vite-env.d.ts                # Vite type reference
    ├── api/
    │   └── axiosInstance.ts         # baseURL: /api, JWT auto-attach + 401 redirect interceptors
    ├── components/
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx   # Auth guard (redirects to /login if no token)
    │   ├── erd/
    │   │   ├── ERDCanvas.tsx        # @xyflow/react canvas (16x16 grid snap, MiniMap, Controls, step edge)
    │   │   └── TableNode.tsx        # Custom node: table header + column rows (PK/FK badges, L/R handles)
    │   ├── layout/
    │   │   ├── Header.tsx           # Top header (h-12, bg-gray-900, user name + logout)
    │   │   └── Sidebar.tsx          # Left sidebar (w-56, table list)
    │   └── ui/                      # shadcn/ui components
    │       ├── button.tsx           #   Button — 6 variants, 4 sizes, asChild (@radix-ui/react-slot)
    │       ├── card.tsx             #   Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter
    │       ├── dialog.tsx           #   Dialog/DialogContent/DialogHeader/DialogFooter/DialogTitle
    │       ├── dropdown-menu.tsx    #   DropdownMenu (full Radix implementation)
    │       ├── input.tsx            #   Input — plain HTML input (shadcn/ui standard)
    │       └── label.tsx            #   Label — @radix-ui/react-label + CVA
    ├── lib/
    │   └── utils.ts                 # cn() = clsx + tailwind-merge
    ├── pages/
    │   ├── DiagramPage.tsx          # Main layout: Header + Sidebar + ERDCanvas
    │   ├── LoginPage.tsx            # Login form (API-connected, redirects to /teams on success)
    │   ├── SignupPage.tsx           # Signup form (auto-login on success)
    │   ├── TeamsPage.tsx            # Team list + create team dialog
    │   └── ProjectsPage.tsx         # Project list + create/delete + member management dialog
    ├── stores/
    │   ├── useAuthStore.ts          # Zustand: token, loginId, name, login/logout (localStorage sync)
    │   └── useCanvasStore.ts        # Zustand: nodes, edges, onChange handlers, serialize/deserialize
    └── types/
        └── erd.ts                   # Column, TableNodeData, TableNode, ERDEdge
```

**Frontend conventions:**

- `components/ui/` — Reusable primitives (shadcn/ui). No domain logic.
- `components/auth/` — Authentication components (ProtectedRoute).
- `components/erd/` — ERD domain-specific components.
- `components/layout/` — Page structure components (Header, Sidebar).
- Use `@/` alias for imports (`@/components/ui/button`, `@/lib/utils`).
- State management in `stores/` directory, `use` prefix convention.
- ESM only (`"type": "module"`) — never use `require()`, use ESM imports.
- Adding new shadcn/ui components: create file in `components/ui/`, use `cn()`, apply `forwardRef` pattern.

**Routes:** `/login`, `/signup`, `/teams`, `/teams/:teamId/projects`, `/teams/:teamId/projects/:projectId/diagrams/:diagramId`. All routes except `/login` and `/signup` are protected by `ProtectedRoute`.

### Key Conventions

- **Handle IDs:** `{nodeId}-{colId}-source` / `{nodeId}-{colId}-target` — enables column-level relationships
- **Edge IDs:** `e-{sourceHandle}-{targetHandle}`
- **Diagram persistence:** `useCanvasStore.serialize()` → JSON string stored in `Diagram.content` (CLOB)
- **Type assertion needed:** `applyNodeChanges()` returns generic `Node[]`, must cast to `Node<TableNodeData>[]`
- **Documentation:** All classes, methods, and fields have Javadoc/JSDoc. Fields use single-line `/** */` format.

### Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Spring Boot 3.5.10, Java 25, Gradle 8.12, Spring Security 6.x, Spring Data JPA |
| Query | QueryDSL 5.1.0:jakarta, Blaze-Persistence 1.6.17 |
| Auth | Spring OAuth2 Resource Server (HMAC-SHA256 JWT), BCrypt |
| DB | H2 in-memory |
| Frontend | React 18, TypeScript 5.6, Vite 6, Tailwind CSS 3.4, shadcn/ui |
| ERD Canvas | @xyflow/react 12, Zustand 5 |
| Editor | @monaco-editor/react 4.6 |
| Formatting | Prettier (Java + TypeScript), prettier-plugin-java |
| Code Quality | ESLint, SonarQube / SonarLint |

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

| Exception | HTTP Status | Usage |
|-----------|-------------|-------|
| `EntityNotFoundException` | 404 | Entity lookup failure |
| `AccessDeniedException` | 403 | Permission denied (not a member, not ADMIN) |
| `DuplicateException` | 409 | Duplicate resource (member, login ID) |
| `BusinessException` | 400 | Business rule violation (removing owner, etc.) |

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
