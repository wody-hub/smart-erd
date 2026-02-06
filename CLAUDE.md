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

## Architecture

### Backend: Spring Boot 3.5.10 / Java 25
Base package: `com.smarterd`

```
src/main/java/com/smarterd/
├── SmartErdApplication.java         # Application entry point (@SpringBootApplication)
├── package-info.java                # @NonNullApi (non-null by default for all sub-packages)
├── api/auth/                        # HTTP interface layer (Controller + DTO)
│   ├── AuthController.java
│   └── dto/
├── config/                          # SecurityConfig, JwtConfig, JwtProperties, CorsConfig (+ CorsProperties)
└── domain/
    ├── common/entity/               # BaseTimeEntity (createdAt/updatedAt audit)
    ├── user/
    │   ├── entity/                  # User
    │   ├── repository/             # UserRepository
    │   └── service/                # AuthService, AuthUserDetailsService, JwtTokenService
    ├── team/                        # Team, TeamMember (@IdClass composite key), TeamMemberRole enum
    ├── project/                     # Project entity + repo
    ├── diagram/                     # Diagram entity (CLOB content stores serialized React Flow JSON)
    └── dictionary/                  # Domain (logical→physical type mapping), Term (logical→physical name mapping)
```

**Entity ownership chain:** User → Team → (Project → Diagram, Domain, Term). TeamMember is a join table with `@IdClass(TeamMemberId)` composite key (team_id + user_id) and role enum (ADMIN, MEMBER, VIEWER).

**Package convention:** `api/` layer holds HTTP interface only (Controller + DTO). Business logic (Service) resides in `domain/` layer under the relevant domain package.

**Security:** JWT stateless auth with Spring Security OAuth2 Resource Server. Built-in `BearerTokenAuthenticationFilter` validates Bearer tokens via `JwtDecoder` (NimbusJwtDecoder, HMAC-SHA256). `/api/auth/**` and `/h2-console/**` are public; all else requires authentication.

**Configuration:** Custom properties are namespaced under `smart-erd.*` in `application.yml`. JWT and CORS settings use `@ConfigurationProperties` for type-safe binding (`smart-erd.jwt.*`, `smart-erd.cors.*`).

**Database:** H2 in-memory with `ddl-auto: create-drop`. H2 console at `/h2-console`.

### Frontend: Vite 6 + React 18 + TypeScript
```
client/src/
├── api/axiosInstance.ts    # Axios with JWT interceptor (token from localStorage)
├── components/
│   ├── erd/
│   │   ├── ERDCanvas.tsx   # @xyflow/react canvas (grid snap 16x16, minimap, step edges)
│   │   └── TableNode.tsx   # Custom node: table header + column rows with PK/FK badges + handles
│   └── layout/             # Header, Sidebar
├── pages/
│   ├── DiagramPage.tsx     # Main layout: Header + Sidebar + ERDCanvas
│   └── LoginPage.tsx       # Auth page (UI shell)
├── stores/useCanvasStore.ts # Zustand store: nodes, edges, onNodesChange/onEdgesChange/onConnect, serialize/deserialize
└── types/erd.ts            # Column, TableNodeData, TableNode, ERDEdge types
```

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
| Query | QueryDSL 5.1.0:jakarta |
| Auth | Spring OAuth2 Resource Server (HMAC-SHA256 JWT), BCrypt |
| DB | H2 in-memory |
| Frontend | React 18, TypeScript 5.6, Vite 6, @xyflow/react 12, Zustand 5, Tailwind CSS 3.4 |
| Editor | @monaco-editor/react 4.6 |

### Gradle Annotation Processor Order
Lombok must be declared before QueryDSL in `annotationProcessor` dependencies — otherwise QueryDSL code generation fails.
