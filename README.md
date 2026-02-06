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
| ERD 캔버스 | @xyflow/react 12, Zustand 5                                                     |
| 에디터     | @monaco-editor/react 4.6                                                        |

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
├── api/auth/                        # HTTP 인터페이스 계층
│   ├── AuthController.java          #   POST /api/auth/login, /api/auth/signup
│   └── dto/                         #   LoginRequest, SignupRequest, AuthResponse (record)
├── config/                          # 설정
│   ├── SecurityConfig.java          #   Spring Security (OAuth2 Resource Server JWT, CSRF 비활성)
│   ├── JwtConfig.java               #   JwtEncoder / JwtDecoder 빈 (NimbusJwtDecoder, HS256)
│   ├── JwtProperties.java           #   @ConfigurationProperties("smart-erd.jwt") — secret, expiration
│   └── CorsConfig.java              #   @ConfigurationProperties("smart-erd.cors") + CorsProperties 내부 클래스
└── domain/                          # 도메인 계층 (Service도 여기에 위치)
    ├── common/entity/               #   BaseTimeEntity (createdAt, updatedAt 자동 감사)
    ├── user/
    │   ├── entity/                   #   User (loginId unique, BCrypt password)
    │   ├── repository/              #   UserRepository (findByLoginId)
    │   └── service/                 #   AuthService, AuthUserDetailsService, JwtTokenService
    ├── team/
    │   ├── entity/                  #   Team, TeamMember (@IdClass 복합키), TeamMemberRole (ADMIN/MEMBER/VIEWER)
    │   └── repository/             #   TeamRepository, TeamMemberRepository
    ├── project/
    │   ├── entity/                  #   Project (team 소속)
    │   └── repository/             #   ProjectRepository
    ├── diagram/
    │   ├── entity/                  #   Diagram (CLOB content — React Flow JSON 직렬화)
    │   └── repository/             #   DiagramRepository
    └── dictionary/
        ├── entity/                  #   Domain (논리명→물리타입), Term (논리명→물리명)
        └── repository/             #   DomainRepository, TermRepository
```

**패키지 규칙:**
- `api/` — HTTP 인터페이스만 (Controller + DTO). 비즈니스 로직 금지.
- `domain/` — 엔티티, 리포지토리, 서비스. 도메인별로 하위 패키지 분리.
- DTO는 Java `record`로 작성, `@Valid` 검증 포함.

### 프론트엔드

```text
client/
├── index.html                       # SPA 진입점
├── package.json                     # "type": "module" (ESM)
├── tailwind.config.js               # CSS 변수 기반 색상, darkMode: ["class"], tailwindcss-animate
├── postcss.config.js                # tailwindcss + autoprefixer
├── vite.config.ts                   # @/ alias → ./src, 프록시 /api → :8080
├── tsconfig.app.json                # paths: { "@/*": ["./src/*"] }
└── src/
    ├── main.tsx                     # createRoot + StrictMode
    ├── App.tsx                      # 루트 컴포넌트 (데모 데이터 로드 → DiagramPage)
    ├── index.css                    # Tailwind directives + CSS 변수 (light/dark)
    ├── vite-env.d.ts                # Vite 타입 참조
    ├── api/
    │   └── axiosInstance.ts         # baseURL: /api, JWT Bearer 토큰 자동 첨부 인터셉터
    ├── components/
    │   ├── erd/
    │   │   ├── ERDCanvas.tsx        # @xyflow/react 캔버스 (16x16 그리드 스냅, MiniMap, Controls, step edge)
    │   │   └── TableNode.tsx        # 커스텀 노드: 테이블 헤더 + 컬럼 행 (PK/FK 뱃지, 좌우 Handle)
    │   ├── layout/
    │   │   ├── Header.tsx           # 상단 고정 헤더 (h-12, bg-gray-900)
    │   │   └── Sidebar.tsx          # 좌측 사이드바 (w-56, 테이블 목록)
    │   └── ui/                      # shadcn/ui 컴포넌트
    │       ├── button.tsx           #   Button — 6 variant, 4 size, asChild(@radix-ui/react-slot)
    │       ├── card.tsx             #   Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter
    │       ├── input.tsx            #   Input — 순수 HTML input (shadcn/ui 표준)
    │       └── label.tsx            #   Label — @radix-ui/react-label + CVA
    ├── lib/
    │   └── utils.ts                 # cn() = clsx + tailwind-merge
    ├── pages/
    │   ├── DiagramPage.tsx          # 메인 레이아웃: Header + Sidebar + ERDCanvas
    │   └── LoginPage.tsx            # 로그인 폼 (Card + Label + Input + Button)
    ├── stores/
    │   └── useCanvasStore.ts        # Zustand: nodes, edges, onChange 핸들러, serialize/deserialize
    └── types/
        └── erd.ts                   # Column, TableNodeData, TableNode, ERDEdge
```

**프론트엔드 규칙:**
- `components/ui/` — 범용 재사용 컴포넌트 (shadcn/ui). 도메인 로직 금지.
- `components/erd/` — ERD 도메인 전용 컴포넌트.
- `components/layout/` — 페이지 구조 컴포넌트 (Header, Sidebar).
- `@/` alias를 사용하여 import (`@/components/ui/button`, `@/lib/utils`).
- 상태 관리는 `stores/` 디렉토리, `use` prefix 컨벤션.

## 엔티티 관계

```text
User ─┬─< TeamMember >─── Team ─┬─< Project ─< Diagram
      │     (복합키: team+user)  ├─< Domain
      └── owner_id ─────────────┘└─< Term ──> Domain (nullable)
```

- **User** : 사용자 (`loginId`로 인증, BCrypt 비밀번호)
- **Team** : 프로젝트와 데이터 사전을 소유하는 조직 단위
- **TeamMember** : 팀-사용자 다대다 조인 (`@IdClass(TeamMemberId)`, 역할: ADMIN, MEMBER, VIEWER)
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

### 인증 필요 (Bearer Token)

현재 엔드포인트 미구현 상태. 향후 Team, Project, Diagram, Dictionary CRUD API가 추가될 예정.

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

### Axios 인스턴스

```text
baseURL: /api  →  Vite 프록시  →  localhost:8080
요청 인터셉터: localStorage.getItem('token') → Authorization: Bearer <token>
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

| 경로              | 접근 권한  |
| ----------------- | --------- |
| `/api/auth/**`    | 공개       |
| `/h2-console/**`  | 공개       |
| 그 외 모든 경로    | 인증 필요  |

## 주요 규칙

### Null Safety

루트 패키지 `com.smarterd`에 `@NonNullApi`를 선언하여 하위 패키지 전체에 non-null 기본 정책을 적용한다.

- 모든 파라미터와 반환 타입은 기본적으로 **non-null**로 취급된다
- null이 허용되는 경우 `@Nullable`을 명시해야 한다

### Gradle Annotation Processor 순서

`build.gradle`에서 Lombok `annotationProcessor`를 QueryDSL보다 **먼저** 선언해야 한다. 순서가 바뀌면 QueryDSL 코드 생성이 실패한다.

```groovy
// Lombok (먼저)
annotationProcessor 'org.projectlombok:lombok'
// QueryDSL (나중)
annotationProcessor 'com.querydsl:querydsl-apt:5.1.0:jakarta'
```

### Handle ID 규칙

컬럼 레벨의 관계 연결을 위해 각 컬럼에 고유한 Handle ID를 부여한다.

```text
Source Handle: {nodeId}-{colId}-source
Target Handle: {nodeId}-{colId}-target
Edge ID:       e-{sourceHandle}-{targetHandle}
```

### 다이어그램 영속화

`useCanvasStore.serialize()` → JSON 문자열 → `Diagram.content` (CLOB)

### TypeScript 주의사항

- `applyNodeChanges()`는 제네릭 `Node[]`를 반환하므로 `Node<TableNodeData>[]`로 타입 단언 필요
- 프론트엔드 ESM 기반 (`"type": "module"`) — `require()` 사용 금지, ESM import만 사용

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
```

## 데이터베이스

H2 인메모리 DB를 사용하며, 서버 기동 시마다 스키마가 재생성된다 (`ddl-auto: create-drop`).

- H2 콘솔: `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:mem:smarterd`
- Username: `sa` / Password: (없음)
