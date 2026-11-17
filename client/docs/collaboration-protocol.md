# 협업 WebSocket 프로토콜 v3

클라이언트는 연결 URL의 `protocolVersion=3`으로 빈 문서 초기화 확인 지원을 알린다.
서버는 1, 2, 3을 허용하며 미지원 값이나 누락된 값은 기존처럼 1로 처리한다.
스냅샷 요청/응답의 v1·v2 포맷은 이 handshake 버전과 독립적이다.

- `0x0F EMPTY_DOCUMENT_INITIALIZED`: 서버 → 요청 세션 전용, payload 없음.
- v1(`0x05`) 또는 v2(`0x0D`) 스냅샷 요청의 handoff snapshot이 0바이트이고,
  sync에 응답할 열린 peer와 미반영 room update가 없을 때 v3 세션에만 보낸다.
- 이 응답은 현재 연결의 빈 문서 초기화 확인이며 실제 Yjs sync나 영속 저장 ACK가 아니다.
  문서 내용을 시딩하거나 원격 수화 세대를 증가시키지 않는다.
- 클라이언트는 bootstrap에도 snapshot/content가 없는 문서에서만 이 확인으로 편집을 연다.
  snapshot이 있거나 content preview가 있는 문서는 실제 sync/스냅샷 적용을 기다린다.
- 매 재연결은 새 초기화가 필요하다. 이전 소켓의 지연 응답은 무시한다.
  응답 없는 시간이나 sync 재시도 횟수로 빈 방을 추정하지 않는다.

호환성: 구 클라이언트(v1/v2) + 신 서버는 기존 동작을 유지한다. 서버 dispatcher와
기존 클라이언트의 타입 분기는 알 수 없는 타입을 update로 적용하지 않고 무시한다.
신 클라이언트 + 구 서버에서는 빈 문서 편집이 서버 업그레이드 전까지 차단된다.
