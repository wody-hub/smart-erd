# Smart ERD

> **Claude Code 응답 언어: 한글**

ERwin과 같은 ERD 설계 도구를 웹 기반으로 구현한 간이 솔루션.

테이블 노드를 시각적으로 배치하고, 컬럼 레벨의 관계(FK)를 드래그로 연결하며, 데이터 사전(도메인/용어)을 통해 컬럼 타입과 이름을 표준화할 수 있다.

## 기술 스택

| 계층        | 기술                                                                           |
| ----------- | ------------------------------------------------------------------------------ |
| Backend     | Spring Boot 3.5.10, Java 25, Gradle 8.12, Spring Security 6.x, Spring Data JPA |
| 인증        | Spring OAuth2 Resource Server (HMAC-SHA256 JWT), BCrypt                        |
| 쿼리        | QueryDSL 5.1.0:jakarta, Blaze-Persistence 1.6.17                               |
| DB          | PostgreSQL 17 (Docker), Testcontainers (test), `ddl-auto: update`              |
| Frontend    | React 19, TypeScript 5.6, Vite 6, Tailwind CSS 3.4, shadcn/ui                  |
| 데이터 페칭 | @tanstack/react-query 5 (useQuery, useMutation, 캐시 무효화)                   |
| API 문서    | springdoc-openapi (Swagger UI)                                                 |
| ERD 캔버스  | @xyflow/react 12, Zustand 5                                                    |
| 에디터      | @monaco-editor/react 4.6                                                       |
| 토스트      | Sonner                                                                         |
| 포맷팅      | Prettier (Java + TypeScript 통합), prettier-plugin-java                        |
| 코드 품질   | ESLint, SonarQube / SonarLint                                                  |

## 시작하기

### 사전 요구사항

- Java 25+
- Node.js 20+
- Docker Desktop (PostgreSQL 컨테이너 자동 기동)

### 백엔드

```bash
./gradlew bootRun          # http://localhost:8080 (Docker PostgreSQL 자동 시작)
```

### 프론트엔드

```bash
cd client
npm install
npm run dev                # http://localhost:3000 (프록시 /api → :8080)
```

### 환경변수

| 변수                   | 설명                 | 기본값                                 |
| ---------------------- | -------------------- | -------------------------------------- |
| `SMART_ERD_JWT_SECRET` | JWT 서명 키 (Base64) | 개발용 기본값 내장 (`application.yml`) |

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
│   ├── QuerydslConfig.java          #   JPAQueryFactory 빈 (QueryDSL 타입 안전 쿼리 빌더)
│   ├── BlazeConfig.java             #   CriteriaBuilderFactory 빈 (Blaze-Persistence 고급 쿼리)
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
    │   ├── entity/                   #   User, RefreshToken (loginId unique, BCrypt password)
    │   ├── repository/              #   UserRepository, RefreshTokenRepository (+Custom — QueryDSL bulk delete)
    │   └── service/                 #   AuthService, AuthUserDetailsService, JwtTokenService
    ├── team/
    │   ├── entity/                  #   Team, TeamMember (@IdClass), TeamMemberId (record), TeamMemberRole
    │   ├── repository/             #   TeamRepository (+Custom), TeamMemberRepository (+Custom) — QueryDSL fetch join
    │   └── service/                #   TeamService (팀 CRUD + 멤버 관리, ADMIN 권한 체크)
    ├── project/
    │   ├── entity/                  #   Project (team 소속)
    │   ├── repository/             #   ProjectRepository (findByTeam)
    │   └── service/                #   ProjectService (프로젝트 CRUD, 팀 소속 확인)
    ├── diagram/
    │   ├── entity/                  #   Diagram (TEXT content — React Flow JSON 직렬화)
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
    ├── App.tsx                      # QueryClientProvider + BrowserRouter + Routes (인증 가드 포함)
    ├── index.css                    # Tailwind directives + CSS 변수 (light/dark)
    ├── vite-env.d.ts                # Vite 타입 참조
    ├── api/
    │   ├── axiosInstance.ts         # baseURL: /api, JWT 자동 첨부 + 401 Refresh Token 갱신 (큐 패턴)
    │   ├── authApi.ts               # login(), signup()
    │   ├── teamApi.ts               # fetchTeams(), fetchTeam(), createTeam(), fetchMembers(), inviteMember(), removeMember()
    │   ├── projectApi.ts            # fetchProjects(), createProject(), deleteProject()
    │   └── diagramApi.ts            # fetchDiagrams(), fetchDiagram(), createDiagram(), saveDiagram(), renameDiagram(), deleteDiagram()
    ├── constants/
    │   ├── storage.ts               # STORAGE_KEYS — localStorage 키 상수
    │   ├── routes.ts                # ROUTES — 라우트 경로 상수 (정적 + 파라미터)
    │   └── query-keys.ts            # queryKeys — React Query 캐시 키 계층 구조
    ├── hooks/
    │   └── useInlineEdit.ts         # 인라인 텍스트 편집 공통 훅
    ├── components/
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx   # 인증 가드 (미인증 시 /login 리다이렉트)
    │   ├── erd/
    │   │   ├── ERDCanvas.tsx        # @xyflow/react 캔버스 (16x16 그리드 스냅, MiniMap, Controls, step edge)
    │   │   └── TableNode.tsx        # 커스텀 노드: 테이블 헤더 + 컬럼 행 (PK/FK 뱃지, 좌우 Handle)
    │   ├── layout/
    │   │   ├── Header.tsx           # 상단 고정 헤더 (bg-header, 사용자명, 로그아웃, 다이어그램 Save)
    │   │   ├── Sidebar.tsx          # 좌측 사이드바 (w-56, 테이블 목록)
    │   │   └── SidebarTableItem.tsx # 사이드바 개별 테이블 항목 (인라인 이름 변경)
    │   ├── team/
    │   │   └── MembersDialog.tsx    # 팀 멤버 관리 다이얼로그 (초대/제거, React Query 사용)
    │   └── ui/                      # shadcn/ui + 공유 UI 컴포넌트
    │       ├── confirm-dialog.tsx   #   확인/취소 다이얼로그 (window.confirm 대체)
    │       ├── create-resource-dialog.tsx  # 리소스 생성 다이얼로그 (Team/Project/Diagram 공용)
    │       ├── button.tsx           #   Button — 6 variant, 4 size, asChild(@radix-ui/react-slot)
    │       ├── card.tsx             #   Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter
    │       ├── dialog.tsx           #   Dialog — @radix-ui/react-dialog
    │       ├── dropdown-menu.tsx    #   DropdownMenu — @radix-ui/react-dropdown-menu
    │       ├── input.tsx            #   Input — 순수 HTML input (shadcn/ui 표준)
    │       ├── label.tsx            #   Label — @radix-ui/react-label + CVA
    │       └── spinner.tsx          #   Spinner — Loader2 animate-spin + 선택적 텍스트
    ├── lib/
    │   ├── utils.ts                 # cn() = clsx + tailwind-merge
    │   ├── api-error.ts             # getErrorMessage() — 서버 에러 메시지 추출
    │   └── query-client.ts          # QueryClient 설정 (staleTime: 30s, retry: 1)
    ├── pages/                       # 도메인별 페이지 디렉토리
    │   ├── auth/
    │   │   ├── LoginPage.tsx        # 로그인 폼 (authApi, 성공 시 /teams 이동)
    │   │   └── SignupPage.tsx       # 회원가입 폼 (authApi, 성공 시 자동 로그인)
    │   ├── team/
    │   │   └── TeamsPage.tsx        # 팀 목록 + 생성 (useQuery + useMutation + CreateResourceDialog)
    │   ├── project/
    │   │   └── ProjectsPage.tsx     # 프로젝트 목록 + CRUD + 멤버 관리 (useQuery + useMutation)
    │   └── diagram/
    │       ├── DiagramsPage.tsx     # 다이어그램 목록 + CRUD + 인라인 이름 변경 (useQuery + useMutation)
    │       └── DiagramPage.tsx      # 다이어그램 편집기: Header + Sidebar + ERDCanvas (useQuery + useMutation)
    ├── stores/
    │   ├── useAuthStore.ts          # Zustand: 인증 상태 (tokens, loginId, name) + localStorage 동기화
    │   └── useCanvasStore.ts        # Zustand: nodes, edges, onChange 핸들러, serialize/deserialize
    └── types/
        ├── erd.ts                   # Column, TableNodeData, TableNode, ERDEdge
        ├── auth.ts                  # AuthResponse
        ├── team.ts                  # Team, TeamMember, TeamMemberRole
        ├── project.ts              # Project
        └── diagram.ts              # DiagramSummary, DiagramDetail
```

## 코드 표준

### Java 코딩 스타일

#### 모던 Java 관용구

프로젝트 전반에서 모던 Java 기능을 적극 활용한다.

| 기능                          | 적용 범위                       | 예시                                                                          |
| ----------------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `var` / `final var` (지역 변수 타입 추론) | 서비스, 설정 클래스의 지역 변수. 재할당 없으면 `final var`, 재할당하면 `var` | `final var user = findUserByLoginId(loginId);`                                |
| `record` (불변 데이터 클래스) | DTO, 복합키 클래스              | `public record TeamMemberId(Long team, Long user) implements Serializable {}` |
| `List.of()`                   | 불변 빈 컬렉션                  | `List.of()` (~~`Collections.emptyList()`~~ 사용 금지)                         |
| Stream API                    | 컬렉션 변환, 필터링             | `.stream().map(ProjectResponse::from).toList()`                               |
| Optional                      | JPA 단건 조회 결과 처리         | `.findByLoginId(id).orElseThrow(() -> ...)`                                   |

#### Import 규칙

- **와일드카드 import (`.*`) 사용 금지** — 모든 import는 명시적으로 선언한다
- Prettier가 저장 시 자동 포맷, VS Code `organizeImports`가 import 정리를 수행한다

```java
// Good
// Bad
import jakarta.persistence.*;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
```

#### 예외 처리 체계

`IllegalArgumentException` 등 범용 예외 대신 도메인별 커스텀 예외를 사용한다.

| 예외 클래스               | HTTP 상태       | 용도                                       |
| ------------------------- | --------------- | ------------------------------------------ |
| `EntityNotFoundException` | 404 Not Found   | 엔티티 조회 실패                           |
| `AccessDeniedException`   | 403 Forbidden   | 권한 부족 (팀 미소속, ADMIN 아님)          |
| `DuplicateException`      | 409 Conflict    | 중복 리소스 (팀 멤버 중복, 로그인 ID 중복) |
| `BusinessException`       | 400 Bad Request | 비즈니스 규칙 위반 (소유자 제거 시도 등)   |

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

#### QueryDSL Custom Repository 패턴

`@Query` JPQL 대신 QueryDSL `JPAQueryFactory`로 타입 안전한 쿼리를 작성한다. Spring Data의 Custom Repository 컨벤션을 따른다.

**구조:**

```text
XxxRepository (interface)
  extends JpaRepository<Xxx, Id>, XxxRepositoryCustom

XxxRepositoryCustom (interface)          — QueryDSL 메서드 시그니처
XxxRepositoryCustomImpl (class)          — QueryDSL 구현체 (JPAQueryFactory 주입)
```

**규칙:**

- Impl 클래스에 `@Repository`/`@Component` 붙이지 않음 (Spring Data가 `{Repository이름}Impl` 네이밍으로 자동 감지)
- `JPAQueryFactory`는 `@RequiredArgsConstructor`로 생성자 주입
- Q클래스는 static import: `import static com.smarterd.domain.xxx.entity.QXxx.xxx;`
- Spring Data 파생 쿼리 메서드(`findByUser`, `existsByTeamAndUser` 등)는 그대로 유지

```java
// Good — QueryDSL fetch join
@RequiredArgsConstructor
public class TeamRepositoryCustomImpl implements TeamRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public Optional<Team> findByIdWithOwner(Long id) {
        var result = queryFactory.selectFrom(team).join(team.owner).fetchJoin().where(team.id.eq(id)).fetchOne();
        return Optional.ofNullable(result);
    }
}

// Bad — @Query JPQL (타입 안전하지 않음, 리팩토링 시 깨짐)
@Query("SELECT t FROM Team t JOIN FETCH t.owner WHERE t.id = :id")
Optional<Team> findByIdWithOwner(@Param("id") Long id);
```

**Config 빈:**

| 클래스           | 빈                       | 역할                                              |
| ---------------- | ------------------------ | ------------------------------------------------- |
| `QuerydslConfig` | `JPAQueryFactory`        | QueryDSL 타입 안전 쿼리 빌더 (EntityManager 주입) |
| `BlazeConfig`    | `CriteriaBuilderFactory` | CTE, Keyset Pagination 등 고급 쿼리 인프라        |

### 포맷팅 — Prettier (Java + TypeScript 통합)

프로젝트 루트에 Prettier를 설치하여 Java와 TypeScript 코드를 통합 포맷팅한다.

#### 설정 파일

| 파일               | 위치          | 역할                                                        |
| ------------------ | ------------- | ----------------------------------------------------------- |
| `.prettierrc.json` | 프로젝트 루트 | 포맷 규칙 (Java/TS 오버라이드 포함)                         |
| `.prettierignore`  | 프로젝트 루트 | 빌드 산출물 제외                                            |
| `package.json`     | 프로젝트 루트 | `prettier` + `prettier-plugin-java` 의존성, format 스크립트 |

#### 언어별 포맷 규칙

| 설정            | Java     | TypeScript/TSX |
| --------------- | -------- | -------------- |
| `tabWidth`      | 4        | 2              |
| `printWidth`    | 120      | 100            |
| `singleQuote`   | —        | `true`         |
| `semi`          | `true`   | `true`         |
| `trailingComma` | `all`    | `all`          |
| `arrowParens`   | `always` | `always`       |

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

| 기능        | 설정                                        | 설명                                |
| ----------- | ------------------------------------------- | ----------------------------------- |
| 자동 포맷   | `editor.formatOnSave: true`                 | 저장 시 Prettier 자동 적용          |
| Import 정리 | `source.organizeImports: explicit`          | 저장 시 미사용 import 제거 및 정렬  |
| 자동 저장   | `files.autoSave: afterDelay` (1초)          | 1초 후 자동 저장                    |
| 자동 빌드   | `java.autobuild.enabled: true`              | Java 파일 변경 시 자동 빌드         |
| Null 분석   | `java.compile.nullAnalysis.mode: automatic` | `@NonNullApi` 기반 null 분석 활성화 |
| 후행 공백   | `files.trimTrailingWhitespace: true`        | 저장 시 후행 공백 제거              |
| 최종 개행   | `files.insertFinalNewline: true`            | 파일 끝 개행 자동 추가              |

**에디터 기본 포맷터:** Java, TypeScript 모두 `esbenp.prettier-vscode` (Prettier)

### TypeScript 코딩 스타일

#### 기본 규칙

- ESM 전용 (`"type": "module"`) — `require()` 사용 금지, ESM import만 사용
- `@/` alias로 import (`@/components/ui/button`, `@/lib/utils`)
- 상태 관리: 클라이언트 상태는 Zustand (`stores/`), 서버 상태는 React Query (`useQuery`/`useMutation`)
- shadcn/ui 컴포넌트 추가 시: `components/ui/`에 파일 생성, `cn()` 사용, `ref`는 일반 prop으로 전달 (`forwardRef` 사용 금지 — React 19)
- **하드코딩 색상 금지**: `bg-gray-*`, `text-blue-*`, `#hex` 등 Tailwind 기본 팔레트 직접 사용 금지. `index.css` CSS Variable → `tailwind.config.js` 시맨틱 매핑 → 컴포넌트에서 시맨틱 클래스 사용
- 아이콘 전용 버튼에 `aria-label` 필수, 로딩 상태는 `Spinner` 컴포넌트 사용

#### 페이지 컴포넌트 코드 정렬

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

같은 그룹 내에서는 선언 순서를 자유롭게 하되, **그룹 간 순서는 반드시 준수**한다.

#### 데이터 페칭 — React Query

서버 상태는 반드시 React Query로 관리한다. 수동 `useEffect` + `useState(loading)` 패턴 사용 금지.

- 조회: `useQuery` + `queryKeys.*` (URL 경로 계층 구조와 동일)
- 변경: `useMutation` + `onSuccess`에서 `invalidateQueries`로 캐시 무효화
- 에러: `onError`에서 `getErrorMessage(err, fallback)` + `toast.error()`

#### API 레이어

- 페이지에서 `axiosInstance`를 직접 호출하지 않는다. 항상 `api/` 모듈 함수를 통해 호출.
- 각 API 함수는 명시적 반환 타입과 JSDoc `@param`을 포함한다.

#### 상수 관리 — 매직 스트링 금지

- localStorage 키 → `STORAGE_KEYS.*` (`constants/storage.ts`)
- 라우트 경로 → `ROUTES.*` (`constants/routes.ts`)
- React Query 캐시 키 → `queryKeys.*` (`constants/query-keys.ts`)

#### 타입 공유

- 서버 응답 타입은 `types/` 디렉토리에 도메인별 1파일로 정의.
- 페이지 파일 내 인라인 타입 정의 금지. 항상 `@/types/*`에서 import.

#### 공유 컴포넌트 — 중복 금지

- 2회 이상 반복되는 UI 패턴은 공유 컴포넌트로 추출한다.
- `CreateResourceDialog` — 범용 생성 다이얼로그 (Team/Project/Diagram)
- `ConfirmDialog` — `window.confirm()` 대체 (비동기 지원)
- `MembersDialog` — 팀 멤버 관리 (React Query 자체 사용)
- `Spinner` — 로딩 스피너 (Loader2 animate-spin + 선택적 텍스트)
- `useInlineEdit` 훅 — 인라인 텍스트 편집 (SidebarTableItem, TableNode)

#### JSDoc 규칙

모든 함수, 컴포넌트, 인터페이스, 주요 변수에 JSDoc을 작성한다.

- **함수**: 멀티라인 JSDoc + 각 파라미터에 `@param` + `@returns`
- **인터페이스 필드**: 한 줄 `/** 설명 */`
- **상태 변수 (`useState`)**: 선언 위에 한 줄 `/** 설명 */`
- **상수 객체**: 객체 상단 `/** 설명 */` + 각 필드에 한 줄 주석
- **shadcn/ui 컴포넌트**: 자동 생성 코드이므로 JSDoc 불필요

### 패키지 규칙

**백엔드:**

| 패키지           | 역할                 | 포함 요소                                     |
| ---------------- | -------------------- | --------------------------------------------- |
| `api/`           | HTTP 인터페이스 계층 | Controller, DTO (record)                      |
| `domain/`        | 비즈니스 도메인 계층 | Entity, Repository, Service                   |
| `domain/common/` | 공통 코드            | BaseTimeEntity, 커스텀 예외                   |
| `config/`        | 설정                 | Security, JWT, CORS, OpenAPI, QueryDSL, Blaze |

- DTO는 Java `record`로 작성, `@Valid` 검증 포함
- `api/` 계층에 비즈니스 로직 금지
- Service는 해당 도메인 패키지(`domain/xxx/service/`) 아래에 위치

**프론트엔드:**

| 디렉토리             | 역할                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `api/`               | 도메인별 API 모듈. 페이지에서 axiosInstance 직접 호출 금지           |
| `constants/`         | 상수 정의 (localStorage 키, 라우트 경로, 쿼리 키)                    |
| `hooks/`             | 재사용 커스텀 훅 (2+ 컴포넌트에서 반복 시 추출)                      |
| `lib/`               | 순수 유틸리티 함수 및 설정 (api-error, query-client, utils)          |
| `types/`             | 도메인별 공유 TypeScript 타입 정의                                   |
| `components/ui/`     | 범용 재사용 컴포넌트 (shadcn/ui + 공유 다이얼로그). 도메인 로직 금지 |
| `components/team/`   | 팀 도메인 전용 컴포넌트 (MembersDialog)                              |
| `components/auth/`   | 인증 관련 컴포넌트 (ProtectedRoute)                                  |
| `components/erd/`    | ERD 도메인 전용 컴포넌트                                             |
| `components/layout/` | 페이지 구조 컴포넌트 (Header, Sidebar)                               |
| `pages/`             | 도메인별 서브디렉토리(`auth/`, `team/`, `project/`, `diagram/`)로 페이지 관리 |
| `stores/`            | Zustand 클라이언트 상태 관리 (`use` prefix)                          |

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
- **Diagram** : React Flow JSON을 TEXT로 저장하는 ERD 다이어그램 (Project 소속)
- **Domain** : 논리명→물리 데이터타입 매핑 사전 (예: "금액" → `DECIMAL(15,2)`)
- **Term** : 논리명→물리명 매핑 사전 (예: "사용자명" → `user_name`), Domain 참조 가능

모든 엔티티는 `BaseTimeEntity`를 상속하여 `createdAt`, `updatedAt`을 자동 기록한다.

## API 엔드포인트

### 인증 (`/api/auth/**` — 공개)

| Method | Path                | 설명      | Request Body                       | Response                                       |
| ------ | ------------------- | --------- | ---------------------------------- | ---------------------------------------------- |
| POST   | `/api/auth/signup`  | 회원가입  | `{ loginId, password (8+), name }` | `{ accessToken, refreshToken, loginId, name }` |
| POST   | `/api/auth/login`   | 로그인    | `{ loginId, password }`            | `{ accessToken, refreshToken, loginId, name }` |
| POST   | `/api/auth/refresh` | 토큰 갱신 | `{ refreshToken }`                 | `{ accessToken, refreshToken }`                |
| POST   | `/api/auth/logout`  | 로그아웃  | `{ refreshToken }`                 | —                                              |

### 팀 (`/api/teams/**` — 인증 필요)

| Method | Path                               | 설명       | Request Body        |
| ------ | ---------------------------------- | ---------- | ------------------- |
| POST   | `/api/teams`                       | 팀 생성    | `{ name }`          |
| GET    | `/api/teams`                       | 내 팀 목록 | —                   |
| GET    | `/api/teams/{id}`                  | 팀 상세    | —                   |
| GET    | `/api/teams/{id}/members`          | 멤버 목록  | —                   |
| POST   | `/api/teams/{id}/members`          | 멤버 초대  | `{ loginId, role }` |
| DELETE | `/api/teams/{id}/members/{userId}` | 멤버 제거  | —                   |
| PATCH  | `/api/teams/{id}/members/{userId}` | 역할 변경  | `{ role }`          |

### 프로젝트 (`/api/teams/{teamId}/projects/**` — 인증 필요)

| Method | Path                                | 설명          | Request Body |
| ------ | ----------------------------------- | ------------- | ------------ |
| POST   | `/api/teams/{teamId}/projects`      | 프로젝트 생성 | `{ name }`   |
| GET    | `/api/teams/{teamId}/projects`      | 프로젝트 목록 | —            |
| GET    | `/api/teams/{teamId}/projects/{id}` | 프로젝트 상세 | —            |
| DELETE | `/api/teams/{teamId}/projects/{id}` | 프로젝트 삭제 | —            |

### Swagger UI

`http://localhost:8080/swagger-ui/index.html`

모든 컨트롤러에 `@Operation`, `@ApiResponse`, `@Parameter`, `@Schema` 어노테이션 적용됨. JWT Bearer 인증이 필요한 엔드포인트는 Swagger UI에서 Authorize 버튼으로 토큰 설정 후 테스트 가능.

### 인증 흐름

```text
Client                                        Server
  │  POST /api/auth/login                      │
  │  { loginId, password }              ────►  │ AuthenticationManager 검증
  │                                            │ Access Token (30분) + Refresh Token (24시간) 발급
  │  ◄────  { accessToken, refreshToken,       │
  │           loginId, name }                  │
  │                                            │
  │  GET /api/...                              │
  │  Authorization: Bearer <accessToken>       │ BearerTokenAuthenticationFilter
  │                                     ────►  │ JwtDecoder (NimbusJwtDecoder, HS256)
  │  ◄────  200 OK / 401                      │
  │                                            │
  │  (401 발생 시 — Access Token 만료)          │
  │  POST /api/auth/refresh                    │
  │  { refreshToken }                   ────►  │ Refresh Token 검증 + 로테이션
  │  ◄────  { accessToken, refreshToken }      │ 새 Access + 새 Refresh 발급, 기존 Refresh 폐기
  │  (원래 요청 재시도)                         │
```

- **Access Token**: HMAC-SHA256 JWT, 만료 30분
- **Refresh Token**: UUID, 만료 24시간, 로테이션 전략 (사용 시 새 토큰 발급 + 기존 폐기)
- 프론트엔드는 `localStorage`에 두 토큰 저장, Axios 인터셉터로 자동 첨부
- 401 발생 시 큐 패턴으로 동시 요청 관리: 갱신 중 다른 401 요청은 큐에 대기 → 갱신 완료 후 일괄 재시도

### 에러 응답 형식

모든 에러는 통일된 JSON 형식으로 반환된다.

```json
{ "error": "User not found: testuser" }
```

| HTTP 상태 | 발생 조건                            |
| --------- | ------------------------------------ |
| 400       | 유효성 검증 실패, 비즈니스 규칙 위반 |
| 401       | JWT 토큰 없음 또는 만료              |
| 403       | 팀 미소속, ADMIN 권한 필요           |
| 404       | 엔티티 미존재                        |
| 409       | 중복 리소스 (멤버, 로그인 ID)        |

## 프론트엔드 상세

### 디자인 토큰 시스템

CSS Variable 기반 디자인 토큰 체계를 사용한다. **하드코딩 색상(`bg-gray-*`, `text-blue-*`, `#hex` 등) 사용을 금지**하고, 시맨틱 토큰을 통해 일관된 UI와 다크 모드 호환성을 보장한다.

```text
index.css (:root / .dark)  →  CSS Variable 정의 (HSL 값)
tailwind.config.js         →  Tailwind 시맨틱 색상 매핑 (hsl(var(--token)))
컴포넌트                    →  시맨틱 클래스 사용 (bg-card, text-muted-foreground 등)
```

#### shadcn/ui 기본 토큰

리스트 페이지, 폼, 다이얼로그 등 범용 UI에서 사용하는 표준 토큰:

| 용도 | 토큰 예시 |
|------|-----------|
| 배경 | `bg-background`, `bg-card`, `bg-muted`, `bg-accent`, `bg-popover` |
| 텍스트 | `text-foreground`, `text-muted-foreground`, `text-card-foreground` |
| 강조/상태 | `bg-primary`, `bg-secondary`, `bg-destructive` |
| 테두리 | `border-border`, `border-input` |
| 인터랙션 | `hover:bg-accent`, `focus:bg-accent` |

#### ERD 전용 토큰

ERD 편집기 영역(Header, Sidebar, TableNode, ERDCanvas)에서 사용하는 도메인 토큰:

| 토큰 | 용도 |
|------|------|
| `bg-header`, `text-header-foreground`, `text-header-muted` | 상단 헤더 바 |
| `bg-erd-table-header`, `text-erd-table-header-foreground` | 테이블 노드 헤더 |
| `text-erd-pk`, `text-erd-fk`, `text-erd-nullable` | PK/FK/nullable 뱃지 |
| `bg-erd-handle`, `border-erd-handle-border` | Handle (연결점) |
| `text-erd-warning` | unsaved 경고 표시 |

모든 토큰은 `index.css`에 `:root` (라이트)와 `.dark` (다크) 양쪽에 정의되어 있다.

#### 새 색상 추가 절차

1. `index.css`의 `:root`와 `.dark` 모두에 CSS Variable 추가
2. `tailwind.config.js`의 `colors`에 `hsl(var(--token-name))` 매핑
3. 컴포넌트에서 시맨틱 클래스 사용 (예: `bg-erd-table-header`)

새 shadcn/ui 컴포넌트 추가 시: `components/ui/`에 파일 생성, `cn()` 사용, `ref`는 일반 prop으로 전달 (`forwardRef` 사용 금지 — React 19).

### 접근성 (a11y)

- **아이콘 전용 버튼**: 반드시 `aria-label` 속성을 포함한다
- **토글 버튼**: `aria-label`에 대상 컨텍스트를 포함한다 (예: `` aria-label={`Toggle PK for ${col.name}`} ``)
- **form 요소**: `<label>` 연결이 불가능한 경우 `aria-label`을 추가한다
- **로딩 상태**: `Spinner` 컴포넌트 (`components/ui/spinner.tsx`)를 사용한다 — 단순 텍스트 표시 금지

### ERD 캔버스

- **@xyflow/react** 기반, 16x16 그리드 스냅
- 커스텀 `TableNode`: 테이블 헤더 + 컬럼 행, 각 컬럼에 좌(target)/우(source) Handle
- Handle ID: `{nodeId}-{colId}-source` / `{nodeId}-{colId}-target`
- Edge ID: `e-{sourceHandle}-{targetHandle}`
- Edge 타입: `step` (직각 연결), `MarkerType.ArrowClosed`
- 상태: Zustand `useCanvasStore` — `serialize()` → JSON 문자열 → `Diagram.content` (TEXT)

### 라우팅

```text
/login                                                    — 로그인 (공개)
/signup                                                   — 회원가입 (공개)
/teams                                                    — 팀 목록 (인증 필요)
/teams/:teamId/projects                                   — 프로젝트 목록 (인증 필요)
/teams/:teamId/projects/:projectId/diagrams               — 다이어그램 목록 (인증 필요)
/teams/:teamId/projects/:projectId/diagrams/:diagramId    — ERD 편집기 (인증 필요)
```

인증되지 않은 사용자는 `ProtectedRoute`에 의해 `/login`으로 리다이렉트된다.
라우트 경로는 `ROUTES` 상수 (`constants/routes.ts`)로 관리한다.

### Axios 인스턴스

```text
baseURL: /api  →  Vite 프록시  →  localhost:8080
요청 인터셉터: localStorage Access Token → Authorization: Bearer <token>
응답 인터셉터: 401 → Refresh Token으로 갱신 시도 (큐 패턴) → 실패 시 로그인 리다이렉트
```

- 페이지에서 `axiosInstance`를 직접 호출하지 않는다. `api/` 모듈 함수를 통해서만 호출.
- 서버 에러 메시지 추출: `getErrorMessage(err, fallback)` (`lib/api-error.ts`)

## 설정 상세

### `application.yml`

```yaml
spring:
    docker:
        compose:
            lifecycle-management: start-only # 앱 종료 시 컨테이너 유지
    jpa:
        hibernate.ddl-auto: update # 엔티티 변경 시 스키마 자동 업데이트
        show-sql: true

smart-erd:
    cors:
        allowed-origins: http://localhost:3000
    jwt:
        secret: ${SMART_ERD_JWT_SECRET:기본값}
        expiration: 86400000 # 24시간 (ms)
```

> `spring-boot-docker-compose`가 `compose.yaml`을 자동 감지하여 PostgreSQL 컨테이너를 시작하고, datasource를 자동 주입한다.

### Spring Security 접근 제어

| 경로              | 접근 권한 |
| ----------------- | --------- |
| `/api/auth/**`    | 공개      |
| `/swagger-ui/**`  | 공개      |
| `/v3/api-docs/**` | 공개      |
| 그 외 모든 경로   | 인증 필요 |

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
./gradlew bootRun            # 개발 서버 기동 (:8080, Docker PostgreSQL 자동 시작)
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

PostgreSQL 17을 Docker 컨테이너로 사용한다. `spring-boot-docker-compose`가 프로젝트 루트의 `compose.yaml`을 자동 감지하여 컨테이너 시작 및 datasource 주입을 처리한다.

- **개발 환경:** `./gradlew bootRun` 시 Docker 컨테이너 자동 시작 (`lifecycle-management: start-only` — 앱 종료 시 컨테이너 유지)
- **테스트 환경:** Testcontainers가 임시 PostgreSQL 컨테이너를 자동 생성/폐기
- **스키마:** `ddl-auto: update` — 엔티티 변경 시 자동 업데이트
- **전제 조건:** Docker Desktop 실행 중, 포트 5432 사용 가능, 최초 실행 시 `postgres:17` 이미지 다운로드 (~400MB)
