---
status: awaiting_human_verify
trigger: "PREVIEW 영역 빈 상태 + Remote changes pending 매번 표시"
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED — 두 이슈의 근본 원인 특정 완료
test: 코드 수정 후 검증
expecting: 초기 로드 시 프리뷰 표시 + 단일 사용자 진입 시 배너 미표시
next_action: 사용자 검증 대기 — 마크다운 문서 진입 후 프리뷰 즉시 표시 여부 + 배너 미표시 확인

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

verification: TypeScript 컴파일 성공, ESLint 성공, Prettier 적용 완료. 사용자 실환경 검증 필요.
files_changed:
  - client/src/lib/markdown-preview-worker.ts
  - client/src/hooks/useMarkdownSectionPreview.ts
  - client/src/pages/document/use-markdown-document-session.ts
