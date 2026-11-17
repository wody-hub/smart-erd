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

## 최소 편집 프로토콜 게이트 (S5)

`smart-erd.collaboration.min-edit-protocol-version` 기본값은 **1**이다.
환경 변수 `SMART_ERD_COLLABORATION_MIN_EDIT_PROTOCOL_VERSION=3` 또는 같은 이름의
Spring 설정으로 변경하고 서버 인스턴스를 모두 재시작한다. 실시간 설정 갱신은 지원하지 않는다.

배포 순서:

1. 서버를 **min=1**로 배포한다. 기존 클라이언트 및 헤더 없는 요청은 계속 허용한다.
2. REST `X-Smart-Erd-Client-Protocol: 3`, WS `protocolVersion=3`을 보내고 정책 거부를
   처리하는 새 클라이언트를 배포한다. `presenceProtocolVersion`은 별도 presence 기능 버전이다.
3. 구버전 사용 현황을 확인한 뒤 모든 서버의 **min=3**으로 올린다. 이후에만 신형 컬럼 구조
   쓰기를 비-internal 다이어그램에 허용한다. 일부 서버만 min=3인 혼합 설정은 피한다.

차단 대상은 문서 생성 POST, content PUT, 이름/사전 세트 PATCH, 문서 DELETE,
Y.Doc snapshot POST(keepalive 포함), 편집 ticket POST이다. 문서를 함께 삭제하는 프로젝트/팀
DELETE와 문서의 사전 참조를 변경하는 사전 세트 DELETE에도 같은 게이트를 적용한다.
WS는 ticket 발급 요청의 유효 REST 편집 버전과 협상된 WS 버전을 각각 **접속 시점의 최소 버전**과
비교한다. 하나라도 낮으면 방 입장·relay 전에 `1008 / protocol-too-old`로 종료한다.
발급 당시 REST 버전은 `TicketData.editProtocolVersion`으로 in-memory/Redis에 함께 저장한다.
예를 들어 min=1에서 발급된 REST v1 ticket은 정책이 min=3으로 바뀐 후 WS v3으로 접속해도 거부한다.
이 필드가 없는 구버전 Redis JSON은 v1로 해석하며, 거부한 ticket도 이미 소비되어 재사용할 수 없다.
compaction은 WS 메시지이므로 같은 세션 게이트가 보호한다. GET 미리보기는 계속 허용한다.
누락·잘못된 REST 헤더는 v1, 미지원 WS 버전은 기존 협상 규칙에 따라 v1이다.

서버의 프로토콜 거부 응답은 HTTP 426과 다음 JSON을 반환한다. `error`는 로케일에 따라 달라지며,
`code`는 항상 `protocol-too-old`, `minEditProtocolVersion`은 거부 시점의 설정값이다.

```json
{
  "error": "App update required. Reload the page to continue editing.",
  "code": "protocol-too-old",
  "minEditProtocolVersion": 3
}
```

새 클라이언트는 **HTTP 426이면서 JSON 본문의 `code`가 `protocol-too-old`인 응답** 또는
해당 WS close 사유를 받으면 새로고침까지 편집·저장·재연결을
멈추며 업데이트 안내와 새로고침 동작을 제공한다. 이미 전송된 요청을 취소하거나 자동 재전송하지
않는다. 이 판별은 Axios, ticket 오류, fetch keepalive 응답에 공통으로 적용한다.
본문 없는 426, HTML/프록시 426, 다른 오류 코드의 426은 탭을 잠그지 않는다.
배포 전 구버전 앱은 기존 일반 오류/연결 실패 안내를 보며 자체 재시도를 할 수 있지만,
서버가 쓰기를 계속 거부한다. 구버전 앱에도 새 안내가 소급 적용되지는 않는다.

롤백: 모든 서버에서 min을 **1**로 되돌리고 재시작한다. 차단된 새 앱 탭은 새로고침해야 한다.
**이미 신형 컬럼 구조가 저장된 문서의 데이터 호환성은 설정 롤백으로 복구되지 않는다.**
그 경우 구버전 쓰기를 다시 열기 전에 호환 가능한 클라이언트 또는 별도 데이터 복구를 준비한다.

| 클라이언트                    | min=1               | min=3                                                  |
| ----------------------------- | ------------------- | ------------------------------------------------------ |
| 구버전(v1/v2, REST 헤더 없음) | 기존 편집/저장 허용 | ticket/REST 쓰기 426, 낮은 WS 버전 정책 종료, GET 허용 |
| 신버전(v3)                    | 편집/저장 허용      | 편집/저장 허용                                         |

## 컨트롤러 감사 범위

총 32개 `api/**/**Controller.java`의 의존 서비스와 다이어그램 repository/entity 변경 호출을 대조했다.
문서 상태를 변경하는 경로는 아래와 같다. GET/HEAD/OPTIONS는 게이트에서 제외한다.

| 컨트롤러                                                                                                                                                                              | 확인한 경로와 처리                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| DiagramController                                                                                                                                                                     | 문서 생성 POST 보호. 목록/상세/bootstrap GET은 읽기 전용                      |
| DiagramMutationController                                                                                                                                                             | 이름 PATCH, dictionary-set PATCH, 문서 DELETE 모두 보호                       |
| DiagramContentController                                                                                                                                                              | content PUT, ydoc-snapshot POST 보호 유지                                     |
| WsTicketController                                                                                                                                                                    | POST 보호 유지. REST 헤더의 유효 버전을 ticket 발급 체인으로 전달             |
| ProjectController / TeamController                                                                                                                                                    | 프로젝트/팀 DELETE의 다이어그램 연쇄 삭제 보호                                |
| DictionarySetController                                                                                                                                                               | 세트 DELETE의 다이어그램 사전 참조 제거 보호                                  |
| DiagramExportController                                                                                                                                                               | table/column/index-definition 및 exports POST는 조회/파일 생성만 수행         |
| WbsDocumentController / ProjectTodoController                                                                                                                                         | 문서 연결/해제는 별도 링크만 변경. 문서 content/snapshot/room을 쓰지 않음     |
| AiActionProposalController                                                                                                                                                            | 현재 실행기는 이슈/TODO 생성·수정, WBS 메모/댓글만 지원. 다이어그램 쓰기 없음 |
| 그 외 auth/settings, team-member, dictionary CRUD/bulk/suggest, project issue/milestone/staffing, WBS CRUD/planning/dependency/history/todo 및 AI 조회/채팅/provider/history 컨트롤러 | 다이어그램 문서 상태 쓰기 없음                                                |

기동 시 `DictionarySetMigrationService`의 레거시 사전 참조 백필과 WS snapshot/compaction
영속화는 REST 컨트롤러가 아니다. 전자는 서버 작업이며, 후자는 입장 전 WS 게이트로 보호한다.
