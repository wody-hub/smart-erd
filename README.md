# Smart ERD

ERwin과 같은 ERD 설계 도구를 웹 기반으로 구현한 간이 솔루션.

테이블 노드를 시각적으로 배치하고, 컬럼 레벨의 관계(FK)를 드래그로 연결하며, 데이터 사전(도메인/용어)을 통해 컬럼 타입과 이름을 표준화할 수 있다.

## 기술 스택

| 계층       | 기술                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| Backend    | Spring Boot 3.5.10, Java 25, Gradle 8.12, Spring Security 6.x, Spring Data JPA |
| 인증       | Spring OAuth2 Resource Server (HMAC-SHA256 JWT), BCrypt                        |
| 쿼리       | QueryDSL 5.1.0:jakarta                                                         |
| DB         | H2 in-memory (`ddl-auto: create-drop`)                                         |
| Frontend   | React 18, TypeScript 5.6, Vite 6, Tailwind CSS 3.4                             |
| ERD 캔버스 | @xyflow/react 12, Zustand 5                                                    |
| 에디터     | @monaco-editor/react 4.6                                                       |

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

## 프로젝트 구조

### 백엔드

```
src/main/java/com/smarterd/
├── SmartErdApplication.java         # 애플리케이션 진입점 (@SpringBootApplication)
├── package-info.java                # @NonNullApi 선언 (하위 패키지 전체 non-null 정책)
├── api/auth/                        # HTTP 인터페이스 계층
│   ├── AuthController.java          #   POST /api/auth/login, /api/auth/signup
│   └── dto/                         #   LoginRequest, SignupRequest, AuthResponse
├── config/                          # 설정
│   ├── SecurityConfig.java          #   Spring Security (OAuth2 Resource Server JWT)
│   ├── JwtConfig.java               #   JwtEncoder / JwtDecoder 빈 + JwtProperties (HS256)
│   ├── JwtProperties.java           #   JWT 설정 프로퍼티 (@ConfigurationProperties)
│   └── CorsConfig.java              #   CORS 설정 + CorsProperties (@ConfigurationProperties)
└── domain/                          # 도메인 계층
    ├── common/entity/               #   BaseTimeEntity (createdAt, updatedAt 감사)
    ├── user/
    │   ├── entity/                   #   User
    │   ├── repository/              #   UserRepository
    │   └── service/                 #   AuthService, AuthUserDetailsService, JwtTokenService
    ├── team/
    │   ├── entity/                  #   Team, TeamMember (@IdClass 복합키), TeamMemberRole
    │   └── repository/             #   TeamRepository, TeamMemberRepository
    ├── project/
    │   ├── entity/                  #   Project
    │   └── repository/             #   ProjectRepository
    ├── diagram/
    │   ├── entity/                  #   Diagram (CLOB에 React Flow JSON 저장)
    │   └── repository/             #   DiagramRepository
    └── dictionary/
        ├── entity/                  #   Domain (논리명→물리타입), Term (논리명→물리명)
        └── repository/             #   DomainRepository, TermRepository
```

### 프론트엔드

```
client/src/
├── api/axiosInstance.ts             # Axios (JWT Bearer 토큰 자동 첨부)
├── components/
│   ├── erd/
│   │   ├── ERDCanvas.tsx            # React Flow 캔버스 (16x16 그리드 스냅, 미니맵)
│   │   └── TableNode.tsx            # 커스텀 테이블 노드 (PK/FK 뱃지, 컬럼별 Handle)
│   └── layout/
│       ├── Header.tsx               # 상단 헤더
│       └── Sidebar.tsx              # 좌측 테이블 목록 패널
├── pages/
│   ├── DiagramPage.tsx              # 메인 ERD 편집 페이지
│   └── LoginPage.tsx                # 로그인 페이지 (UI)
├── stores/useCanvasStore.ts         # Zustand 캔버스 상태 (nodes, edges, serialize/deserialize)
└── types/erd.ts                     # Column, TableNodeData, TableNode, ERDEdge 타입
```

## 엔티티 관계

```
User ─┬─< TeamMember >─── Team ─┬─< Project ─< Diagram
      │     (복합키: team+user)  ├─< Domain
      └── owner_id ─────────────┘└─< Term ──> Domain (nullable)
```

- **User** : 사용자 (loginId로 인증)
- **Team** : 프로젝트와 데이터 사전을 소유하는 조직 단위
- **TeamMember** : 팀-사용자 다대다 조인 (역할: ADMIN, MEMBER, VIEWER)
- **Project** : ERD 프로젝트 그룹
- **Diagram** : React Flow JSON을 CLOB으로 저장하는 ERD 다이어그램
- **Domain** : 논리명→물리 데이터타입 매핑 사전 (예: "금액" → "DECIMAL(15,2)")
- **Term** : 논리명→물리명 매핑 사전 (예: "사용자명" → "user_name")

## 인증 흐름

JWT 기반 Stateless 인증을 사용한다. Spring Security OAuth2 Resource Server의 내장 `BearerTokenAuthenticationFilter`가 토큰 검증을 자동 처리한다.

### 회원가입

```bash
curl -X POST http://localhost:8080/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"loginId":"test","password":"12345678","name":"Test"}'
```

### 로그인

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"test","password":"12345678"}'
```

### 인증된 API 호출

```bash
curl http://localhost:8080/api/... \
  -H "Authorization: Bearer <token>"
```

## 주요 규칙

### Null Safety

루트 패키지 `com.smarterd`에 `@NonNullApi`를 선언하여 하위 패키지 전체에 non-null 기본 정책을 적용한다.

- 모든 파라미터와 반환 타입은 기본적으로 **non-null**로 취급된다
- null이 허용되는 경우 `@Nullable`을 명시해야 한다

```java
// com.smarterd/package-info.java
@NonNullApi
package com.smarterd;
```

### Handle ID 규칙

컬럼 레벨의 관계 연결을 위해 각 컬럼에 고유한 Handle ID를 부여한다.

```
Source Handle: {nodeId}-{colId}-source
Target Handle: {nodeId}-{colId}-target
Edge ID:       e-{sourceHandle}-{targetHandle}
```

### 다이어그램 영속화

`useCanvasStore.serialize()` → JSON 문자열 → `Diagram.content` (CLOB)

### Gradle Annotation Processor 순서

Lombok을 QueryDSL보다 먼저 선언해야 한다. 순서가 바뀌면 QueryDSL 코드 생성이 실패한다.

## 빌드 명령어

```bash
# 백엔드
./gradlew build              # 전체 빌드 (컴파일 + 테스트)
./gradlew test               # 테스트 실행
./gradlew compileJava        # 컴파일만 (QueryDSL/Lombok AP 트리거)

# 프론트엔드
cd client
npm run build                # 프로덕션 빌드 (tsc + vite)
npm run lint                 # ESLint
```

## 데이터베이스

H2 인메모리 DB를 사용하며, 서버 기동 시마다 스키마가 재생성된다 (`ddl-auto: create-drop`).

- H2 콘솔: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:mem:smarterd`
- Username: `sa` / Password: (없음)
