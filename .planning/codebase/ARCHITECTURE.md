# Architecture

**Analysis Date:** 2026-04-02

## Pattern Overview

**Overall:** Layered Monolith (Backend) + SPA (Frontend) with Plugin-based Real-time Collaboration

**Key Characteristics:**
- Backend: 4-layer architecture (API / Application / Collaboration / Domain)
- Frontend: Feature-based SPA with Zustand (client state) + React Query (server state) + Yjs (CRDT collaboration)
- Real-time: Raw WebSocket + Yjs binary protocol, plugin 기반 채널 확장 구조
- 문서 타입 플러그인 시스템: ERD와 Markdown 두 가지 문서 플러그인이 동일한 협업 프레임워크 위에서 동작

## Layers

**API Layer (`api/`):**
- Purpose: HTTP 인터페이스 (Controller + DTO). 비즈니스 로직 없음
- Location: `src/main/java/com/smarterd/api/`
- Contains: Controller, Request/Response DTO (Java record), Validator
- Depends on: `domain/` 서비스, `application/` 유스케이스
- Used by: 프론트엔드 HTTP 클라이언트
- 도메인별 하위 패키지: `auth/`, `diagram/`, `dictionary/`, `project/`, `team/`
- DTO는 `dto/` 하위 디렉토리에 record 타입으로 정의

**Application Layer (`application/`):**
- Purpose: 유스케이스 조율 (Cross-domain orchestration). 여러 도메인 서비스를 조합하는 복합 비즈니스 로직
- Location: `src/main/java/com/smarterd/application/`
- Contains: UseCase 클래스, Port 인터페이스, Model (payload/result record)
- Depends on: `domain/` 서비스, `collaboration/` 인프라
- Used by: `api/` Controller, WebSocket handler
- 하위 패키지: `collaboration/command/`, `collaboration/query/`, `diagram/command/`, `diagram/model/`, `diagram/port/`
- 예시: `SaveDiagramAuthoritativeContentUseCase`, `IssueDiagramCollaborationTicketUseCase`

**Collaboration Layer (`collaboration/`):**
- Purpose: 도메인 무관 실시간 협업 인프라 프레임워크 (채널, 세션, 스냅샷, 문서 엔진)
- Location: `src/main/java/com/smarterd/collaboration/`
- Contains: 채널 플러그인 인터페이스, 세션 관리, 스냅샷 저장소, 문서 엔진 추상화
- Depends on: 없음 (독립 모듈)
- Used by: `domain/diagram/collaboration/` (다이어그램 채널 구현), `application/` (유스케이스)
- 핵심 추상화: `CollaborationChannelPlugin`, `CollaborationWebSocketBinding`, `SharedDocumentEngine`, `CollaborationSnapshotStore`
- 하위 패키지: `channel/` (채널 등록/인증/바인딩), `document/` (문서 엔진), `handoff/` (핸드오프), `metadata/`, `persistence/`, `plugin/` (플러그인 레지스트리), `session/`, `snapshot/`

**Domain Layer (`domain/`):**
- Purpose: 엔티티, 리포지토리, 도메인 서비스. 핵심 비즈니스 규칙
- Location: `src/main/java/com/smarterd/domain/`
- Contains: JPA Entity, Spring Data Repository (+ QueryDSL Custom), Service
- Depends on: `collaboration/` (diagram 도메인의 협업 구현체만)
- Used by: `api/`, `application/`
- 하위 패키지: `common/`, `user/`, `team/`, `project/`, `diagram/`, `dictionary/`, `markdown/`

**Config Layer (`config/`):**
- Purpose: Spring 설정 빈, 보안, WebSocket, 스케줄러
- Location: `src/main/java/com/smarterd/config/`
- Contains: `@Configuration` 클래스, `@ConfigurationProperties`, Scheduler
- 하위 패키지: `dictionary/`, `i18n/`, `openapi/`, `persistence/`, `scheduler/`, `security/`, `support/`, `websocket/`

## Data Flow

**HTTP API Request Flow:**

1. Client HTTP 요청 → Vite 프록시(`/api` → backend port)
2. `SecurityConfig` JWT 인증 (Spring OAuth2 Resource Server `BearerTokenAuthenticationFilter`)
3. Controller (DTO validation via `@Valid`) → Service/UseCase 호출
4. Service → Repository (JPA/QueryDSL) → PostgreSQL
5. 응답 DTO → JSON (Jackson, UTC timezone) → Client

**WebSocket Collaboration Flow:**

1. Client: POST `/api/ws-ticket` → 일회용 ticket 발급 (JWT 인증 필요)
2. Client: WebSocket 연결 (`/ws/diagram/{diagramId}?ticket=...`)
3. `WsTicketHandshakeInterceptor` → ticket 검증 → 세션 인증
4. `DiagramWebSocketHandler` → `DiagramWebSocketMessageDispatcher` → 메시지 타입별 핸들러 분배
5. Yjs binary update 릴레이: sender → `DiagramRoomManager` → 같은 room의 다른 세션에 브로드캐스트
6. 주기적 snapshot flush: `DiagramUpdateBuffer` → `DiagramSnapshotService` → DB 저장

**Diagram Save Flow (Authoritative Content):**

1. Client `Ctrl+S` → `saveDiagram()` API 호출 (content JSON + ydocSnapshot binary)
2. `DiagramController.save()` → `SaveDiagramUseCase.execute()`
3. `SaveDiagramAuthoritativeContentUseCase`: content 갱신 + snapshot 동기화 + realtime reconcile 예약
4. 트랜잭션 커밋 후: `reconcileRealtimeStateWithPersistedContentAfterCommit()` → 실시간 세션과 DB 상태 정합성 유지

**State Management (Frontend):**

- **Server State:** React Query (`@tanstack/react-query`) — API 데이터 캐싱, 자동 갱신, mutation + invalidation
- **Client State:** Zustand — `useAuthStore` (인증 토큰), `useCanvasStore` (ERD 노드/엣지 React Flow 상태), `useCollaborationStore` (협업 세션 상태)
- **CRDT State:** Yjs `Y.Doc` — 실시간 협업 문서 동기화, WebSocket 경유 update 전파

## Key Abstractions

**Collaboration Channel Plugin (Backend):**
- Purpose: 도메인별 실시간 협업 채널을 프레임워크에 등록하는 확장점
- Interface: `CollaborationChannelPlugin` (`collaboration/channel/`)
- Implementation: `DiagramCollaborationChannelPlugin` (`domain/diagram/collaboration/`)
- Pattern: Strategy + Registry — `CollaborationChannelRegistry`가 모든 채널 플러그인을 수집하고 채널 타입으로 라우팅
- 관련 support 인터페이스: `CollaborationTicketSupport`, `CollaborationRuntimeSupport`, `CollaborationWebSocketBinding`

**Document Plugin (Frontend):**
- Purpose: ERD / Markdown 등 문서 타입별 협업 로직을 분리
- Core contracts: `client/src/collaboration/core/contracts/` (document-bootstrap, document-plugin, shared-document-engine 등)
- ERD plugin: `client/src/collaboration/plugins/erd/`
- Markdown plugin: `client/src/collaboration/plugins/markdown/`
- Registry: `client/src/collaboration/registry/` (document-plugin-registry, shared-document-engine-registry)
- Pattern: Plugin Registry — `DocumentEditorRoute`가 pluginId로 ERD/Markdown 페이지를 분기

**UseCase Pattern (Application Layer):**
- Purpose: 단일 유스케이스를 캡슐화하는 서비스 클래스
- Location: `src/main/java/com/smarterd/application/`
- Pattern: Command/Query 분리 — `command/` (상태 변경), `query/` (조회)
- 예시: `SaveDiagramAuthoritativeContentUseCase`, `IssueCollaborationTicketUseCase`, `LoadCollaborationHandoffUseCase`
- Port 인터페이스: `DiagramPresencePort`, `DiagramRealtimeSessionPort` (DIP 적용)

**QueryDSL Custom Repository:**
- Purpose: 타입 안전한 복합 쿼리
- Pattern: `XxxRepository extends JpaRepository, XxxRepositoryCustom` → `XxxRepositoryCustomImpl`
- 예시: `DiagramRepositoryCustomImpl`, `TeamRepositoryCustomImpl`, `TeamMemberRepositoryCustomImpl`, `RefreshTokenRepositoryCustomImpl`, `TermRepositoryCustomImpl`

**WebSocket Message Handler (Strategy):**
- Purpose: 메시지 타입별 처리 로직 분리
- Location: `src/main/java/com/smarterd/domain/diagram/websocket/relay/handler/`
- Handlers: `YjsUpdateMessageHandler`, `AwarenessMessageHandler`, `SyncRelayMessageHandler`, `CompactedSnapshotMessageHandler`, `PresenceSnapshotRequestMessageHandler`, `SnapshotRequestMessageHandler`
- Dispatcher: `DiagramWebSocketMessageDispatcher`

## Entry Points

**Backend Application:**
- Location: `src/main/java/com/smarterd/SmartErdApplication.java`
- Triggers: `./bootRun-dev.sh`, `./gradlew bootRun`
- Responsibilities: Spring Boot 자동 구성, JPA Auditing, Scheduling 활성화

**Frontend Application:**
- Location: `client/src/main.tsx` → `client/src/App.tsx`
- Triggers: `npm run dev`
- Responsibilities: React root 생성, QueryClientProvider, Router, 라우트 정의, ProtectedRoute 가드

**WebSocket Endpoint:**
- Location: `src/main/java/com/smarterd/domain/diagram/websocket/transport/DiagramWebSocketHandler.java`
- Triggers: WebSocket 연결 (`/ws/diagram/{diagramId}`)
- Responsibilities: 바이너리 메시지 수신 → 타입별 핸들러 디스패치 → Room 릴레이

**Document Router (Frontend):**
- Location: `client/src/pages/document/DocumentEditorRoute.tsx`
- Triggers: `/teams/:teamId/projects/:projectId/diagrams/:diagramId` 라우트
- Responsibilities: pluginId 기반 ERD/Markdown 문서 편집기 분기

## Error Handling

**Strategy:** 도메인 예외 계층 + 전역 핸들러 + i18n 메시지 코드

**Backend Patterns:**
- `LocalizedException` 기반 예외 계층: `EntityNotFoundException`(404), `DomainAccessDeniedException`(403), `DuplicateException`(409), `BusinessException`(400), `ConflictException`(409), `TooManyRequestsException`(429)
- 모든 예외는 `messageCode + messageArgs` 패턴으로 생성 → `GlobalExceptionHandler`에서 `MessageSource` + `Locale`로 해석
- Location: `src/main/java/com/smarterd/domain/common/exception/`, `src/main/java/com/smarterd/api/common/GlobalExceptionHandler.java`

**Frontend Patterns:**
- `getErrorMessage(err, fallback)` (`client/src/lib/api-error.ts`): 서버 에러 메시지 추출
- `toast.error(getErrorMessage(err, t('key')))`: 모든 mutation `onError` 핸들러에서 사용
- 401 응답 → Axios 인터셉터에서 Refresh Token 갱신 시도 (큐 패턴) → 실패 시 로그인 리다이렉트

## Cross-Cutting Concerns

**Logging:** p6spy로 바인딩 파라미터 포함 SQL 로깅 (`PrettySqlFormat`). Hibernate `show-sql` 미사용.

**Validation:** Jakarta Bean Validation (`@Valid`) + `MessageSource` 연동 (`ValidationConfig`). Frontend에서는 HTML5 + React form 검증.

**Authentication:** JWT stateless auth (HMAC-SHA256). Access Token 30분, Refresh Token 24시간 (로테이션). `SecurityConfig` (`config/security/`).

**i18n:** Backend — `MessageSource` + `AcceptHeaderLocaleResolver` (ko/en). Frontend — `react-i18next` + `i18n/locales/{ko,en}/translation.json`.

**Audit:** `BaseTimeEntity` (createdAt, updatedAt), `BaseAuditEntity` (createdBy, updatedBy). JPA Auditing + `LoginIdAuditorAware`.

**Timezone:** UTC 표준화. Entity `Instant`, DB `timestamptz`, Jackson `UTC`, Frontend 브라우저 시간대 변환.

**Scheduling:** `@EnableScheduling` — `RefreshTokenCleanupScheduler`, `LoginRateLimitCleanupScheduler`.

---

*Architecture analysis: 2026-04-02*
