---
status: resolved
trigger: "WebSocket 핸드셰이크가 101 대신 200 OK 반환 — 마크다운 에디터 실시간 협업 실패"
created: 2026-04-02T00:00:00Z
updated: 2026-05-29T12:18:05+09:00
---

## Current Focus

hypothesis: RESOLVED - WsTicketHandshakeInterceptor가 검증 실패 시 명시적으로 403을 설정함
test: interceptor regression + ticket validation/store regression + invalid-ticket curl handshake
expecting: 유효하지 않은 WebSocket ticket은 200 OK가 아니라 403으로 거부됨
next_action: none

## Symptoms

expected: WebSocket 연결이 101 Switching Protocols로 업그레이드되어 Yjs 기반 실시간 협업 동작
actual: WebSocket 핸드셰이크가 200 OK를 반환하여 연결 실패
errors: WebSocket connection to 'ws://localhost:9503/ws/diagram/535?ticket=4c967b75-d5f5-417e-8b11-696705636037' failed: Error during WebSocket handshake: Unexpected response code: 200
reproduction: 1) 로그인 2) 마크다운 문서 진입 3) 브라우저 콘솔에서 WebSocket 에러 확인
started: QA 테스트 중 발견

## Eliminated

- hypothesis: Spring Security가 /ws/** 경로를 차단
  evidence: SecurityConfig에서 endpointSupport.websocketSecurityPattern()으로 /ws/diagram/** permitAll 설정 확인
  timestamp: 2026-04-02

- hypothesis: WebSocket 핸들러 미등록
  evidence: WebSocketConfig + DiagramCollaborationWebSocketBinding(@Component)으로 /ws/diagram/* 핸들러 정상 등록 확인
  timestamp: 2026-04-02

- hypothesis: 서버 측 WebSocket 설정 자체의 문제
  evidence: curl로 유효한 티켓 사용 시 101 Switching Protocols 정상 반환 확인
  timestamp: 2026-04-02

- hypothesis: CORS 설정 문제
  evidence: allowed-origins에 localhost 포트들 모두 포함, curl에서 Access-Control-Allow-Origin 정상 반환
  timestamp: 2026-04-02

- hypothesis: 마크다운 전용 WebSocket 경로 문제
  evidence: ERD와 마크다운 모두 동일한 /ws/diagram/{id} 경로 사용
  timestamp: 2026-04-02

## Evidence

- timestamp: 2026-04-02
  checked: curl로 가짜 티켓으로 WebSocket 핸드셰이크 시도
  found: HTTP 200 OK, Content-Length: 0 반환 (빈 body)
  implication: Spring WebSocketHttpRequestHandler가 beforeHandshake()=false일 때 기본 200 반환 (Spring 알려진 동작)

- timestamp: 2026-04-02
  checked: curl로 유효한 티켓(b7201104)으로 WebSocket 핸드셰이크 시도
  found: HTTP 101 Switching Protocols 정상 반환
  implication: 서버 측 WebSocket 로직은 정상. 문제는 티켓이 무효화되는 타이밍

- timestamp: 2026-04-02
  checked: InMemoryWsTicketStore.issueTicketAtomically 코드 분석
  found: 새 티켓 발급 시 removeByLoginIdAndDiagramId로 기존 티켓 삭제
  implication: 동일 사용자가 짧은 시간 내 두 번 티켓 발급하면 첫 번째 티켓 무효화

- timestamp: 2026-04-02
  checked: React StrictMode 설정 확인 (main.tsx)
  found: StrictMode 활성화 — 개발 모드에서 useEffect 이중 실행
  implication: useEffect 이중 실행 시 getTicket() 두 번 호출 가능, 단 첫 번째 provider는 destroyed 체크로 WS 연결 미시도

- timestamp: 2026-04-02
  checked: use-markdown-document-session.ts의 useEffect 의존성 배열
  found: [diagramId, projectId, readSerializedBuffer, sharedDocumentEngine, snapshotCodec, teamId, setupAttempt] — readSerializedBuffer가 useCallback으로 안정화되어 있지만 sharedDocumentEngine 변경 시 재생성
  implication: bootstrap 데이터 변경 시 provider 재생성 가능

- timestamp: 2026-04-02
  checked: Spring Framework GitHub issue #23179
  found: WebSocketHttpRequestHandler가 beforeHandshake false 반환 시 response.close()를 호출하지 않아 헤더가 기록되지 않는 알려진 문제
  implication: 200 OK는 Spring 프레임워크 수준의 동작. 인터셉터에서 명시적으로 HTTP 상태 코드를 설정해야 함

## Resolution

root_cause: WsTicketHandshakeInterceptor.beforeHandshake()가 검증 실패 시 false만 반환하고 HTTP 응답 상태를 설정하지 않음. Spring WebSocketHttpRequestHandler의 기본 동작으로 200 OK가 반환됨. 이로 인해 브라우저가 "Unexpected response code: 200" 에러를 표시. 근본 원인은 (1) 인터셉터에서 실패 시 적절한 HTTP 상태 미설정 + (2) 동시 티켓 발급 시 기존 티켓 삭제 race condition 가능성 + (3) 실패 원인 추적을 위한 로깅 부족.
fix: |
  1. WsTicketHandshakeInterceptor: beforeHandshake() 검증 실패 시 response.setStatusCode(HttpStatus.FORBIDDEN) 호출하여 200 대신 403 반환
  2. WsTicketHandshakeInterceptor: 실패 로그에 path, ticketPrefix 등 디버그 정보 추가
  3. InMemoryWsTicketStore: removeByLoginIdAndDiagramId에서 삭제 발생 시 디버그 로그 추가
  4. WsTicketService: validateAndConsume 실패 시 디버그 로그 추가
  5. ValidateCollaborationTicketUseCase: 각 실패 지점에 구체적 로그 추가 (ticket expired, access policy, resource key mismatch)
verification: 2026-05-29 targeted backend regression and invalid-ticket handshake smoke passed.
files_changed:
  - src/main/java/com/smarterd/domain/diagram/websocket/transport/WsTicketHandshakeInterceptor.java
  - src/main/java/com/smarterd/domain/diagram/websocket/ticket/InMemoryWsTicketStore.java
  - src/main/java/com/smarterd/domain/diagram/websocket/ticket/WsTicketService.java
  - src/main/java/com/smarterd/application/collaboration/command/ValidateCollaborationTicketUseCase.java
  - src/test/java/com/smarterd/domain/diagram/websocket/transport/WsTicketHandshakeInterceptorTest.java

## RESOLVED

Verified: 2026-05-29

- `WsTicketHandshakeInterceptor.rejectHandshake()` sets `HttpStatus.FORBIDDEN`.
- `WsTicketHandshakeInterceptorTest.beforeHandshake_rejectsWhenTicketValidationFails()` now asserts `response.setStatusCode(HttpStatus.FORBIDDEN)`.
- `./gradlew test --tests com.smarterd.domain.diagram.websocket.transport.WsTicketHandshakeInterceptorTest --tests com.smarterd.application.diagram.command.ValidateDiagramCollaborationHandshakeUseCaseTest --tests com.smarterd.domain.diagram.websocket.ticket.InMemoryWsTicketStoreTest` -> PASS.
- `curl -i -s -N -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Version: 13' 'http://localhost:9503/ws/diagram/535?ticket=invalid-ticket'` -> `HTTP/1.1 403`.
