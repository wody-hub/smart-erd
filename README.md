# Smart ERD

> **Claude Code 응답 언어: 한글**

ERwin과 같은 ERD 설계 도구를 웹 기반으로 구현한 간이 솔루션.

테이블 노드를 시각적으로 배치하고, 컬럼 레벨의 관계(FK)를 드래그로 연결하며, 데이터 사전(도메인/용어)을 통해 컬럼 타입과 이름을 표준화할 수 있다.

## 기술 스택

| 계층        | 기술                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------- |
| Backend     | Spring Boot 3.5.11, Java 25, Gradle 9.4.0, Spring Security 6.x, Spring Data JPA           |
| 인증        | Spring OAuth2 Resource Server (HMAC-SHA256 JWT), BCrypt                                   |
| 쿼리        | QueryDSL 5.1.0:jakarta, Blaze-Persistence 1.6.17                                          |
| DB          | PostgreSQL 17 (Docker), Testcontainers (test), `ddl-auto: update`                         |
| Frontend    | React 19, TypeScript 5.6, Vite 6, Tailwind CSS 3.4, shadcn/ui                             |
| 데이터 페칭 | @tanstack/react-query 5 (useQuery, useMutation, 캐시 무효화)                              |
| API 문서    | springdoc-openapi (Swagger UI)                                                            |
| ERD 캔버스  | @xyflow/react 12, Zustand 5                                                               |
| 자동 배치   | dagre 0.8                                                                                 |
| 에디터      | @monaco-editor/react 4.6                                                                  |
| 단축키      | react-hotkeys-hook 5                                                                      |
| 다국어      | i18next, react-i18next, i18next-browser-languagedetector (FE) + Spring MessageSource (BE) |
| SQL 로깅    | p6spy-spring-boot-starter 1.12.1 (바인딩 파라미터 포함 SQL 로깅)                          |
| 토스트      | Sonner                                                                                    |
| 포맷팅      | Prettier (Java + TypeScript 통합), prettier-plugin-java                                   |
| 코드 품질   | ESLint, SonarQube / SonarLint                                                             |

## 시작하기

### 사전 요구사항

- Java 25+
- Node.js 20+
- Docker Desktop (PostgreSQL 컨테이너 자동 기동)

### 백엔드

```bash
./gradlew bootRun          # http://localhost:8190 (Docker PostgreSQL 자동 시작)
```

### 프론트엔드

```bash
cd client
npm install
npm run dev                # http://localhost:3000 (프록시 /api → :8190)
npm run perf:erd:apply     # S50/S200/S500 parse/apply/layout/total p50/p95 리포트 생성 (/tmp/smart-erd/perf)
npm run perf:erd:apply:sample  # 저장소 샘플 리포트 갱신 (client/perf-reports/erd-apply-report.json)
npm run test:e2e:smoke:collaboration  # 협업 생성/undo 전파 스모크
```

### 환경변수

| 변수                                                | 설명                                                  | 기본값                                    |
| --------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| `SMART_ERD_JWT_SECRET`                              | JWT 서명 키 (Base64)                                  | 개발용 기본값 내장 (`application.yml`)    |
| `SMART_ERD_WEBSOCKET_SNAPSHOT_FLUSH_INTERVAL`       | Y.Doc 스냅샷 DB flush 주기(ms)                        | `5000`                                    |
| `SMART_ERD_WEBSOCKET_SHUTDOWN_FLUSH_TIMEOUT_MILLIS` | 서버 종료 시 Y.Doc flush 최대 대기(ms)                | `15000`                                   |
| `SMART_ERD_SHUTDOWN_PHASE_TIMEOUT`                  | Spring graceful shutdown phase timeout                | `20s`                                     |
| `VITE_ENABLE_DIAGRAM_API_PREVIEW`                   | 다이어그램 API preview 활성화 여부 (`false`면 비활성) | `true`                                    |
| `VITE_ERD_AUTOSAVE_INTERVAL_MS`                     | 주기 autosave 간격(ms)                                | `30000`                                   |
| `VITE_ERD_AUTOSAVE_IDLE_MS`                         | 변경 후 idle autosave 대기(ms)                        | `5000`                                    |
| `VITE_ERD_DIFF_APPLY_MODE`                          | Diff Apply rollout 모드 (`off/internal/beta/all`)     | `off`                                     |
| `VITE_ERD_DIFF_APPLY_BETA_PERCENT`                  | beta 모드 대상 비율(0~100)                            | `10`                                      |
| `VITE_ERD_DIFF_APPLY_INTERNAL_IDS`                  | internal 모드 허용 loginId 목록(csv)                  | 빈 값                                     |
| `SMART_ERD_E2E_LOGIN`                               | Playwright E2E 로그인 ID                              | 없음                                      |
| `SMART_ERD_E2E_PASSWORD`                            | Playwright E2E 비밀번호                               | 없음                                      |
| `SMART_ERD_E2E_BASE_URL`                            | Playwright 대상 프런트 주소                           | `http://localhost:3000`                   |
| `SMART_ERD_E2E_API_URL`                             | Playwright 대상 API 주소                              | `http://localhost:8190/api`               |
| `SMART_ERD_E2E_TEAM_ID`                             | 고정 smoke/recovery 대상 팀 ID                        | 자동 탐색                                 |
| `SMART_ERD_E2E_PROJECT_ID`                          | 고정 smoke/recovery 대상 프로젝트 ID                  | 자동 탐색                                 |
| `SMART_ERD_E2E_DIAGRAM_ID`                          | 고정 smoke/recovery 대상 다이어그램 ID                | 자동 탐색                                 |
| `SMART_ERD_E2E_BACKEND_PORT`                        | recovery 테스트가 재기동할 백엔드 포트                | `8190`                                    |
| `SMART_ERD_E2E_BACKEND_RESTART_CMD`                 | recovery 테스트 백엔드 재기동 명령                    | `./gradlew bootRun`                       |
| `SMART_ERD_E2E_BOOT_LOG_PATH`                       | recovery 재기동 로그 파일 경로                        | `/tmp/smart-erd-e2e-recovery-backend.log` |
| `SMART_ERD_E2E_BROWSER_CHANNEL`                     | Playwright 브라우저 채널 강제값 (`chrome` 등)         | Playwright 기본 Chromium                  |

## Playwright E2E 운영

무거운 회귀와 가벼운 회귀를 분리해서 관리한다.

### 가벼운 smoke

- 목적: 로그인 후 실제 다이어그램 첫 진입이 가능한지 빠르게 확인
- 범위: 로그인, 다이어그램 진입, 첫 노드 렌더 확인
- 권장 시점: 프런트 UI/라우팅/로딩 UX 수정 후, PR 전 기본 확인

```bash
cd client
SMART_ERD_E2E_LOGIN='your-login-id' \
SMART_ERD_E2E_PASSWORD='your-password' \
npm run test:e2e:smoke
```

### 협업 smoke

- 목적: 서로 다른 브라우저 컨텍스트 간 생성/undo 전파가 유지되는지 확인
- 범위: 로그인, 동일 다이어그램 동시 접속, 테이블 생성 전파, undo 전파
- 권장 시점: Yjs, websocket, history/undo, collaboration 관련 수정 후
- 주의: `test` 프로파일에서 로그인 비밀번호 검증을 우회하려면 백엔드를 `SPRING_PROFILES_ACTIVE=test`로 띄운다.

```bash
SPRING_PROFILES_ACTIVE=test ./gradlew bootRun

cd client
SMART_ERD_E2E_LOGIN='your-login-id' \
SMART_ERD_E2E_PASSWORD='any-value-in-test-profile' \
SMART_ERD_E2E_BROWSER_CHANNEL='chrome' \
npm run test:e2e:smoke:collaboration -- --headed
```

### 무거운 recovery

- 목적: 편집 내용이 백업되고 백엔드 graceful restart 이후에도 유지되는지 확인
- 범위: 로그인, 노드 이동, 백업, 서버 재기동, 복구 확인, 원복
- 권장 시점: Yjs, snapshot, autosave, websocket, shutdown 관련 수정 후
- 주의: 실제 백엔드 프로세스를 재기동하므로 단독 실행을 권장

```bash
cd client
SMART_ERD_E2E_LOGIN='your-login-id' \
SMART_ERD_E2E_PASSWORD='your-password' \
npm run test:e2e:recovery
```

### 대상 다이어그램 고정 권장

자동 탐색도 가능하지만, 정식 운영 시에는 전용 팀/프로젝트/다이어그램을 고정하는 편이 안정적이다.

```bash
cd client
SMART_ERD_E2E_LOGIN='your-login-id' \
SMART_ERD_E2E_PASSWORD='your-password' \
SMART_ERD_E2E_TEAM_ID='team-id' \
SMART_ERD_E2E_PROJECT_ID='project-id' \
SMART_ERD_E2E_DIAGRAM_ID='diagram-id' \
npm run test:e2e:smoke
```

### 운영 규칙

- `smoke`는 자주 돌리고, `recovery`는 저장/재기동 관련 변경 때만 돌린다.
- 협업 smoke는 Yjs/undo 변경마다 우선적으로 돌린다.
- `recovery`는 공용 데이터 충돌을 막기 위해 전용 다이어그램을 두는 편이 낫다.
- 브라우저 채널을 강제하지 않으면 Playwright 기본 Chromium을 사용한다.
- 실패 산출물은 `client/playwright-report/`, `client/test-results/`에 남는다.

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
│   ├── dictionary/
│   │   ├── DomainController.java    #   도메인 사전 CRUD (5 엔드포인트)
│   │   ├── TermController.java      #   용어 사전 CRUD (5 엔드포인트)
│   │   └── dto/                     #   Create/Update/Response record (Domain, Term)
│   └── common/
│       └── GlobalExceptionHandler.java  # 전역 예외 처리 (404/403/409/400 매핑)
├── config/                          # 설정
│   ├── SecurityConfig.java          #   Spring Security (OAuth2 Resource Server JWT, CSRF 비활성)
│   ├── JwtConfig.java               #   JwtEncoder / JwtDecoder 빈 (NimbusJwtDecoder, HS256)
│   ├── JwtProperties.java           #   @ConfigurationProperties("smart-erd.jwt") — secret, access-expiration, refresh-expiration
│   ├── CorsConfig.java              #   @ConfigurationProperties("smart-erd.cors") + CorsProperties 내부 클래스
│   ├── LocaleConfig.java            #   AcceptHeaderLocaleResolver (ko/en, 기본: en)
│   ├── ValidationConfig.java        #   LocalValidatorFactoryBean + MessageSource 연결
│   ├── QuerydslConfig.java          #   JPAQueryFactory 빈 (QueryDSL 타입 안전 쿼리 빌더)
│   ├── BlazeConfig.java             #   CriteriaBuilderFactory 빈 (Blaze-Persistence 고급 쿼리)
│   ├── OpenApiConfig.java           #   Swagger/OpenAPI 설정 (JWT Bearer 인증 스킴)
│   └── PrettySqlFormat.java         #   p6spy SQL 포맷터 (Hibernate FormatStyle.BASIC 기반 들여쓰기)
└── domain/                          # 도메인 계층 (Service도 여기에 위치)
    ├── common/
    │   ├── entity/                   #   BaseTimeEntity (createdAt, updatedAt UTC Instant 자동 감사)
    │   └── exception/               #   커스텀 예외 계층 (5종, 모두 LocalizedException 상속)
    │       ├── LocalizedException.java          # 추상 베이스 — messageCode + messageArgs
    │       ├── EntityNotFoundException.java     # → 404
    │       ├── DomainAccessDeniedException.java # → 403
    │       ├── DuplicateException.java          # → 409
    │       └── BusinessException.java           # → 400
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
        ├── repository/             #   DomainRepository, TermRepository (+Custom — QueryDSL fetch join)
        └── service/                #   DomainService, TermService (CRUD + 팀 소속/중복 검증)
```

### 프론트엔드

```text
client/
├── index.html                       # SPA 진입점
├── package.json                     # "type": "module" (ESM)
├── tailwind.config.js               # CSS 변수 기반 색상, darkMode: ["class"], tailwindcss-animate
├── postcss.config.js                # tailwindcss + autoprefixer
├── vite.config.ts                   # @/ alias → ./src, 프록시 /api → :8190
├── tsconfig.app.json                # paths: { "@/*": ["./src/*"] }
├── .prettierrc.json                 # Prettier 설정
├── .prettierignore                  # Prettier 무시 파일
├── eslint.config.js                 # ESLint flat config (TypeScript + Prettier)
└── src/
    ├── main.tsx                     # createRoot + StrictMode
    ├── App.tsx                      # QueryClientProvider + BrowserRouter + Routes (인증 가드 포함)
    ├── index.css                    # Tailwind directives + CSS 변수 (light/dark)
    ├── vite-env.d.ts                # Vite 타입 참조
    ├── i18n/
    │   ├── index.ts                 # i18next 초기화 (LanguageDetector + initReactI18next)
    │   ├── i18next.d.ts             # 타입 확장 (번역 키 자동완성)
    │   └── locales/
    │       ├── en/translation.json  # 영어 번역 (~200 키)
    │       └── ko/translation.json  # 한국어 번역 (~200 키)
    ├── api/
    │   ├── axiosInstance.ts         # baseURL: /api, JWT 자동 첨부 + 401 Refresh Token 갱신 (큐 패턴)
    │   ├── authApi.ts               # login(), signup()
    │   ├── teamApi.ts               # fetchTeams(), fetchTeam(), createTeam(), fetchMembers(), inviteMember(), removeMember()
    │   ├── projectApi.ts            # fetchProjects(), createProject(), deleteProject()
    │   ├── diagramApi.ts            # fetchDiagrams(), fetchDiagram(), createDiagram(), saveDiagram(), renameDiagram(), deleteDiagram()
    │   ├── domainApi.ts             # fetchDomains(), createDomain(), updateDomain(), deleteDomain()
    │   └── termApi.ts               # fetchTerms(), createTerm(), updateTerm(), deleteTerm()
    ├── constants/
    │   ├── keybindings.ts           # KEYBINDINGS — 키보드 단축키 레지스트리
    │   ├── storage.ts               # STORAGE_KEYS — localStorage 키 상수
    │   ├── routes.ts                # ROUTES — 라우트 경로 상수 (정적 + 파라미터)
    │   └── query-keys.ts            # queryKeys — React Query 캐시 키 계층 구조
    ├── hooks/
    │   ├── useInlineEdit.ts         # 인라인 텍스트 편집 공통 훅
    │   └── useFkConnectMode.ts      # FK 연결 모드 상태/로직 캡슐화 훅
    ├── components/
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx   # 인증 가드 (미인증 시 /login 리다이렉트)
    │   ├── erd/
    │   │   ├── ERDCanvas.tsx        # @xyflow/react 캔버스 (FK 연결, 엣지 삭제, 자동 배치, 하이라이트)
    │   │   ├── TableNode.tsx        # 커스텀 노드: 테이블 헤더 + 컬럼 행 (PK/FK 뱃지, 좌우 Handle)
    │   │   ├── CanvasToolbar.tsx    # 플로팅 툴바 (FK Connect + Auto Layout 버튼)
    │   │   ├── EdgeContextMenu.tsx  # 엣지 우클릭 컨텍스트 메뉴 (삭제)
    │   │   └── DeleteEdgeDialog.tsx # 엣지 삭제 다이얼로그 (FK 제거/유지/취소 3버튼)
    │   ├── layout/
    │   │   ├── Header.tsx           # 상단 고정 헤더 (bg-header, 사용자명, 로그아웃, 다이어그램 Save)
    │   │   ├── LanguageSwitcher.tsx  # 언어 전환 드롭다운 (ko/en)
    │   │   ├── Sidebar.tsx          # 좌측 사이드바 (w-56, 테이블 목록)
    │   │   └── SidebarTableItem.tsx # 사이드바 개별 테이블 항목 (인라인 이름 변경)
    │   ├── dictionary/
    │   │   ├── DomainTab.tsx        # 도메인 목록 테이블 + CRUD (useQuery + useMutation)
    │   │   ├── TermTab.tsx          # 용어 목록 테이블 + CRUD (useQuery + useMutation)
    │   │   ├── DomainFormDialog.tsx  # 도메인 생성/수정 폼 다이얼로그
    │   │   └── TermFormDialog.tsx    # 용어 생성/수정 폼 다이얼로그 (도메인 Select)
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
    │       ├── select.tsx           #   Select — @radix-ui/react-select
    │       ├── table.tsx            #   Table — 시맨틱 HTML 테이블 컴포넌트
    │       ├── tabs.tsx             #   Tabs — @radix-ui/react-tabs
    │       └── spinner.tsx          #   Spinner — Loader2 animate-spin + 선택적 텍스트
    ├── lib/
    │   ├── utils.ts                 # cn() = clsx + tailwind-merge
    │   ├── api-error.ts             # getErrorMessage() — 서버 에러 메시지 추출
    │   ├── query-client.ts          # QueryClient 설정 (staleTime: 30s, retry: 1)
    │   └── auto-layout.ts           # dagre 기반 자동 배치 순수 함수 (LR 방향)
    ├── pages/                       # 도메인별 페이지 디렉토리
    │   ├── auth/
    │   │   ├── LoginPage.tsx        # 로그인 폼 (useMutation + authApi, 성공 시 /teams 이동)
    │   │   └── SignupPage.tsx       # 회원가입 폼 (useMutation + authApi, 성공 시 자동 로그인)
    │   ├── team/
    │   │   └── TeamsPage.tsx        # 팀 목록 + 생성 (useQuery + useMutation + CreateResourceDialog)
    │   ├── project/
    │   │   └── ProjectsPage.tsx     # 프로젝트 목록 + CRUD + 멤버 관리 (useQuery + useMutation)
    │   ├── dictionary/
    │   │   └── DictionaryPage.tsx   # 데이터 사전: 도메인/용어 탭 (Tabs 컨테이너)
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
        ├── diagram.ts              # DiagramSummary, DiagramDetail
        └── dictionary.ts           # Domain, Term, DomainFormData, TermFormData
```

## 코드 표준

### 코드 품질 — SonarQube 준수

**SonarQube / SonarLint 규칙을 최대한 준수한다.** 코드 작성 시 SonarQube가 경고하는 코드 스멜, 버그, 취약점을 사전에 방지한다.

- null 반환 대신 빈 컬렉션/빈 배열 반환 (`Return an empty array instead of null`)
- 사용하지 않는 변수/import 제거
- 인라인 조건문 대신 명시적 블록 사용
- 예외를 무시하지 않고 적절히 처리 또는 로깅
- Prettier와 충돌하는 S1611(람다 괄호)은 Prettier 우선으로 억제 (하단 "Prettier와 SonarQube 충돌 해결" 참고)

### Java 코딩 스타일

#### 모던 Java 관용구

프로젝트 전반에서 모던 Java 기능을 적극 활용한다.

| 기능                                      | 적용 범위                                                                    | 예시                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `var` / `final var` (지역 변수 타입 추론) | 서비스, 설정 클래스의 지역 변수. 재할당 없으면 `final var`, 재할당하면 `var` | `final var user = findUserByLoginId(loginId);`                                |
| `record` (불변 데이터 클래스)             | DTO, 복합키 클래스                                                           | `public record TeamMemberId(Long team, Long user) implements Serializable {}` |
| `List.of()`                               | 불변 빈 컬렉션                                                               | `List.of()` (~~`Collections.emptyList()`~~ 사용 금지)                         |
| Stream API                                | 컬렉션 변환, 필터링                                                          | `.stream().map(ProjectResponse::from).toList()`                               |
| Optional                                  | JPA 단건 조회 결과 처리                                                      | `.findByLoginId(id).orElseThrow(() -> ...)`                                   |

#### Import 규칙

- **와일드카드 import (`.*`) 사용 금지** — 모든 import는 명시적으로 선언한다
- Prettier가 저장 시 자동 포맷, VS Code `organizeImports`가 import 정리를 수행한다

#### Null 처리 규칙 (필수)

- `@SuppressWarnings("null")` 사용 금지 (`src/main/**` 기준). 단, 테스트 코드(`src/test/**`)에서는 필요 시 사용 허용
- 메서드 파라미터에는 Spring의 `@NonNull` (`org.springframework.lang.NonNull`) 사용
- `@NonNull`이 있어도 SonarQube 경고가 발생하는 경우 `Objects.requireNonNull(...)`으로 명시 처리
- 신규 코드뿐 아니라 수정 touched 코드에도 동일 규칙 적용

```java
// Good
// Bad
import jakarta.persistence.*;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
```

#### 문자열 처리 규칙 (필수)

- `src/main/java`에서 문자열 검증/정규화는 `AppStringUtils`를 우선 사용한다
- Apache Commons `StringUtils`, `ArrayUtils`는 각각 `AppStringUtils`, `AppArrayUtils` 내부에서만 직접 사용한다
- `trim()`, `toLowerCase(Locale.ROOT)`, `x == null || x.isBlank()` 같은 직접 패턴은 지양하고 `AppStringUtils` 메서드로 통일한다
- 외부 입력(HTTP 파라미터, 헤더, 파일명, CSV/Excel 텍스트)의 검증은 `AppStringUtils.isBlank/trimToNull` 기준으로 처리한다

점검 명령:

```bash
./scripts/check-string-utils.sh
```

최근 반영 (2026-02-25):

- 공통 문자열 유틸 `AppStringUtils` 추가 및 확장: `trimToNull`, `trimToEmpty`, `isBlank`, `isNotBlank`, `defaultIfBlank`, `startsWith`, `equalsIgnoreCase`, `containsIgnoreCase`, `lowerTrimToNull`, `lowerTrimToEmpty`, `endsWithIgnoreCase`, `endsWithAnyIgnoreCase`, `firstCsvTokenToNull`
- 공통 배열 유틸 `AppArrayUtils` 추가: `isEmpty(Object[] values)`
- 주요 입력 검증/정규화 로직(`SecurityConfig`, `ClientIpUtils`, `EnvironmentProfile`, `LoginRateLimitService`, `DiagramService`, `WsTicketHandshakeInterceptor`, `Dictionary*BulkService`, `ExcelUtils`, `CsvParser`)을 `App*Utils` 기준으로 통일
- Apache Commons 직접 호출은 `AppStringUtils`/`AppArrayUtils` 내부로 제한
- 문자열 규칙 자동 점검 스크립트 추가: `scripts/check-string-utils.sh`

#### 예외 처리 체계

`IllegalArgumentException` 등 범용 예외 대신 도메인별 커스텀 예외를 사용한다.

| 예외 클래스                   | HTTP 상태       | 용도                                       |
| ----------------------------- | --------------- | ------------------------------------------ |
| `EntityNotFoundException`     | 404 Not Found   | 엔티티 조회 실패                           |
| `DomainAccessDeniedException` | 403 Forbidden   | 권한 부족 (팀 미소속, ADMIN 아님)          |
| `DuplicateException`          | 409 Conflict    | 중복 리소스 (팀 멤버 중복, 로그인 ID 중복) |
| `BusinessException`           | 400 Bad Request | 비즈니스 규칙 위반 (소유자 제거 시도 등)   |

모든 예외는 `LocalizedException(messageCode, messageArgs...)` 을 상속하며, `domain/common/exception/` 패키지에 위치한다. `GlobalExceptionHandler`가 `MessageSource`를 통해 요청 로케일에 맞는 다국어 메시지로 변환하여 HTTP 응답으로 반환한다.

```java
// Good — 메시지 코드 + 인자 (MessageSource가 로케일에 맞게 번역)
throw new EntityNotFoundException("error.not-found.user", loginId);
throw new DuplicateException("error.duplicate.login-id", request.loginId());

// Bad — 하드코딩 메시지
throw new EntityNotFoundException("User not found: " + loginId);

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
- `@SuppressWarnings("null")` 사용 금지 (`src/main/**` 기준). 단, 테스트 코드(`src/test/**`)에서는 필요 시 사용 허용
- 메서드 파라미터는 Spring `@NonNull` (`org.springframework.lang.NonNull`)을 기본으로 사용
- `@NonNull`이 있어도 SonarQube 경고가 남으면 메서드 시작부에서 `Objects.requireNonNull(...)`으로 명시 검증

```java
// Good — @NonNull + Objects.requireNonNull
public Team findById(@NonNull Long id) {
    final var nonNullId = Objects.requireNonNull(id, "id must not be null");
    return teamRepository
        .findByIdWithOwner(nonNullId)
        .orElseThrow(() -> new EntityNotFoundException("error.not-found.team", nonNullId));
}
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

| 순번 | 그룹          | 예시                             |
| ---- | ------------- | -------------------------------- |
| 1    | URL 파라미터  | `useParams`                      |
| 2    | 라우터 훅     | `useNavigate`                    |
| 3    | Query Client  | `useQueryClient`                 |
| 3.5  | 다국어        | `useTranslation`                 |
| 4    | 로컬 상태     | `useState`                       |
| 5    | 스토어 셀렉터 | `useCanvasStore`, `useAuthStore` |
| 6    | 파생값/상수   | computed values                  |
| 7    | 쿼리          | `useQuery`                       |
| 8    | 뮤테이션      | `useMutation`                    |
| 9    | 이벤트 핸들러 | `handleSave`, `handleSubmit` 등  |
| 10   | 사이드 이펙트 | `useEffect`                      |
| 11   | 조건부 리턴   | loading/error early return       |
| 12   | JSX           | `return (...)`                   |

같은 그룹 내에서는 선언 순서를 자유롭게 하되, **그룹 간 순서는 반드시 준수**한다.

#### 데이터 페칭 — React Query

서버 상태는 반드시 React Query로 관리한다. 수동 `useEffect` + `useState(loading)` 패턴 사용 금지. 인증 페이지(Login, Signup)를 포함한 **모든 페이지**에서 `useMutation`을 사용한다.

- 조회: `useQuery` + `queryKeys.*` (URL 경로 계층 구조와 동일)
- 변경: `useMutation` + `onSuccess`에서 `invalidateQueries`로 캐시 무효화
- 에러: `onError`에서 `toast.error(getErrorMessage(err, t('key')))` 패턴으로 통일 (인라인 에러 표시 금지)

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

| 패키지           | 역할                 | 포함 요소                                                         |
| ---------------- | -------------------- | ----------------------------------------------------------------- |
| `api/`           | HTTP 인터페이스 계층 | Controller, DTO (record)                                          |
| `domain/`        | 비즈니스 도메인 계층 | Entity, Repository, Service                                       |
| `domain/common/` | 공통 코드            | BaseTimeEntity, 커스텀 예외                                       |
| `config/`        | 설정                 | Security, JWT, CORS, Locale, Validation, OpenAPI, QueryDSL, Blaze |

- DTO는 Java `record`로 작성, `@Valid` 검증 포함
- `api/` 계층에 비즈니스 로직 금지
- Service는 해당 도메인 패키지(`domain/xxx/service/`) 아래에 위치

**프론트엔드:**

| 디렉토리                 | 역할                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `api/`                   | 도메인별 API 모듈. 페이지에서 axiosInstance 직접 호출 금지                                   |
| `constants/`             | 상수 정의 (localStorage 키, 라우트 경로, 쿼리 키)                                            |
| `hooks/`                 | 재사용 커스텀 훅 (2+ 컴포넌트에서 반복 시 추출)                                              |
| `lib/`                   | 순수 유틸리티 함수 및 설정 (api-error, query-client, utils)                                  |
| `types/`                 | 도메인별 공유 TypeScript 타입 정의                                                           |
| `components/ui/`         | 범용 재사용 컴포넌트 (shadcn/ui + 공유 다이얼로그). 도메인 로직 금지                         |
| `components/team/`       | 팀 도메인 전용 컴포넌트 (MembersDialog)                                                      |
| `components/dictionary/` | 사전 도메인 전용 컴포넌트 (DomainTab, TermTab, 폼 다이얼로그)                                |
| `components/auth/`       | 인증 관련 컴포넌트 (ProtectedRoute)                                                          |
| `components/erd/`        | ERD 도메인 전용 컴포넌트                                                                     |
| `components/layout/`     | 페이지 구조용 공통 컴포넌트. ERD 전용 상태/협업/UI 책임 금지                                 |
| `pages/`                 | 도메인별 서브디렉토리(`auth/`, `team/`, `project/`, `dictionary/`, `diagram/`)로 페이지 관리 |
| `stores/`                | Zustand 클라이언트 상태 관리 (`use` prefix)                                                  |
| `stores/erd/`            | ERD 전용 Zustand 진입 경로. ERD 화면/훅/컴포넌트는 이 경로를 우선 사용                       |

### 프런트엔드 경계 가드레일

- ERD는 사전 "관리 기능"이 아니라 사전 "조회 데이터 계약"만 소비한다.
- `components/layout/`는 공통 프레임 역할만 수행하고, `useCanvasStore`, `useCollaborationStore`, `react-flow`, Yjs에 직접 의존하지 않는다.
- ERD 전용 UI는 `components/erd/` 아래에 둔다. 협업 바, 다이어그램 사이드바, 캔버스 보조 UI도 여기에 포함한다.
- ERD 관련 페이지/훅/컴포넌트는 상태 접근 시 `stores/erd/*` 경로를 우선 사용한다.
- `components/dictionary/`와 `pages/dictionary/`의 사전 생성/수정/삭제 절차를 ERD 내부에 직접 import하지 않는다.
- 다이어그램이 사전 세트를 참조하더라도, ERD 내부 표현은 "사전 관리"가 아니라 "다이어그램 사전 컨텍스트"로 다룬다.

### 리뷰 체크리스트

- 공용 layout 수정이 ERD 캔버스/협업/사이드바 동작에 영향을 주지 않는가
- ERD가 dictionary UI/절차를 직접 import하지 않는가
- 새 ERD 기능이 `components/erd/` 또는 `stores/erd/` 경계 안에 배치되었는가
- 사전 기능 변경 시 다이어그램 목록, 다이어그램 편집, 용어/도메인 조회 경로를 함께 점검했는가

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

모든 엔티티는 `BaseTimeEntity`를 상속하여 `createdAt`, `updatedAt`을 UTC 기준 `Instant`로 자동 기록한다.

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

### 도메인 사전 (`/api/teams/{teamId}/domains/**` — 인증 필요)

| Method | Path                                     | 설명        | Request Body                                  |
| ------ | ---------------------------------------- | ----------- | --------------------------------------------- |
| POST   | `/api/teams/{teamId}/domains`            | 도메인 생성 | `{ logicalName, physicalType, description? }` |
| GET    | `/api/teams/{teamId}/domains`            | 도메인 목록 | —                                             |
| GET    | `/api/teams/{teamId}/domains/{domainId}` | 도메인 상세 | —                                             |
| PUT    | `/api/teams/{teamId}/domains/{domainId}` | 도메인 수정 | `{ logicalName, physicalType, description? }` |
| DELETE | `/api/teams/{teamId}/domains/{domainId}` | 도메인 삭제 | —                                             |

### 용어 사전 (`/api/teams/{teamId}/terms/**` — 인증 필요)

| Method | Path                                 | 설명      | Request Body                                             |
| ------ | ------------------------------------ | --------- | -------------------------------------------------------- |
| POST   | `/api/teams/{teamId}/terms`          | 용어 생성 | `{ logicalName, physicalName, domainId?, description? }` |
| GET    | `/api/teams/{teamId}/terms`          | 용어 목록 | —                                                        |
| GET    | `/api/teams/{teamId}/terms/{termId}` | 용어 상세 | —                                                        |
| PUT    | `/api/teams/{teamId}/terms/{termId}` | 용어 수정 | `{ logicalName, physicalName, domainId?, description? }` |
| DELETE | `/api/teams/{teamId}/terms/{termId}` | 용어 삭제 | —                                                        |

### Swagger UI

`http://localhost:8190/swagger-ui/index.html`

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

### 다국어 (i18n)

프론트엔드 UI 텍스트와 백엔드 에러 메시지 모두 다국어 처리된다. 지원 언어: **한국어(ko)**, **영어(en, 기본)**.

**프론트엔드:** `react-i18next`로 UI 텍스트 번역. 번역 파일: `client/src/i18n/locales/{en,ko}/translation.json`.

**백엔드:** Spring `MessageSource`로 에러 메시지(예외, 유효성 검증) 번역. 메시지 번들: `src/main/resources/i18n/messages.properties` (영어 fallback) + `messages_ko.properties` (한국어).

**동작 흐름:**

```text
프론트엔드                                    백엔드
  │  Accept-Language: ko                      │
  │  (axiosInstance가 i18n.language 전송)      │
  │                                    ────►  │ AcceptHeaderLocaleResolver → Locale.KOREAN
  │                                           │ MessageSource.getMessage("error.not-found.user", {loginId}, ko)
  │  ◄────  { "error": "사용자를 찾을 수       │
  │           없습니다: testuser" }            │
  │  toast.error(response.error)              │
```

**구성 요소:**

| 구성 요소                | 역할                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `LocaleConfig`           | `AcceptHeaderLocaleResolver` — `Accept-Language` 헤더에서 로케일 결정 (기본: en)    |
| `ValidationConfig`       | `LocalValidatorFactoryBean` — Bean Validation `{key}` 보간을 `MessageSource`에 연결 |
| `LocalizedException`     | 추상 베이스 예외 — `messageCode` + `messageArgs` 보유                               |
| `GlobalExceptionHandler` | `MessageSource`로 메시지 코드를 로케일에 맞게 번역하여 반환                         |
| `messages.properties`    | 영어 메시지 번들 (fallback)                                                         |
| `messages_ko.properties` | 한국어 메시지 번들                                                                  |

**메시지 키 규칙:**

| 접두사                  | 용도               | 예시                             |
| ----------------------- | ------------------ | -------------------------------- |
| `error.not-found.*`     | 엔티티 미존재      | `error.not-found.user`           |
| `error.access-denied.*` | 권한 부족          | `error.access-denied.not-member` |
| `error.duplicate.*`     | 중복 리소스        | `error.duplicate.login-id`       |
| `error.business.*`      | 비즈니스 규칙 위반 | `error.business.remove-owner`    |
| `validation.*`          | Bean Validation    | `validation.not-blank.login-id`  |

### 시간/타임존 정책 (UTC 표준화)

- **백엔드 엔티티 시간 타입:** `Instant` (Java Time)
- **DB 컬럼 타입:** `TIMESTAMP WITH TIME ZONE` (`timestamptz`)
- **JPA/Jackson 설정:** `hibernate.jdbc.time_zone: UTC`, `spring.jackson.time-zone: UTC`
- **API 응답 시간 포맷:** ISO-8601 UTC (예: `2026-02-09T07:23:34.065Z`)
- **프론트 표시:** 브라우저 로컬 시간대로 변환하되, 포맷은 현재 선택 언어(`i18n`) 기준으로 렌더링

### 에러 응답 형식

모든 에러는 통일된 JSON 형식으로 반환되며, `Accept-Language` 헤더에 따라 다국어 메시지가 반환된다.

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

| 용도      | 토큰 예시                                                          |
| --------- | ------------------------------------------------------------------ |
| 배경      | `bg-background`, `bg-card`, `bg-muted`, `bg-accent`, `bg-popover`  |
| 텍스트    | `text-foreground`, `text-muted-foreground`, `text-card-foreground` |
| 강조/상태 | `bg-primary`, `bg-secondary`, `bg-destructive`                     |
| 테두리    | `border-border`, `border-input`                                    |
| 인터랙션  | `hover:bg-accent`, `focus:bg-accent`                               |

#### ERD 전용 토큰

ERD 편집기 영역(Header, Sidebar, TableNode, ERDCanvas)에서 사용하는 도메인 토큰:

| 토큰                                                       | 용도              |
| ---------------------------------------------------------- | ----------------- |
| `bg-header`, `text-header-foreground`, `text-header-muted` | 상단 헤더 바      |
| `bg-erd-table-header`, `text-erd-table-header-foreground`  | 테이블 노드 헤더  |
| `text-erd-pk`, `text-erd-fk`, `text-erd-nn`                | PK/FK/NN 뱃지     |
| `bg-erd-handle`, `border-erd-handle-border`                | Handle (연결점)   |
| `text-erd-warning`                                         | unsaved 경고 표시 |

모든 토큰은 `index.css`에 `:root` (라이트)와 `.dark` (다크) 양쪽에 정의되어 있다.

#### 새 색상 추가 절차

1. `index.css`의 `:root`와 `.dark` 모두에 CSS Variable 추가
2. `tailwind.config.js`의 `colors`에 `hsl(var(--token-name))` 매핑
3. 컴포넌트에서 시맨틱 클래스 사용 (예: `bg-erd-table-header`)

새 shadcn/ui 컴포넌트 추가 시: `components/ui/`에 파일 생성, `cn()` 사용, `ref`는 일반 prop으로 전달 (`forwardRef` 사용 금지 — React 19).

### 접근성 (a11y)

- **아이콘 전용 버튼**: 반드시 `aria-label` 속성을 포함한다
- **토글 버튼**: `aria-label`에 대상 컨텍스트를 포함한다 (예: ``aria-label={`Toggle PK for ${col.name}`}``)
- **form 요소**: `<label>` 연결이 불가능한 경우 `aria-label`을 추가한다
- **로딩 상태**: `Spinner` 컴포넌트 (`components/ui/spinner.tsx`)를 사용한다 — 단순 텍스트 표시 금지

### ERD 캔버스

- **@xyflow/react** 기반, 16x16 그리드 스냅
- 커스텀 `TableNode`: 테이블 헤더 + 컬럼 행, 각 컬럼에 좌(target)/우(source) Handle
- Handle ID: `{nodeId}-{colId}-source` / `{nodeId}-{colId}-target`
- Edge ID: `e-{sourceHandle}-{targetHandle}`
- Edge 타입: `step` (직각 연결), `MarkerType.ArrowClosed`
- 상태: Zustand `useCanvasStore` — `serialize()` → JSON 문자열 → `Diagram.content` (TEXT)

#### FK 연결 모드

플로팅 툴바의 **FK Connect** 버튼으로 진입한다. 부모 테이블(PK 소스) → 자식 테이블(FK 대상) 순서로 클릭하면, 부모의 PK 컬럼을 기반으로 자식 테이블에 FK 컬럼과 엣지가 자동 생성된다.

- FK 컬럼명: `{부모테이블명소문자}_{PK컬럼명}` (예: `users_id`). 중복 시 `_1`, `_2` suffix 추가
- 복합 PK: 각 PK 컬럼에 대해 FK 컬럼 + 엣지 개별 생성
- 자기 참조 허용 (동일 테이블 FK)
- 부모에 PK 없으면 `toast.error` 표시, Escape 키로 모드 해제

#### 엣지 상호작용

- **클릭**: 엣지 + 양쪽 테이블 노드 하이라이트 (엣지: `stroke: primary, animated`, 노드: `ring-2 ring-primary`)
- **Delete/Backspace**: 하이라이트된 엣지에 삭제 다이얼로그 표시. 3버튼: FK 제거(destructive) / FK 유지(outline) / 취소(ghost)
- **우클릭**: 컨텍스트 메뉴 표시 → 삭제 다이얼로그
- **빈 영역 클릭**: 모든 하이라이트 해제
- React Flow의 기본 Delete 동작은 `deleteKeyCode={null}`로 비활성화

#### 자동 배치

플로팅 툴바의 **Auto Layout** 버튼으로 실행한다. `dagre` 알고리즘으로 좌→우(`LR`) 방향 자동 배치.

- 노드 크기: width 280px, height = 40(헤더) + 컬럼수 × 28(행) + 32(푸터)
- 간격: nodesep 80px, ranksep 120px, margin 40px

#### 키보드 단축키

| 단축키                 | 상수                 | 동작                             |
| ---------------------- | -------------------- | -------------------------------- |
| `Ctrl+S` / `Cmd+S`     | `KEYBINDINGS.SAVE`   | 다이어그램 서버 저장             |
| `Delete` / `Backspace` | `KEYBINDINGS.DELETE` | 선택된 엣지 삭제 다이얼로그      |
| `Escape`               | `KEYBINDINGS.ESCAPE` | FK 모드 해제, 컨텍스트 메뉴 닫기 |

모든 키보드 단축키는 `constants/keybindings.ts`의 `KEYBINDINGS` 상수로 관리하고 `react-hotkeys-hook`의 `useHotkeys()`를 통해 등록한다. 네이티브 `addEventListener('keydown')` + 매직 스트링(`'Escape'` 등)은 사용 금지.

### 라우팅

```text
/login                                                    — 로그인 (공개)
/signup                                                   — 회원가입 (공개)
/teams                                                    — 팀 목록 (인증 필요)
/teams/:teamId/projects                                   — 프로젝트 목록 (인증 필요)
/teams/:teamId/dictionary                                 — 데이터 사전 (인증 필요)
/teams/:teamId/projects/:projectId/diagrams               — 다이어그램 목록 (인증 필요)
/teams/:teamId/projects/:projectId/diagrams/:diagramId    — ERD 편집기 (인증 필요)
```

인증되지 않은 사용자는 `ProtectedRoute`에 의해 `/login`으로 리다이렉트된다.
라우트 경로는 `ROUTES` 상수 (`constants/routes.ts`)로 관리한다.

### Axios 인스턴스

```text
baseURL: /api  →  Vite 프록시  →  localhost:8190
요청 인터셉터: Accept-Language (i18n.language) + localStorage Access Token → Authorization: Bearer <token>
응답 인터셉터: 401 → Refresh Token으로 갱신 시도 (큐 패턴) → 실패 시 로그인 리다이렉트
```

- 페이지에서 `axiosInstance`를 직접 호출하지 않는다. `api/` 모듈 함수를 통해서만 호출.
- `Accept-Language` 헤더: 매 요청마다 `i18n.language` 값을 전송하여 서버 에러 메시지가 사용자 언어로 반환되도록 한다
- 서버 에러 메시지 추출: `getErrorMessage(err, fallback)` (`lib/api-error.ts`)

## 설정 상세

### `application.yml`

```yaml
spring:
    docker:
        compose:
            lifecycle-management: start-only # 앱 종료 시 컨테이너 유지
    messages:
        basename: i18n/messages # 메시지 번들 경로 (i18n/messages.properties, i18n/messages_ko.properties)
        encoding: UTF-8
        fallback-to-system-locale: false # 항상 messages.properties (영어)로 fallback
    jackson:
        time-zone: UTC
        serialization:
            write-dates-as-timestamps: false
    jpa:
        hibernate.ddl-auto: update # 엔티티 변경 시 스키마 자동 업데이트
        properties:
            hibernate:
                jdbc.time_zone: UTC

decorator:
    datasource:
        p6spy:
            enable-logging: true # p6spy 활성화 (바인딩 파라미터 포함 SQL 로깅)
            multiline: false # 커스텀 PrettySqlFormat이 포맷 담당
            logging: slf4j # SLF4J를 통해 Logback으로 출력

smart-erd:
    cors:
        allowed-origins: http://localhost:3000
    jwt:
        secret: ${SMART_ERD_JWT_SECRET:기본값}
        access-expiration: 1800000 # 30분 (ms)
        refresh-expiration: 86400000 # 24시간 (ms)
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
./gradlew bootRun            # 개발 서버 기동 (:8190, Docker PostgreSQL 자동 시작)
./gradlew build              # 전체 빌드 (컴파일 + 테스트)
./gradlew test               # 테스트 실행
./gradlew compileJava        # 컴파일만 (QueryDSL/Lombok AP 트리거)

# 프론트엔드
cd client
npm run dev                  # 개발 서버 기동 (:3000, 프록시 /api → :8190)
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
- **시간 컬럼:** 감사/만료 시각 컬럼은 `timestamptz` 사용 (UTC 기준 저장)
- **기존 데이터 변환:** 운영 DB의 `timestamp without time zone` 컬럼은 별도 SQL 마이그레이션으로 `timestamptz`로 변환 필요
- **전제 조건:** Docker Desktop 실행 중, 포트 5432 사용 가능, 최초 실행 시 `postgres:17` 이미지 다운로드 (~400MB)
