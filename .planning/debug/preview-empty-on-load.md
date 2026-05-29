---
status: resolved
trigger: "PREVIEW 영역 빈 상태 + Remote changes pending 매번 표시"
created: 2026-04-02T00:00:00Z
updated: 2026-05-29T12:18:05+09:00
---

## Current Focus

hypothesis: RESOLVED — Worker ready/fallback 및 초기 sync remote-event 흡수 로직이 현재 코드에 유지됨
test: targeted frontend collaboration/preview regression + backend websocket regression + invalid-ticket handshake smoke
expecting: 초기 로드 시 프리뷰가 빈 문자열로 고착되지 않고, 초기 sync는 단일 사용자 remote-pending으로 표시되지 않음
next_action: none

## Symptoms

expected: 페이지 로드 시 저장된 마크다운 내용이 프리뷰에 즉시 렌더링되어야 함. 단일 사용자 진입 시 Remote changes pending 배너가 표시되지 않아야 함.
actual: 프리뷰 비어있음 + 매번 Remote changes pending 배너 표시. 에디터 수정 후에야 프리뷰 렌더링됨.
errors: 콘솔에 JS 에러 없음 (WebSocket 정상 연결 확인됨)
reproduction: 1) 로그인 2) 마크다운 문서 진입 3) PREVIEW 빈 상태 + Remote changes pending 배너 확인 4) Accept 클릭 5) 여전히 프리뷰 비어있음 6) 에디터에서 아무 글자 입력 7) 프리뷰 렌더링됨
started: Phase 1 gap closure 후 QA에서 발견

## Eliminated

- hypothesis: Worker error (DOMPurify Worker 비호환)
  evidence: DOMPurify 3.x는 isSupported=false일 때 입력값 그대로 반환 (에러 아님). Worker error handler가 트리거되지 않음.
  timestamp: 2026-04-02T00:00:30Z

- hypothesis: React StrictMode double mount로 인한 Worker 참조 불일치
  evidence: StrictMode에서 ref는 유지되며, Worker 생성 useEffect가 debounce useEffect보다 먼저 선언되어 cleanup/remount 후에도 정상 참조
  timestamp: 2026-04-02T00:00:40Z

- hypothesis: stale closure (readSerializedBuffer)
  evidence: subscribeDocumentChanges useEffect deps에 readSerializedBuffer가 포함되어 있어 항상 최신 함수 참조 사용
  timestamp: 2026-04-02T00:00:50Z

## Evidence

- timestamp: 2026-04-02T00:00:10Z
  checked: useMarkdownSectionPreview 초기화 흐름
  found: useState(() => renderMarkdownPreview(body)) — 초기 body=''이므로 html='' 시작. debounce 300ms 후 Worker에 요청하여 업데이트.
  implication: 초기 프리뷰는 빈 상태이지만, 300ms 후 업데이트되어야 함. 업데이트되지 않는 원인이 따로 있음.

- timestamp: 2026-04-02T00:00:20Z
  checked: YjsProvider sync origin
  found: SYNC_STEP2, SNAPSHOT_RESPONSE, SNAPSHOT_RESPONSE_V2 모두 Y.applyUpdate(doc, payload, 'remote') origin 사용
  implication: 초기 sync도 'remote' origin → DocumentStore에서 remote event 발행 → subscribeDocumentChanges 콜백에서 setRemoteMutation() 호출. Issue 2의 직접 원인.

- timestamp: 2026-04-02T00:00:55Z
  checked: Worker 초기화 타이밍
  found: new Worker(url, {type:'module'}) — module Worker는 비동기적으로 모듈을 로드함. Vite dev mode에서 DOMPurify, marked 등 import가 개별 HTTP 요청으로 처리됨. Worker의 message handler 등록이 debounce 300ms 후 postMessage 시점보다 늦을 수 있음.
  implication: Issue 1의 근본 원인 — Worker가 준비되기 전에 postMessage를 보내면 메시지가 무시되고 응답이 없어 html이 영원히 빈 상태로 유지됨. 에디터 수정 시에는 Worker가 이미 초기화 완료된 상태이므로 정상 동작.

## Resolution

root_cause: |
  **Issue 1 (PREVIEW 빈 상태)**: useMarkdownSectionPreview의 Worker가 type:'module'로 생성되어 모듈 로드가 비동기적으로 이루어진다. debounce 300ms 후 requestSectionPreview가 Worker에 postMessage를 보내지만, Worker의 모듈 로드가 아직 완료되지 않아 message handler가 등록되지 않은 상태이면 메시지가 유실된다. Worker 응답이 없으므로 html은 초기값(빈 문자열)으로 영구 유지. 이후 에디터 수정 시에는 Worker가 이미 초기화 완료되어 정상 동작.
  
  **Issue 2 (Remote changes pending)**: YjsProvider sync 시 서버 응답(SNAPSHOT_RESPONSE, SYNC_STEP2)이 모두 Y.applyUpdate(doc, payload, 'remote') origin으로 적용된다. DocumentStore.handleRevisionChanged에서 이 origin이 remote로 해석되어 subscribeDocumentChanges 콜백에서 setRemoteMutation()이 호출된다. 단일 사용자여도 초기 sync에서 항상 remote event가 발생.

fix: |
  **Issue 1**: Worker에 'ready' handshake 메커니즘 추가. Worker가 모듈 로드 완료 후 'ready' 메시지를 보내고, 훅에서 workerReadyRef로 추적. Worker 미준비 시 메인 스레드 fallback 사용.
  
  **Issue 2**: collaborationReady가 true로 전환되기 전 remote 이벤트는 무시. collaborationReadyRef를 사용하여 subscribeDocumentChanges 콜백에서 체크.

verification: TypeScript 컴파일 성공, ESLint 성공, Prettier 적용 완료. 2026-05-29 targeted regression 재검증 완료.
files_changed:
  - client/src/lib/markdown-preview-worker.ts
  - client/src/hooks/useMarkdownSectionPreview.ts
  - client/src/pages/document/use-markdown-document-session.ts

## RESOLVED

Verified: 2026-05-29

- `client/src/lib/markdown-preview-worker.ts` still emits `{ type: 'ready' }` after module initialization.
- `client/src/hooks/useMarkdownSectionPreview.ts` still queues worker requests until ready and renders a main-thread fallback while the module worker is loading.
- `client/src/pages/document/use-markdown-document-session.ts` still ignores remote document-change events until `collaborationReadyRef` is true.
- `cd client && npm run test:unit -- markdown-section-preview code-sync-revision diagram-collaboration-provider-connection diagram-collaboration-provider-events diagram-collaboration-provider-session` -> PASS (`363/363`).
- `./gradlew test --tests com.smarterd.domain.diagram.websocket.transport.WsTicketHandshakeInterceptorTest --tests com.smarterd.application.diagram.command.ValidateDiagramCollaborationHandshakeUseCaseTest --tests com.smarterd.domain.diagram.websocket.ticket.InMemoryWsTicketStoreTest` -> PASS.
- Invalid-ticket websocket handshake against the running local backend returns `HTTP/1.1 403`, not the old empty `200 OK`.

Browser smoke note: Playwright E2E was attempted but not used as this session's closeout evidence because one test lacked required `SMART_ERD_E2E_LOGIN` env and the markdown collaboration smoke failed at a final persistence assertion unrelated to the worker-ready/initial-sync checks above.
