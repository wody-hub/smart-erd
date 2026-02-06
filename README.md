# Smart ERD

ERwin과 같은 ERD 설계 도구를 웹 기반으로 구현한 간이 솔루션.

테이블 노드를 시각적으로 배치하고, 컬럼 레벨의 관계(FK)를 드래그로 연결하며, 데이터 사전(도메인/용어)을 통해 컬럼 타입과 이름을 표준화할 수 있다.

## 기술 스택

| 계층       | 기술                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| Backend    | Spring Boot 3.5.10, Java 25, Gradle 8.12, Spring Security 6.x, Spring Data JPA |
| 인증       | Spring OAuth2 Resource Server (HMAC-SHA256 JWT), BCrypt                         |
| 쿼리       | QueryDSL 5.1.0:jakarta, Blaze-Persistence 1.6.17                               |
| DB         | H2 in-memory (`ddl-auto: create-drop`)                                          |
| Frontend   | React 18, TypeScript 5.6, Vite 6, Tailwind CSS 3.4, shadcn/ui                  |
| API 문서   | springdoc-openapi (Swagger UI)                                                   |
| ERD 캔버스 | @xyflow/react 12, Zustand 5                                                     |
| 에디터     | @monaco-editor/react 4.6                                                        |
| 포맷팅     | Prettier (Java + TypeScript 통합), prettier-plugin-java                          |
| 코드 품질  | ESLint, SonarQube / SonarLint                                                    |

## 시작하기

### 사전 요구사항

- Java 25+
- Node.js 20+

### 백엔드

```bash
./gradlew bootRun          # http://localhost:8080
```

### 프론트엔드

```bash
cd client
npm install
npm run dev                # http://localhost:3000 (프록시 /api → :8080)
```

### 환경변수

| 변수                    | 설명               | 기본값                                   |
| ----------------------- | ------------------ | ---------------------------------------- |
| `SMART_ERD_JWT_SECRET`  | JWT 서명 키 (Base64) | 개발용 기본값 내장 (`application.yml`)     |

## 프로젝트 구조

### 백엔드

기본 패키지: `com.smarterd`

```text
src/main/java/com/smarterd/
├── SmartErdApplication.java         # 애플리케이션 진입점 (@SpringBootApplication)
├── package-info.java                # @NonNullApi 선언 (하위 패키지 전체 non-null 정책)
├── api/                             # HTTP 인터페이스 계층
│   ├── auth/
│   │   ├── AuthController.java      #   POST /api/auth/login, /api/auth/signup
│   │   └── dto/                     #   LoginRequest, SignupRequest, AuthResponse (record)
│   ├── team/
│   │   ├── TeamController.java      #   팀 CRUD + 멤버 관리 (7 엔드포인트)
│   │   └── dto/                     #   CreateTeamRequest, TeamResponse, AddMemberRequest 등
│   ├── project/
│   │   ├── ProjectController.java   #   프로젝트 CRUD (4 엔드포인트)
│   │   └── dto/                     #   CreateProjectRequest, ProjectResponse
│   └── common/
│       └── GlobalExceptionHandler.java  # 전역 예외 처리 (404/403/409/400 매핑)
├── config/                          # 설정
│   ├── SecurityConfig.java          #   Spring Security (OAuth2 Resource Server JWT, CSRF 비활성)
│   ├── JwtConfig.java               #   JwtEncoder / JwtDecoder 빈 (NimbusJwtDecoder, HS256)
│   ├── JwtProperties.java           #   @ConfigurationProperties("smart-erd.jwt") — secret, expiration
│   ├── CorsConfig.java              #   @ConfigurationProperties("smart-erd.cors") + CorsProperties 내부 클래스
│   └── OpenApiConfig.java           #   Swagger/OpenAPI 설정 (JWT Bearer 인증 스킴)
└── domain/                          # 도메인 계층 (Service도 여기에 위치)
    ├── common/
    │   ├── entity/                   #   BaseTimeEntity (createdAt, updatedAt 자동 감사)
    │   └── exception/               #   커스텀 예외 계층 (4종)
    │       ├── EntityNotFoundException.java   # → 404
    │       ├── AccessDeniedException.java     # → 403
    │       ├── DuplicateException.java        # → 409
    │       └── BusinessException.java         # → 400
    ├── user/
    │   ├── entity/                   #   User (loginId unique, BCrypt password)
    │   ├── repository/              #   UserRepository (findByLoginId, existsByLoginId)
    │   └── service/                 #   AuthService, AuthUserDetailsService, JwtTokenService
    ├── team/
    │   ├── entity/                  #   Team, TeamMember (@IdClass), TeamMemberId (record), TeamMemberRole
    │   ├── repository/             #   TeamRepository, TeamMemberRepository
    │   └── service/                #   TeamService (팀 CRUD + 멤버 관리, ADMIN 권한 체크)
    ├── project/
    │   ├── entity/                  #   Project (team 소속)
    │   ├── repository/             #   ProjectRepository (findByTeam)
    │   └── service/                #   ProjectService (프로젝트 CRUD, 팀 소속 확인)
    ├── diagram/
    │   ├── entity/                  #   Diagram (CLOB content — React Flow JSON 직렬화)
    │   └── repository/             #   DiagramRepository
    └── dictionary/
        ├── entity/                  #   Domain (논리명→물리타입), Term (논리명→물리명)
        └── repository/             #   DomainRepository, TermRepository
```

### 프론트엔드

```text
client/
├── index.html                       # SPA 진입점
├── package.json                     # "type": "module" (ESM)
├── tailwind.config.js               # CSS 변수 기반 색상, darkMode: ["class"], tailwindcss-animate
├── postcss.config.js                # tailwindcss + autoprefixer
├── vite.config.ts                   # @/ alias → ./src, 프록시 /api → :8080
├── tsconfig.app.json                # paths: { "@/*": ["./src/*"] }
├── .prettierrc.json                 # Prettier 설정
├── .prettierignore                  # Prettier 무시 파일
├── eslint.config.js                 # ESLint flat config (TypeScript + Prettier)
└── src/
    ├── main.tsx                     # createRoot + StrictMode
    ├── App.tsx                      # BrowserRouter + Routes (인증 가드 포함)
    ├── index.css                    # Tailwind directives + CSS 변수 (light/dark)
    ├── vite-env.d.ts                # Vite 타입 참조
    ├── api/
    │   └── axiosInstance.ts         # baseURL: /api, JWT Bearer 자동 첨부, 401 리다이렉트
    ├── components/
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx   # 인증 가드 (미인증 시 /login 리다이렉트)
    │   ├── erd/
    │   │   ├── ERDCanvas.tsx        # @xyflow/react 캔버스 (16x16 그리드 스냅, MiniMap, Controls, step edge)
    │   │   └── TableNode.tsx        # 커스텀 노드: 테이블 헤더 + 컬럼 행 (PK/FK 뱃지, 좌우 Handle)
    │   ├── layout/
    │   │   ├── Header.tsx           # 상단 고정 헤더 (사용자명 표시, 로그아웃)
    │   │   └── Sidebar.tsx          # 좌측 사이드바 (w-56, 테이블 목록)
    │   └── ui/                      # shadcn/ui 컴포넌트
    │       ├── button.tsx           #   Button — 6 variant, 4 size, asChild(@radix-ui/react-slot)
    │       ├── card.tsx             #   Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter
    │       ├── dialog.tsx           #   Dialog — @radix-ui/react-dialog
    │       ├── dropdown-menu.tsx    #   DropdownMenu — @radix-ui/react-dropdown-menu
    │       ├── input.tsx            #   Input — 순수 HTML input (shadcn/ui 표준)
    │       └── label.tsx            #   Label — @radix-ui/react-label + CVA
    ├── lib/
    │   └── utils.ts                 # cn() = clsx + tailwind-merge
    ├── pages/
    │   ├── DiagramPage.tsx          # 메인 레이아웃: Header + Sidebar + ERDCanvas
    │   ├── LoginPage.tsx            # 로그인 폼 (API 연동, 회원가입 링크)
    │   ├── SignupPage.tsx           # 회원가입 폼 (성공 시 자동 로그인)
    │   ├── TeamsPage.tsx            # 팀 목록 + 팀 생성 다이얼로그
    │   └── ProjectsPage.tsx         # 프로젝트 목록 + 생성/삭제 + 멤버 관리
    ├── stores/
    │   ├── useAuthStore.ts          # Zustand: 인증 상태 (token, loginId, name) + localStorage 동기화
    │   └── useCanvasStore.ts        # Zustand: nodes, edges, onChange 핸들러, serialize/deserialize
    └── types/
        └── erd.ts                   # Column, TableNodeData, TableNode, ERDEdge
```

## 코드 표준

### Java 코딩 스타일

#### 모던 Java 관용구

프로젝트 전반에서 모던 Java 기능을 적극 활용한다.

| 기능 | 적용 범위 | 예시 |
| ---- | --------- | ---- |
| `var` (지역 변수 타입 추론) | 서비스, 설정 클래스의 지역 변수 | `var user = findUserByLoginId(loginId);` |
| `record` (불변 데이터 클래스) | DTO, 복합키 클래스 | `public record TeamMemberId(Long team, Long user) implements Serializable {}` |
| `List.of()` | 불변 빈 컬렉션 | `List.of()` (~~`Collections.emptyList()`~~ 사용 금지) |
| Stream API | 컬렉션 변환, 필터링 | `.stream().map(ProjectResponse::from).toList()` |
| Optional | JPA 단건 조회 결과 처리 | `.findByLoginId(id).orElseThrow(() -> ...)` |

#### Import 규칙

- **와일드카드 import (`.*`) 사용 금지** — 모든 import는 명시적으로 선언한다
- Prettier가 저장 시 자동 포맷, VS Code `organizeImports`가 import 정리를 수행한다

```java
// Good
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

// Bad
import jakarta.persistence.*;
```

#### 예외 처리 체계

`IllegalArgumentException` 등 범용 예외 대신 도메인별 커스텀 예외를 사용한다.

| 예외 클래스 | HTTP 상태 | 용도 |
| ----------- | --------- | ---- |
| `EntityNotFoundException` | 404 Not Found | 엔티티 조회 실패 |
| `AccessDeniedException` | 403 Forbidden | 권한 부족 (팀 미소속, ADMIN 아님) |
| `DuplicateException` | 409 Conflict | 중복 리소스 (팀 멤버 중복, 로그인 ID 중복) |
| `BusinessException` | 400 Bad Request | 비즈니스 규칙 위반 (소유자 제거 시도 등) |

모든 예외는 `domain/common/exception/` 패키지에 위치하며, `GlobalExceptionHandler`에서 HTTP 응답으로 변환된다.

```java
// Good — 구체적 예외
throw new EntityNotFoundException("User not found: " + loginId);
throw new DuplicateException("Login ID already exists: " + request.loginId());

// Bad — 범용 예외
throw new IllegalArgumentException("User not found");
```

#### 트랜잭션 패턴

- 서비스 클래스 레벨에 `@Transactional(readOnly = true)` 선언 (기본: 읽기 전용)
- 쓰기 메서드에만 `@Transactional` 오버라이드

```java
@Service
@Transactional(readOnly = true)    // 클래스 레벨 — 읽기 전용 기본
public class TeamService {

    @Transactional                  // 메서드 레벨 — 쓰기 오버라이드
    public TeamResponse createTeam(...) { ... }

    public List<TeamResponse> getMyTeams(...) { ... }  // readOnly 유지
}
```

#### JPA Dirty Checking 활용

엔티티 상태 변경 시 delete → save 대신 setter 메서드로 JPA dirty checking을 활용한다.

```java
// Good — dirty checking
member.changeRole(request.role());

// Bad — delete + flush + save
teamMemberRepository.delete(member);
teamMemberRepository.flush();
teamMemberRepository.save(newMember);
```

#### Null Safety

- 루트 패키지에 `@NonNullApi` 선언 → 하위 전체 non-null 기본 정책
- JPA 리포지토리 호출 시 null 분석 경고를 억제하기 위해 서비스 클래스에 `@SuppressWarnings("null")` 적용

```java
@Service
@SuppressWarnings("null")          // JPA 리포지토리 null 분석 경고 억제
public class TeamService { ... }
```

### 포맷팅 — Prettier (Java + TypeScript 통합)

프로젝트 루트에 Prettier를 설치하여 Java와 TypeScript 코드를 통합 포맷팅한다.

#### 설정 파일

| 파일 | 위치 | 역할 |
| ---- | ---- | ---- |
| `.prettierrc.json` | 프로젝트 루트 | 포맷 규칙 (Java/TS 오버라이드 포함) |
| `.prettierignore` | 프로젝트 루트 | 빌드 산출물 제외 |
| `package.json` | 프로젝트 루트 | `prettier` + `prettier-plugin-java` 의존성, format 스크립트 |

#### 언어별 포맷 규칙

| 설정 | Java | TypeScript/TSX |
| ---- | ---- | -------------- |
| `tabWidth` | 4 | 2 |
| `printWidth` | 120 | 100 |
| `singleQuote` | — | `true` |
| `semi` | `true` | `true` |
| `trailingComma` | `all` | `all` |
| `arrowParens` | `always` | `always` |

#### 포맷 명령어

```bash
# 전체 포맷팅 (Java + TypeScript)
npm run format

# Java만
npm run format:java

# TypeScript만
npm run format:client

# 포맷 검사 (CI용)
npm run format:check
```

#### Prettier와 SonarQube 충돌 해결

Prettier는 단일 파라미터 람다에 괄호를 추가하지만 (`(x) -> ...`), SonarQube S1611은 이를 제거하라고 경고한다.
**Prettier를 우선**으로 하고 S1611을 억제한다.

- `sonar-project.properties` — S1611 전역 무시
- VS Code User Settings — `sonarlint.rules: java:S1611: off`

### VS Code 개발 환경

`.vscode/settings.json`에 다음 설정이 포함되어 있다.

| 기능 | 설정 | 설명 |
| ---- | ---- | ---- |
| 자동 포맷 | `editor.formatOnSave: true` | 저장 시 Prettier 자동 적용 |
| Import 정리 | `source.organizeImports: explicit` | 저장 시 미사용 import 제거 및 정렬 |
| 자동 저장 | `files.autoSave: afterDelay` (1초) | 1초 후 자동 저장 |
| 자동 빌드 | `java.autobuild.enabled: true` | Java 파일 변경 시 자동 빌드 |
| Null 분석 | `java.compile.nullAnalysis.mode: automatic` | `@NonNullApi` 기반 null 분석 활성화 |
| 후행 공백 | `files.trimTrailingWhitespace: true` | 저장 시 후행 공백 제거 |
| 최종 개행 | `files.insertFinalNewline: true` | 파일 끝 개행 자동 추가 |

**에디터 기본 포맷터:** Java, TypeScript 모두 `esbenp.prettier-vscode` (Prettier)

### TypeScript 코딩 스타일

- ESM 전용 (`"type": "module"`) — `require()` 사용 금지, ESM import만 사용
- `@/` alias로 import (`@/components/ui/button`, `@/lib/utils`)
- 상태 관리는 `stores/` 디렉토리, `use` prefix 컨벤션
- shadcn/ui 컴포넌트 추가 시: `components/ui/`에 파일 생성, `cn()` 사용, `forwardRef` 패턴 적용

### 패키지 규칙

**백엔드:**

| 패키지 | 역할 | 포함 요소 |
| ------ | ---- | --------- |
| `api/` | HTTP 인터페이스 계층 | Controller, DTO (record) |
| `domain/` | 비즈니스 도메인 계층 | Entity, Repository, Service |
| `domain/common/` | 공통 코드 | BaseTimeEntity, 커스텀 예외 |
| `config/` | 설정 | Security, JWT, CORS, OpenAPI |

- DTO는 Java `record`로 작성, `@Valid` 검증 포함
- `api/` 계층에 비즈니스 로직 금지
- Service는 해당 도메인 패키지(`domain/xxx/service/`) 아래에 위치

**프론트엔드:**

| 디렉토리 | 역할 |
| -------- | ---- |
| `components/ui/` | 범용 재사용 컴포넌트 (shadcn/ui). 도메인 로직 금지 |
| `components/auth/` | 인증 관련 컴포넌트 (ProtectedRoute) |
| `components/erd/` | ERD 도메인 전용 컴포넌트 |
| `components/layout/` | 페이지 구조 컴포넌트 (Header, Sidebar) |
| `pages/` | 페이지 컴포넌트 (라우트 단위) |
| `stores/` | Zustand 상태 관리 (`use` prefix) |
| `types/` | TypeScript 타입 정의 |

## 엔티티 관계

```text
User ─┬─< TeamMember >─── Team ─┬─< Project ─< Diagram
      │   (record 복합키)        ├─< Domain
      └── owner_id ─────────────┘└─< Term ──> Domain (nullable)
```

- **User** : 사용자 (`loginId`로 인증, BCrypt 비밀번호)
- **Team** : 프로젝트와 데이터 사전을 소유하는 조직 단위
- **TeamMember** : 팀-사용자 다대다 조인 (`@IdClass(TeamMemberId)` record 복합키, 역할: ADMIN, MEMBER, VIEWER)
- **Project** : ERD 프로젝트 그룹 (Team 소속)
- **Diagram** : React Flow JSON을 CLOB으로 저장하는 ERD 다이어그램 (Project 소속)
- **Domain** : 논리명→물리 데이터타입 매핑 사전 (예: "금액" → `DECIMAL(15,2)`)
- **Term** : 논리명→물리명 매핑 사전 (예: "사용자명" → `user_name`), Domain 참조 가능

모든 엔티티는 `BaseTimeEntity`를 상속하여 `createdAt`, `updatedAt`을 자동 기록한다.

## API 엔드포인트

### 인증 (`/api/auth/**` — 공개)

| Method | Path                | 설명     | Request Body                                        | Response                         |
| ------ | ------------------- | -------- | --------------------------------------------------- | -------------------------------- |
| POST   | `/api/auth/signup`  | 회원가입 | `{ loginId, password (8+), name }`                   | `{ token, loginId, name }`       |
| POST   | `/api/auth/login`   | 로그인   | `{ loginId, password }`                              | `{ token, loginId, name }`       |

### 팀 (`/api/teams/**` — 인증 필요)

| Method | Path                              | 설명          | Request Body                    |
| ------ | --------------------------------- | ------------- | ------------------------------- |
| POST   | `/api/teams`                      | 팀 생성       | `{ name }`                      |
| GET    | `/api/teams`                      | 내 팀 목록    | —                               |
| GET    | `/api/teams/{id}`                 | 팀 상세       | —                               |
| GET    | `/api/teams/{id}/members`         | 멤버 목록     | —                               |
| POST   | `/api/teams/{id}/members`         | 멤버 초대     | `{ loginId, role }`             |
| DELETE | `/api/teams/{id}/members/{userId}`| 멤버 제거     | —                               |
| PATCH  | `/api/teams/{id}/members/{userId}`| 역할 변경     | `{ role }`                      |

### 프로젝트 (`/api/teams/{teamId}/projects/**` — 인증 필요)

| Method | Path                                          | 설명          | Request Body    |
| ------ | --------------------------------------------- | ------------- | --------------- |
| POST   | `/api/teams/{teamId}/projects`                | 프로젝트 생성 | `{ name }`      |
| GET    | `/api/teams/{teamId}/projects`                | 프로젝트 목록 | —               |
| GET    | `/api/teams/{teamId}/projects/{id}`           | 프로젝트 상세 | —               |
| DELETE | `/api/teams/{teamId}/projects/{id}`           | 프로젝트 삭제 | —               |

### Swagger UI

`http://localhost:8080/swagger-ui/index.html`

모든 컨트롤러에 `@Operation`, `@ApiResponse`, `@Parameter`, `@Schema` 어노테이션 적용됨. JWT Bearer 인증이 필요한 엔드포인트는 Swagger UI에서 Authorize 버튼으로 토큰 설정 후 테스트 가능.

### 인증 흐름

```text
Client                              Server
  │  POST /api/auth/login            │
  │  { loginId, password }    ────►  │ AuthenticationManager 검증
  │                                  │ JwtTokenService.generateToken()
  │  ◄────  { token, loginId, name } │
  │                                  │
  │  GET /api/...                    │
  │  Authorization: Bearer <token>   │ BearerTokenAuthenticationFilter
  │                           ────►  │ JwtDecoder (NimbusJwtDecoder, HS256)
  │  ◄────  200 OK / 401            │
```

- JWT 토큰은 HMAC-SHA256으로 서명, 만료 시간 24시간 (86400000ms)
- 프론트엔드는 `localStorage`에 토큰 저장, Axios 인터셉터로 자동 첨부

### 에러 응답 형식

모든 에러는 통일된 JSON 형식으로 반환된다.

```json
{ "error": "User not found: testuser" }
```

| HTTP 상태 | 발생 조건 |
| --------- | --------- |
| 400 | 유효성 검증 실패, 비즈니스 규칙 위반 |
| 401 | JWT 토큰 없음 또는 만료 |
| 403 | 팀 미소속, ADMIN 권한 필요 |
| 404 | 엔티티 미존재 |
| 409 | 중복 리소스 (멤버, 로그인 ID) |

## 프론트엔드 상세

### shadcn/ui 설정

CSS 변수 기반 디자인 토큰 시스템. `index.css`에 light/dark 테마 변수 정의.

```text
tailwind.config.js  →  CSS 변수 색상 매핑 (hsl), darkMode: ["class"], tailwindcss-animate
index.css           →  :root / .dark CSS 변수, 전역 border-border + box-sizing
lib/utils.ts        →  cn() = clsx + tailwind-merge (클래스 병합 유틸리티)
```

새 shadcn/ui 컴포넌트 추가 시: `components/ui/`에 파일 생성, `cn()` 사용, forwardRef 패턴 적용.

### ERD 캔버스

- **@xyflow/react** 기반, 16x16 그리드 스냅
- 커스텀 `TableNode`: 테이블 헤더 + 컬럼 행, 각 컬럼에 좌(target)/우(source) Handle
- Handle ID: `{nodeId}-{colId}-source` / `{nodeId}-{colId}-target`
- Edge ID: `e-{sourceHandle}-{targetHandle}`
- Edge 타입: `step` (직각 연결), `MarkerType.ArrowClosed`
- 상태: Zustand `useCanvasStore` — `serialize()` → JSON 문자열 → `Diagram.content` (CLOB)

### 라우팅

```text
/login                                    — 로그인 (공개)
/signup                                   — 회원가입 (공개)
/teams                                    — 팀 목록 (인증 필요)
/teams/:teamId/projects                   — 프로젝트 목록 (인증 필요)
/teams/:teamId/projects/:projectId/diagrams/:diagramId — ERD 편집기 (인증 필요)
```

인증되지 않은 사용자는 `ProtectedRoute`에 의해 `/login`으로 리다이렉트된다.

### Axios 인스턴스

```text
baseURL: /api  →  Vite 프록시  →  localhost:8080
요청 인터셉터: localStorage.getItem('token') → Authorization: Bearer <token>
응답 인터셉터: 401 응답 시 토큰 삭제 + /login 리다이렉트
```

## 설정 상세

### `application.yml`

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:smarterd           # H2 인메모리
  jpa:
    hibernate.ddl-auto: create-drop     # 기동 시 스키마 재생성
    show-sql: true

smart-erd:
  cors:
    allowed-origins: http://localhost:3000
  jwt:
    secret: ${SMART_ERD_JWT_SECRET:기본값}
    expiration: 86400000                # 24시간 (ms)
```

### Spring Security 접근 제어

| 경로                | 접근 권한  |
| ------------------- | --------- |
| `/api/auth/**`      | 공개       |
| `/h2-console/**`    | 공개       |
| `/swagger-ui/**`    | 공개       |
| `/v3/api-docs/**`   | 공개       |
| 그 외 모든 경로      | 인증 필요  |

### Gradle Annotation Processor 순서

`build.gradle`에서 Lombok `annotationProcessor`를 QueryDSL보다 **먼저** 선언해야 한다. 순서가 바뀌면 QueryDSL 코드 생성이 실패한다.

```groovy
// Lombok (먼저)
annotationProcessor 'org.projectlombok:lombok'
// QueryDSL (나중)
annotationProcessor 'com.querydsl:querydsl-apt:5.1.0:jakarta'
```

## 빌드 명령어

```bash
# 백엔드
./gradlew bootRun            # 개발 서버 기동 (:8080)
./gradlew build              # 전체 빌드 (컴파일 + 테스트)
./gradlew test               # 테스트 실행
./gradlew compileJava        # 컴파일만 (QueryDSL/Lombok AP 트리거)

# 프론트엔드
cd client
npm run dev                  # 개발 서버 기동 (:3000, 프록시 /api → :8080)
npm run build                # 프로덕션 빌드 (tsc + vite)
npm run lint                 # ESLint

# 포맷팅 (프로젝트 루트에서)
npm run format               # Java + TypeScript 전체 포맷팅
npm run format:java          # Java만
npm run format:client        # TypeScript만
npm run format:check         # 포맷 검사 (CI용)
```

## 데이터베이스

H2 인메모리 DB를 사용하며, 서버 기동 시마다 스키마가 재생성된다 (`ddl-auto: create-drop`).

- H2 콘솔: `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:mem:smarterd`
- Username: `sa` / Password: (없음)
