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

### Backend: Spring Boot 3.4.2 / Java 21
Base package: `com.smarterd`

```
src/main/java/com/smarterd/
├── api/auth/          # REST controllers (currently stub login/signup)
├── config/            # SecurityConfig, JwtTokenProvider, JwtAuthenticationFilter, CorsConfig, BlazePersistenceConfig
└── domain/
    ├── common/entity/ # BaseTimeEntity (createdAt/updatedAt audit)
    ├── user/          # User entity + UserRepository
    ├── team/          # Team, TeamMember (@IdClass composite key), TeamMemberRole enum
    ├── project/       # Project entity + repo
    ├── diagram/       # Diagram entity (CLOB content stores serialized React Flow JSON)
    └── dictionary/    # Domain (logical→physical type mapping), Term (logical→physical name mapping)
```

**Entity ownership chain:** User → Team → (Project → Diagram, Domain, Term). TeamMember is a join table with `@IdClass(TeamMemberId)` composite key (team_id + user_id) and role enum (ADMIN, MEMBER, VIEWER).

**Security:** JWT stateless auth with Spring Security 6.x lambda DSL. `JwtAuthenticationFilter` extracts Bearer token, validates via `JwtTokenProvider` (JJWT 0.12.6, HMAC-SHA256). `/api/auth/**` and `/h2-console/**` are public; all else requires authentication.

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
│   └── LoginPage.tsx       # Auth page (unused)
├── stores/useCanvasStore.ts # Zustand store: nodes, edges, onNodesChange/onEdgesChange/onConnect, serialize/deserialize
└── types/erd.ts            # Column, TableNodeData, TableNode, ERDEdge types
```

### Key Conventions
- **Handle IDs:** `{nodeId}-{colId}-source` / `{nodeId}-{colId}-target` — enables column-level relationships
- **Edge IDs:** `e-{sourceHandle}-{targetHandle}`
- **Diagram persistence:** `useCanvasStore.serialize()` → JSON string stored in `Diagram.content` (CLOB)
- **Type assertion needed:** `applyNodeChanges()` returns generic `Node[]`, must cast to `Node<TableNodeData>[]`

### Tech Stack
| Layer | Stack |
|-------|-------|
| Backend | Spring Boot 3.4.2, Java 21, Gradle 8.12, Spring Security 6.x, Spring Data JPA |
| Query | QueryDSL 5.1.0:jakarta, Blaze-Persistence 1.6.17 (configured, not yet used) |
| Auth | JJWT 0.12.6 (HMAC-SHA256), BCrypt |
| DB | H2 in-memory |
| Frontend | React 18, TypeScript 5.6, Vite 6, @xyflow/react 12, Zustand 5, Tailwind CSS 3.4 |
| Editor | @monaco-editor/react 4.6 |

### Gradle Annotation Processor Order
Lombok must be declared before QueryDSL in `annotationProcessor` dependencies — otherwise QueryDSL code generation fails.
