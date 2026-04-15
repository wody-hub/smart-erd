# Codebase Structure

**Analysis Date:** 2026-04-02

## Directory Layout

```
smart-erd/
├── src/main/java/com/smarterd/   # Backend Java 소스
├── src/main/resources/            # 설정 파일, i18n, 마이그레이션 SQL
├── src/test/java/com/smarterd/    # Backend 테스트
├── client/                        # Frontend (Vite + React + TypeScript)
├── scripts/                       # 유틸리티 스크립트
├── docs/                          # 문서
├── plan/                          # 기획 문서
├── .planning/                     # GSD 계획/분석 문서
├── .github/workflows/             # CI 워크플로우
├── build.gradle                   # Gradle 빌드 설정
├── compose.yaml                   # Docker Compose (PostgreSQL)
├── package.json                   # Root (Prettier + 스크립트)
├── bootRun-dev.sh                 # Dev 프로필 실행 (port 9503)
├── bootRun-local.sh               # Local 프로필 실행 (port 9501)
├── bootRun-test.sh                # Test 프로필 실행 (port 9502)
├── CLAUDE.md                      # Claude Code 프로젝트 지침
└── DESIGN.md                      # 디자인 시스템 가이드
```

## Backend Directory Structure

```
src/main/java/com/smarterd/
├── SmartErdApplication.java          # @SpringBootApplication 진입점
├── package-info.java                 # @NonNullApi (전체 패키지 non-null 기본값)
│
├── api/                              # HTTP 인터페이스 (Controller + DTO만)
│   ├── auth/                         #   AuthController + dto/ + validator/
│   ├── diagram/                      #   DiagramController, WsTicketController + dto/
│   ├── dictionary/                   #   DictionarySetController, DomainController, TermController, WordController, DictionarySuggestController + dto/
│   ├── project/                      #   ProjectController + dto/
│   ├── team/                         #   TeamController + dto/ + validator/
│   └── common/                       #   GlobalExceptionHandler + dto/ (PageResponse, PageSearchRequest)
│
├── application/                      # 유스케이스 조율 (Cross-domain orchestration)
│   ├── collaboration/
│   │   ├── command/                  #   IssueCollaborationTicketUseCase, PersistCollaborationSnapshotUseCase, ValidateCollaborationTicketUseCase
│   │   └── query/                    #   LoadCollaborationHandoffUseCase
│   └── diagram/
│       ├── command/                  #   SaveDiagramUseCase, SaveDiagramAuthoritativeContentUseCase, PersistDiagramSnapshotUseCase, ...
│       ├── model/                    #   DiagramPresenceParticipantPayload, DiagramSessionJoinCompletion, ...
│       └── port/                     #   DiagramPresencePort, DiagramRealtimeSessionPort (DIP 포트 인터페이스)
│
├── collaboration/                    # 도메인 무관 실시간 협업 프레임워크
│   ├── channel/                      #   CollaborationChannelPlugin, CollaborationWebSocketBinding, Registry, Authenticator, ...
│   ├── document/                     #   SharedDocumentEngine, DocumentSnapshotCodec, DocumentCheckpoint
│   ├── handoff/                      #   CollaborationHandoffPolicy, CollaborationHandoffResult
│   ├── metadata/                     #   DocumentMetadata, DocumentMetadataService
│   ├── persistence/                  #   DocumentPersistenceCoordinator, DocumentBootstrapReader, PersistedDocument
│   ├── plugin/                       #   BaseCollaborationPlugin, CollaborationPluginRegistry, ScopeResolver, DomainValidationHook
│   ├── session/                      #   CollaborationAuthenticatedSession
│   ├── snapshot/                     #   CollaborationSnapshotStore, CollaborationSnapshotSaveCommand
│   └── CollaborationLimits.java      #   협업 제한 설정값
│
├── config/                           # Spring 설정
│   ├── dictionary/                   #   BulkValidationSessionStoreConfig
│   ├── i18n/                         #   LocaleConfig, ValidationConfig
│   ├── openapi/                      #   OpenApiConfig
│   ├── persistence/                  #   QuerydslConfig, BlazeConfig, LoginIdAuditorAware, PrettySqlFormat, sqlformat/
│   ├── scheduler/                    #   RefreshTokenCleanupScheduler, LoginRateLimitCleanupScheduler
│   ├── security/                     #   SecurityConfig, JwtConfig, JwtProperties, CorsConfig, AuthSecurityProperties
│   ├── support/                      #   EnvironmentProfile
│   └── websocket/                    #   WebSocketConfig, WebSocketProperties, WsTicketStoreConfig
│
├── domain/                           # 도메인 계층 (Entity + Repository + Service)
│   ├── common/
│   │   ├── entity/                   #   BaseTimeEntity, BaseAuditEntity
│   │   ├── exception/                #   LocalizedException, EntityNotFoundException, DomainAccessDeniedException, DuplicateException, BusinessException, ConflictException, TooManyRequestsException
│   │   └── message/                  #   MessageCode
│   ├── user/
│   │   ├── entity/                   #   User, RefreshToken, LoginRateLimitAttempt
│   │   ├── repository/               #   UserRepository, RefreshTokenRepository(+Custom), LoginRateLimitAttemptRepository
│   │   └── service/                  #   AuthService, AuthUserDetailsService, JwtTokenService, LoginRateLimitService
│   ├── team/
│   │   ├── entity/                   #   Team, TeamMember, TeamMemberId (record @IdClass), TeamMemberRole (enum)
│   │   ├── repository/               #   TeamRepository(+Custom), TeamMemberRepository(+Custom)
│   │   └── service/                  #   TeamService
│   ├── project/
│   │   ├── entity/                   #   Project
│   │   ├── repository/               #   ProjectRepository
│   │   └── service/                  #   ProjectService
│   ├── diagram/
│   │   ├── entity/                   #   Diagram, DiagramPluginId (enum: ERD, MARKDOWN), SaveSource (enum)
│   │   ├── repository/               #   DiagramRepository(+Custom), DiagramBootstrapProjection, DiagramSummaryProjection, DiagramWithSnapshotFlag, SnapshotWithRevision
│   │   ├── service/                  #   DiagramService, DiagramSnapshotService, DiagramDictionaryBindingService, DiagramColumnDefinitionExportService, DiagramTableDefinitionExportService, DiagramIndexDefinitionExportService, DiagramDefinitionWorkbookSupport
│   │   ├── collaboration/            #   DiagramCollaborationChannelPlugin, DiagramCollaborationWebSocketBinding, DiagramCollaborationTicketSupport/Issuer/Authenticator, DiagramCollaborationRuntimeSupport, DiagramCollaborationSnapshotStore, DiagramCollaborationHandoffPolicy, DiagramDocumentBootstrapReader, DiagramDocumentMetadataService, DiagramCollaborationSessionMetadataPolicy, DiagramCollaborationEndpointSupport, DiagramCollaborationResourceKeyFactory/Keys, DiagramCollaborationDocumentDefaults
│   │   └── websocket/
│   │       ├── mapper/               #   DiagramApplicationPayloadMapper
│   │       ├── model/                #   JoinResult, LeaveResult, JoinRejectionReason, PresenceParticipant, PresenceSnapshot
│   │       ├── protocol/             #   YjsUpdateFormat
│   │       ├── relay/                #   DiagramMessageHandler, DiagramMessageSender, DiagramMessageContext, DiagramMessageTypes, DiagramPresenceNotifier, DiagramHandoffSnapshotResponder
│   │       ├── relay/handler/        #   YjsUpdateMessageHandler, AwarenessMessageHandler, SyncRelayMessageHandler, CompactedSnapshotMessageHandler, PresenceSnapshotRequestMessageHandler, SnapshotRequestMessageHandler
│   │       ├── room/                 #   DiagramRoomManager, DiagramSessionRegistry, DiagramPresenceManager, DiagramRealtimeSessionPortAdapter, DiagramSessionRateLimiter, DiagramUpdateBuffer
│   │       ├── session/              #   AuthenticatedSession, DiagramWebSocketSessionInfo, DiagramWebSocketSessionResolver
│   │       ├── ticket/               #   WsTicketService, WsTicketStore (interface), InMemoryWsTicketStore, RedisWsTicketStore, TicketData
│   │       └── transport/            #   DiagramWebSocketHandler, DiagramWebSocketMessageDispatcher, DiagramWebSocketSessionLifecycle, DiagramSessionTransportUseCase, DiagramInboundMessageContextFactory, DiagramLegacyPresencePort, DiagramSessionCloseResult, WsTicketHandshakeInterceptor
│   ├── dictionary/
│   │   ├── entity/                   #   DictionarySet, Domain, Term, Word
│   │   ├── repository/               #   DictionarySetRepository, DomainRepository, TermRepository(+Custom), WordRepository
│   │   └── service/                  #   DictionarySetService, DomainService, TermService, WordService, DictionarySuggestService, DictionarySetExportService, DictionarySetMigrationService, DictionaryWorkbookExportSupport, AbstractBulkService, DomainBulkService, TermBulkService, WordBulkService, BulkModels, DomainLogicalNameSupport, DomainPhysicalTypeSupport, DomainStartupBackfillService, DomainDictionaryExportService, TermDictionaryExportService, WordDictionaryExportService, session/BulkValidationSessionStore(+InMemory/Redis)
│   └── markdown/
│       └── service/                  #   MarkdownDocumentDescriptorService, MarkdownExportService, MarkdownTemplateService, MarkdownTemplateDescriptor
│
└── utils/                            # 공용 유틸리티
    ├── AppStringUtils.java           #   문자열 검증/정규화 래퍼
    ├── AppArrayUtils.java            #   배열 유틸리티 래퍼
    └── excel/                        #   Excel 관련 유틸리티
```

## Frontend Directory Structure

```
client/src/
├── main.tsx                          # createRoot + StrictMode
├── App.tsx                           # QueryClientProvider + Router + Routes + ProtectedRoute
├── index.css                         # Tailwind directives + CSS Variable 토큰 (light/dark)
│
├── api/                              # API 모듈 (도메인별)
│   ├── axiosInstance.ts              #   baseURL: /api, JWT 자동 첨부, 401 Refresh 큐 패턴
│   ├── authApi.ts                    #   login(), signup(), refresh(), logout()
│   ├── diagramApi.ts                 #   CRUD + save + bootstrap + snapshot + export
│   ├── dictionarySetApi.ts           #   DictionarySet CRUD
│   ├── domainApi.ts                  #   Domain CRUD + bulk
│   ├── projectApi.ts                 #   Project CRUD
│   ├── suggestApi.ts                 #   용어/도메인 suggest
│   ├── teamApi.ts                    #   Team CRUD + 멤버 관리
│   ├── termApi.ts                    #   Term CRUD + bulk
│   └── wordApi.ts                    #   Word CRUD + bulk
│
├── collaboration/                    # 실시간 협업 프레임워크
│   ├── core/                         #   도메인 무관 협업 코어
│   │   ├── contracts/                #     document-bootstrap, document-plugin, shared-document-engine, document-checkpoint, document-metadata, document-snapshot-codec, document-read-executor
│   │   ├── draft/                    #     draft-state
│   │   ├── engines/                  #     yjs-shared-document-engine
│   │   ├── persistence/              #     document-persistence-coordinator, passthrough-document-snapshot-codec
│   │   ├── session/                  #     document-mutation-session, document-session-bootstrap, use-document-page-host
│   │   ├── store/                    #     document-store, document-revision-tracker, document-change-origin
│   │   ├── collaboration-runtime-types.ts
│   │   ├── collaboration-session-machine.ts
│   │   ├── collaboration-preview-sync-status.ts
│   │   └── use-collaboration-session.ts
│   ├── channel/                      #   채널별 협업 구현
│   │   ├── diagram/                  #     다이어그램 채널 (30+ 파일: provider, session, transport, hooks)
│   │   └── document/                 #     마크다운 채널 (bootstrap, runtime, hooks)
│   ├── plugins/                      #   문서 타입 플러그인
│   │   ├── erd/                      #     ERD 플러그인 (mutation applier, plugin, scope collector, document actions, query/)
│   │   └── markdown/                 #     Markdown 플러그인 (mutation applier, plugin, sanitize policy, query/)
│   ├── registry/                     #   플러그인/엔진 레지스트리
│   ├── yjs/                          #   Yjs 어댑터 (diagram, markdown)
│   ├── YjsProvider.ts               #   Yjs WebSocket provider
│   └── yjsBridge.ts                  #   Yjs bridge 유틸리티
│
├── components/                       # UI 컴포넌트
│   ├── ui/                           #   shadcn/ui 프리미티브 + 공용 컴포넌트 (confirm-dialog, create-resource-dialog, spinner, sonner)
│   ├── auth/                         #   ProtectedRoute
│   ├── erd/                          #   ERD 캔버스 컴포넌트 (ERDCanvas, TableNode, CanvasToolbar, EdgeContextMenu, PreviewCanvas, DdlCodeEditorPanel, DslCodeEditorPanel, DiagramSidebar, RemoteCursors, ValidationPanel 등 50+ 파일)
│   ├── layout/                       #   Header, LanguageSwitcher, Sidebar (ERD 의존 금지)
│   ├── dictionary/                   #   DomainTab, TermTab, DomainFormDialog, TermFormDialog
│   ├── team/                         #   MembersDialog
│   ├── markdown/                     #   MarkdownEditorShell, MarkdownPreviewPane, MarkdownToolbar, MarkdownOutlineRail, MarkdownInfoDrawer, MarkdownStatusStrip
│   ├── workspace/                    #   CreateDocumentDialog, DocumentHubRow, DocumentTypeBadge, ProjectWorkspaceHero, WorkspaceEmptyState
│   └── project/                      #   (프로젝트 관련 컴포넌트)
│
├── pages/                            # 페이지 컴포넌트 (도메인별 하위 디렉토리)
│   ├── auth/                         #   LoginPage, SignupPage
│   ├── team/                         #   TeamsPage
│   ├── project/                      #   ProjectsPage
│   ├── diagram/                      #   DiagramsPage, DiagramPage + hooks (use-diagram-page-controls, use-diagram-page-runtime-state, use-diagram-work-mode-state)
│   ├── document/                     #   DocumentEditorRoute (pluginId 분기), MarkdownDocumentPage + hooks
│   ├── dictionary/                   #   DictionaryPage
│   └── settings/                     #   SettingsPage (Electron 전용)
│
├── stores/                           # Zustand 상태 관리
│   ├── useAuthStore.ts               #   인증 상태 + localStorage 동기화
│   ├── useCanvasStore.ts             #   (레거시) ERD 캔버스 상태
│   ├── useCollaborationStore.ts      #   (레거시) 협업 세션 상태
│   ├── canvas/                       #   캔버스 액션 모듈 (canvasGroupActions, canvasTableActions, canvasSyncActions, canvasStoreHelpers, canvasStoreTypes)
│   └── erd/                          #   ERD 전용 스토어 (useCanvasStore, useCollaborationStore — 리팩토링 버전)
│
├── hooks/                            # 커스텀 훅 (35+ 파일)
│   ├── useInlineEdit.ts              #   인라인 텍스트 편집
│   ├── useFkConnectMode.ts           #   FK 연결 모드
│   ├── useDarkMode.ts                #   다크 모드 토글
│   ├── useExportDiagram.ts           #   다이어그램 내보내기
│   ├── useDictionaryCache.ts         #   사전 데이터 캐시
│   ├── useDictionarySuggest.ts       #   사전 자동완성
│   ├── useBidirectionalCodeSync.ts   #   코드 에디터 양방향 동기화
│   ├── useAutoBackup.ts              #   자동 백업
│   ├── useAwareness.ts               #   Yjs awareness (원격 커서)
│   ├── useSnapshotCompaction.ts      #   스냅샷 압축
│   └── ...                           #   (기타 도메인별 훅)
│
├── lib/                              # 순수 유틸리티 + 설정
│   ├── utils.ts                      #   cn() = clsx + tailwind-merge
│   ├── api-error.ts                  #   getErrorMessage() 서버 에러 추출
│   ├── query-client.ts               #   QueryClient (staleTime: 30s, retry: 1)
│   ├── auto-layout.ts                #   dagre 기반 자동 레이아웃
│   ├── platform.ts                   #   Electron/웹 환경 감지
│   ├── handle-id.ts                  #   Handle ID 파싱 유틸
│   ├── dsl-parser.ts                 #   DSL 파서
│   ├── ddl-parser.ts                 #   DDL 파서
│   ├── ddl-generator.ts              #   DDL 생성기
│   ├── dsl-generator.ts              #   DSL 생성기
│   ├── erd-yjs-utils.ts              #   ERD Yjs 유틸리티
│   ├── erd-diff-apply.ts             #   ERD diff 적용
│   ├── export/                       #   내보내기 유틸리티
│   └── ...                           #   (40+ 파일, 도메인별 순수 함수)
│
├── constants/                        # 상수 정의 (매직 스트링 금지)
│   ├── keybindings.ts                #   KEYBINDINGS 레지스트리
│   ├── storage.ts                    #   STORAGE_KEYS (localStorage)
│   ├── routes.ts                     #   ROUTES (라우트 경로)
│   ├── query-keys.ts                 #   queryKeys (React Query 캐시 키)
│   ├── canvas-history.ts             #   캔버스 히스토리 상수
│   ├── code-sync.ts                  #   코드 동기화 상수
│   ├── collab-lock.ts                #   협업 잠금 상수
│   ├── sync-status.ts                #   동기화 상태 상수
│   └── ws.ts                         #   WebSocket 상수
│
├── types/                            # TypeScript 타입 정의 (도메인별)
│   ├── erd.ts                        #   TableNodeData, ColumnData, Edge 관련
│   ├── auth.ts                       #   Auth 관련
│   ├── team.ts                       #   Team, TeamMember
│   ├── project.ts                    #   Project
│   ├── diagram.ts                    #   Diagram
│   ├── dictionary.ts                 #   Domain, Term, Word, DictionarySet
│   ├── document.ts                   #   Document 관련
│   ├── collaboration.ts              #   Collaboration 관련
│   ├── markdown.ts                   #   Markdown 관련
│   ├── workspace.ts                  #   Workspace 관련
│   └── vendor.d.ts, electron.d.ts    #   외부 모듈 타입 선언
│
├── i18n/                             # 다국어 설정
│   ├── index.ts                      #   i18next 초기화
│   ├── i18next.d.ts                  #   타입 보강 (key 자동완성)
│   └── locales/{en,ko}/translation.json  # 번역 리소스
│
└── workers/                          # Web Worker
    └── dslParser.worker.ts           #   DSL 파싱 Worker (비동기)
```

## Backend Resources

```
src/main/resources/
├── application.yml                   # 메인 설정 (dev 프로필 기본)
├── application-local.yml             # Local 프로필 오버라이드
├── application-test.yml              # Test 프로필 오버라이드
├── spy.properties                    # p6spy SQL 로깅 설정
├── db/migration/                     # Flyway 마이그레이션 SQL (V20260304~)
├── i18n/                             # 서버 메시지 번들 (messages.properties, messages_ko.properties)
├── lua/                              # Redis Lua 스크립트
└── markdown/                         # 마크다운 템플릿
```

## Key File Locations

**Entry Points:**
- `src/main/java/com/smarterd/SmartErdApplication.java`: Spring Boot 진입점
- `client/src/main.tsx`: React 앱 진입점
- `client/src/App.tsx`: Router + 라우트 정의
- `client/src/pages/document/DocumentEditorRoute.tsx`: 문서 타입 분기 라우터

**Configuration:**
- `build.gradle`: Gradle 빌드 설정 (의존성, annotation processor 순서)
- `client/vite.config.ts`: Vite 설정 (`@/` alias, proxy)
- `client/tailwind.config.js`: Tailwind CSS 설정 (시맨틱 색상, darkMode)
- `client/tsconfig.app.json`: TypeScript 경로 alias
- `compose.yaml`: Docker PostgreSQL 17

**Core Logic:**
- `src/main/java/com/smarterd/domain/diagram/`: 다이어그램 핵심 도메인 (Entity + Service + WebSocket + Collaboration)
- `client/src/collaboration/`: 프론트엔드 실시간 협업 프레임워크
- `client/src/stores/erd/`: ERD 캔버스 상태 관리 (Zustand)
- `client/src/components/erd/`: ERD UI 컴포넌트 (50+ 파일)

**Testing:**
- `src/test/java/com/smarterd/`: 백엔드 테스트 (Testcontainers)

## Naming Conventions

**Backend Files:**
- Entity: `PascalCase.java` (예: `Diagram.java`, `TeamMember.java`)
- Repository: `{Entity}Repository.java`, `{Entity}RepositoryCustom.java`, `{Entity}RepositoryCustomImpl.java`
- Service: `{Entity}Service.java` 또는 `{Domain}{Feature}Service.java`
- UseCase: `{Verb}{Domain}{Noun}UseCase.java` (예: `SaveDiagramAuthoritativeContentUseCase.java`)
- Controller: `{Entity}Controller.java`
- DTO: `{Action}{Entity}Request.java` / `{Entity}Response.java` (record)
- Config: `{Feature}Config.java` / `{Feature}Properties.java`

**Frontend Files:**
- Page: `PascalCase.tsx` (예: `DiagramPage.tsx`, `TeamsPage.tsx`)
- Component: `PascalCase.tsx` (예: `TableNode.tsx`, `ERDCanvas.tsx`)
- Hook: `camelCase.ts` (예: `useInlineEdit.ts`, `useFkConnectMode.ts`)
- API: `camelCase.ts` (예: `diagramApi.ts`, `teamApi.ts`)
- Type: `camelCase.ts` (예: `erd.ts`, `team.ts`)
- Util: `kebab-case.ts` (예: `api-error.ts`, `auto-layout.ts`, `handle-id.ts`)
- Constant: `kebab-case.ts` (예: `query-keys.ts`, `keybindings.ts`)
- Collaboration: `kebab-case.ts` (예: `erd-document-plugin.ts`, `collaboration-session-machine.ts`)

**Directories:**
- Backend: `lowercase` 단어 (예: `diagram/`, `dictionary/`, `websocket/`)
- Frontend: `lowercase` 단어 (예: `components/erd/`, `collaboration/plugins/`)

## Where to Add New Code

**New API Endpoint:**
- Controller: `src/main/java/com/smarterd/api/{domain}/{Domain}Controller.java`
- DTO: `src/main/java/com/smarterd/api/{domain}/dto/{Action}{Domain}Request.java`
- Service: `src/main/java/com/smarterd/domain/{domain}/service/{Domain}Service.java`
- UseCase (복합 로직): `src/main/java/com/smarterd/application/{domain}/command/{Verb}{Domain}UseCase.java`

**New Entity:**
- Entity: `src/main/java/com/smarterd/domain/{domain}/entity/{Entity}.java`
- Repository: `src/main/java/com/smarterd/domain/{domain}/repository/{Entity}Repository.java`
- Migration: `src/main/resources/db/migration/V{YYYYMMDD}_{seq}__{description}.sql`

**New Frontend Page:**
- Page: `client/src/pages/{domain}/{PascalCase}Page.tsx`
- Route: `client/src/App.tsx`에 `<Route>` 추가 + `client/src/constants/routes.ts`에 경로 상수 추가

**New Frontend Component:**
- Domain component: `client/src/components/{domain}/{PascalCase}.tsx`
- Shared UI: `client/src/components/ui/{lowercase}.tsx`
- Custom hook: `client/src/hooks/use{PascalCase}.ts`

**New API Client Function:**
- `client/src/api/{domain}Api.ts`에 함수 추가
- React Query key: `client/src/constants/query-keys.ts`에 추가
- Response type: `client/src/types/{domain}.ts`에 추가

**New Collaboration Channel Plugin:**
- Backend: `src/main/java/com/smarterd/domain/{channel}/collaboration/` 패키지에 `{Channel}CollaborationChannelPlugin` 등 생성, `collaboration/channel/` 인터페이스 구현
- Frontend: `client/src/collaboration/channel/{channel}/` 디렉토리 생성, `client/src/collaboration/plugins/{channel}/` 플러그인 구현

**New Utility:**
- Backend: `src/main/java/com/smarterd/utils/`
- Frontend: `client/src/lib/{kebab-case}.ts`

**New i18n Key:**
- Frontend: `client/src/i18n/locales/{en,ko}/translation.json`
- Backend: `src/main/resources/i18n/messages.properties` + `messages_ko.properties`

## Special Directories

**`client/src/collaboration/`:**
- Purpose: 실시간 협업 프레임워크 (Yjs + WebSocket)
- Generated: No
- Committed: Yes
- Note: `core/`는 도메인 무관 추상화, `channel/`은 채널별 구현, `plugins/`는 문서 타입 플러그인

**`src/main/java/com/smarterd/application/`:**
- Purpose: 유스케이스 조율 레이어 (복수 도메인 서비스 조합)
- Generated: No
- Committed: Yes
- Note: `domain/` 서비스 간 순환 의존을 방지하고 복합 비즈니스 로직을 격리

**`src/main/resources/db/migration/`:**
- Purpose: 데이터베이스 마이그레이션 SQL
- Generated: No
- Committed: Yes
- Note: `ddl-auto: update`와 병행 사용 (주로 데이터 마이그레이션 및 컬럼 추가)

**`client/src/workers/`:**
- Purpose: Web Worker (비동기 파싱)
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-04-02*
