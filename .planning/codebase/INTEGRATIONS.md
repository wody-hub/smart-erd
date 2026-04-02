# External Integrations

**Analysis Date:** 2026-04-02

## APIs & External Services

**OpenAPI/Swagger:**
- Swagger UI - API 문서화 및 테스트
  - SDK/Client: `springdoc-openapi-starter-webmvc-ui:2.8.6`
  - 접속: `http://localhost:9503/swagger-ui/index.html`
  - 설정: `src/main/java/com/smarterd/config/OpenApiConfig.java` (JWT Bearer auth)

**외부 API 연동:**
- 외부 서드파티 API 연동 없음 (자체 완결형 애플리케이션)

## Data Storage

**Databases:**
- PostgreSQL 17 (Docker)
  - Connection: `jdbc:postgresql://localhost:15432/smarterd`
  - 환경변수: `spring.datasource.url/username/password` (`application.yml`)
  - Client: Spring Data JPA + Hibernate, QueryDSL 5.1.0, Blaze-Persistence 1.6.17
  - Connection Pool: HikariCP (max 20, min idle 5)
  - Docker: `compose.yaml` 서비스 `postgres`, 포트 `15432:5432`
  - 볼륨: `postgres-data` (external, named `smart-erd_postgres-data`)
  - 스키마 관리: `ddl-auto: update` + Flyway 마이그레이션 (`src/main/resources/db/migration/`)
  - 테스트: Testcontainers 임시 PostgreSQL 자동 생성/폐기

**Redis (선택적):**
- Redis 7 Alpine (Docker, `redis` profile 필요)
  - 용도: WebSocket 티켓 저장소, 벌크 검증 저장소
  - Docker: `compose.yaml` 서비스 `redis`, 포트 `16379:6379`, profile `redis`
  - 기본값: in-memory (Redis 미사용)
  - 설정: `smart-erd.websocket.ticket-store: in-memory | redis`, `smart-erd.dictionary.bulk-validation.store: in-memory | redis`
  - 자동 설정 제외: `RedisAutoConfiguration`, `RedisRepositoriesAutoConfiguration` (기본 비활성)

**File Storage:**
- 로컬 파일시스템만 사용 (외부 오브젝트 스토리지 없음)
- Excel import/export: Apache POI (`poi-ooxml:5.4.1`)로 인메모리 처리
- ERD 내보내기: 프론트엔드에서 `html-to-image` + `jspdf`로 클라이언트 사이드 생성

**Caching:**
- React Query 클라이언트 캐시 (staleTime: 30s, retry: 1) - `client/src/lib/query-client.ts`
- 서버 사이드 캐시 없음 (Redis 캐시 미사용)

## Authentication & Identity

**Auth Provider:**
- 자체 구현 (커스텀 JWT 인증)
  - Spring OAuth2 Resource Server (HMAC-SHA256 JWT)
  - Access Token: 30분 만료 (`smart-erd.jwt.access-expiration`)
  - Refresh Token: 24시간 만료, 로테이션 전략 (`smart-erd.jwt.refresh-expiration`)
  - 비밀번호: BCrypt 해싱
  - 설정: `src/main/java/com/smarterd/config/SecurityConfig.java`, `JwtConfig.java`, `JwtProperties.java`
  - 로그인 속도 제한: 5회 실패 시 60초 윈도우, 300초 차단 (`smart-erd.auth.login-rate-limit`)
  - Refresh Token 정리: 1시간 간격, 소비된 토큰 24시간 보존 (`smart-erd.auth.refresh-token-cleanup`)

**공개 엔드포인트:**
- `/api/auth/**` (login, signup, refresh, logout)
- `/swagger-ui/**`, `/v3/api-docs/**`

**보안 헤더:**
- CSP connect-sources 설정 가능 (`smart-erd.auth.csp.connect-sources`)
- 신뢰 프록시 CIDR: `127.0.0.1/32`, `::1/128` (`smart-erd.auth.client-ip.trusted-proxy-cidrs`)

## WebSocket (실시간 협업)

**프로토콜:**
- Spring WebSocket (네이티브), `spring-boot-starter-websocket`
- Yjs CRDT 기반 실시간 다이어그램 협업
- 설정: `src/main/java/com/smarterd/config/websocket/WebSocketConfig.java`

**WebSocket 모듈:**
- `src/main/java/com/smarterd/domain/diagram/websocket/` (8개 하위 패키지)
  - `ticket/` - WS 접속 티켓 발급/검증 (in-memory 또는 Redis)
  - `transport/` - 메시지 전송 계층
  - `room/` - 다이어그램별 협업 룸 관리
  - `relay/` - 메시지 릴레이
  - `protocol/` - Yjs 프로토콜 처리
  - `session/` - 세션 관리
  - `model/` - 데이터 모델
  - `mapper/` - 데이터 매핑

**제한 설정:**
- 룸당 최대 세션: 10
- 초당 최대 메시지: 100
- 바이너리 메시지 크기: 1MB
- 스냅샷 플러시 간격: 5초
- 사용자당 최대 연결: 5
- 누적 업데이트 최대 크기: 10MB
- 세션 최대 지속시간: 30분
- 종료 시 플러시 타임아웃: 15초

## Monitoring & Observability

**Error Tracking:**
- 전용 에러 트래킹 서비스 없음
- `GlobalExceptionHandler`에서 중앙 집중 에러 처리 (`src/main/java/com/smarterd/api/common/`)

**Logs:**
- SLF4J + Logback (Spring Boot 기본)
- p6spy SQL 로깅: 바인딩 파라미터가 채워진 완성 SQL (`PrettySqlFormat`, FormatStyle.BASIC)
- 설정: `spy.properties` + `application.yml` (`decorator.datasource.p6spy.*`)

## CI/CD & Deployment

**Hosting:**
- 명시적 클라우드 배포 설정 없음 (로컬 개발 중심)
- Electron 데스크톱 앱 배포: macOS DMG (universal), Windows NSIS/portable

**CI Pipeline:**
- 명시적 CI 설정 파일 미감지 (`.github/workflows/` 등 없음)
- Gradle `check` 태스크에 `verifyFunctionDocs` 포함 (JSDoc/Javadoc 검증)
- Prettier `format:check` 사용 가능

## Environment Configuration

**필수 환경변수:**
- `SMART_ERD_JWT_SECRET` - JWT 서명 키 (Base64, 개발 기본값 내장)
- Docker Desktop 실행 - PostgreSQL 컨테이너 자동 시작

**선택적 환경변수:**
- `SERVER_PORT` - 백엔드 포트 (기본 9503)
- `SMART_ERD_CORS_ORIGINS` - CORS 허용 오리진
- `SMART_ERD_DB_*` - HikariCP 풀 설정 (max-pool-size, min-idle 등)
- `SMART_ERD_WEBSOCKET_*` - WebSocket 설정
- `VITE_DEV_SERVER_PORT` - 프론트엔드 개발 서버 포트
- `VITE_API_PROXY_TARGET` - API 프록시 대상
- `VITE_WS_PROXY_TARGET` - WebSocket 프록시 대상
- `VITE_ERD_DIFF_APPLY_MODE` - Diff Apply 롤아웃 모드 (off/internal/beta/all)
- `VITE_ERD_AUTOSAVE_*` - 자동 저장 설정

**Secrets 위치:**
- `.envrc` 파일 존재 (direnv)
- `client/.env.frontend-*` 파일 (Vite 모드별 환경 설정)
- `application.yml` 내 기본값 포함 (개발 전용)

## Webhooks & Callbacks

**Incoming:**
- 없음

**Outgoing:**
- 없음

## i18n (다국어)

**Backend:**
- Spring `MessageSource` - `src/main/resources/i18n/messages.properties` (en) + `messages_ko.properties` (ko)
- `AcceptHeaderLocaleResolver` - `Accept-Language` 헤더 기반 로케일 결정
- Bean Validation 메시지 코드 연동 (`ValidationConfig`)

**Frontend:**
- i18next + react-i18next + LanguageDetector
- 번역 파일: `client/src/i18n/locales/{en,ko}/translation.json`
- Axios 인터셉터에서 `Accept-Language` 헤더 자동 첨부

---

*Integration audit: 2026-04-02*
