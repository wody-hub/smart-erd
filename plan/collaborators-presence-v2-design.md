# Smart ERD 접속자 UI v2.3 설계서 (Slack 스타일)

## Context

현재 상단 협업자 목록은 `Awareness(clientId -> state)`만으로 구성되어 있다.
커서 동기화에는 적합하지만, 접속자 목록(presence) 용도로는 불안정하다.

아키텍처/디자인 리뷰에서 확인된 주요 보완점:

1. `loginId` 식별키 의존을 불변 키(`userId`)로 전환 필요
2. snapshot/join/left 이벤트의 순서 역전 및 중복 수신 내성 필요
3. self 제외 정책과 헤더 숫자 표기 규칙 명확화 필요
4. 구버전 공존 시나리오(서버/클라 조합) 명시 필요
5. 개인정보 최소화(이메일형 loginId 노출 회피) 필요
6. 서버 재시작/룸 재생성 시 version reset 내성 필요
7. 멀티 인스턴스 배포 시 presence 정합성 전략 필요

---

## 목표

1. 헤더에 접속자 아바타 최대 3명 표시
2. Slack 스타일로 총 접속자 수 배지(`N`) 표시
3. 클릭 시 팝업에서 현재 접속자 전체 목록 표시
4. 동일 사용자의 다중 탭은 1명으로 집계
5. 재연결/지연/중복 이벤트 상황에서도 목록 정합성 유지

## 비목표

1. 팀 멤버 초대/권한 변경 UI
2. Slack과 동일한 프로필 상세/DM
3. 커서(Awareness) 렌더링 로직 전면 교체

---

## 핵심 설계 원칙

1. Presence와 Awareness를 분리한다.
2. Presence는 서버 authoritative 상태를 기준으로 한다.
3. 식별키는 `userId`(불변)로 통일한다.
4. 이벤트는 version 기반으로 idempotent 처리한다.
5. fallback은 신뢰 가능한 서버 신원 정보가 있을 때만 사용한다.

---

## 아키텍처 개요

### 기존

- Presence UI 데이터 소스: `remoteCursors(Map<clientId, AwarenessState>)`
- 문제: cursor 이벤트 의존, 중복/누락 가능

### 변경(v2.3)

- Presence UI 데이터 소스: `participantsByUserId(Map<string, ParticipantPresence>)`
- 갱신 소스: 서버 메시지(`PRESENCE_SNAPSHOT`, `PEER_JOINED`, `PEER_LEFT`)
- Awareness는 커서 렌더링 전용으로 유지

---

## 데이터 모델

```typescript
type ParticipantPresence = {
  userId: string;       // 불변 식별키 (UUID or DB PK string)
  displayName: string;  // 노출 이름
  joinSeq: number;      // 방 내 입장 순서 (서버 발급)
};
```

클라이언트 상태:

1. `remoteCursors: Map<number, AwarenessState>` (기존 유지)
2. `participantsByUserId: Map<string, ParticipantPresence>` (신규)
3. `lastPresenceVersion: number` (신규)
4. `lastRoomEpoch: string` (신규)

---

## 프로토콜 설계

기존 코드(0x01 ~ 0x08)는 유지하고, presence 메시지를 확장한다.

### 메시지 타입

| 타입 | 코드 | 방향 | 설명 |
|------|------|------|------|
| `PRESENCE_SNAPSHOT` | `0x09` | Server -> Client | 입장 직후 현재 접속자 전체 스냅샷 |
| `PEER_JOINED` | `0x0A` | Server -> Client | 신규 사용자 입장(0->1) |
| `PEER_LEFT` | `0x0B` | Server -> Client | 사용자 완전 퇴장(1->0) |
| `PRESENCE_SNAPSHOT_REQUEST` | `0x0C` | Client -> Server | snapshot 재요청(gap/복구용) |

### 공통 필드

모든 presence 메시지에 아래 필드를 포함한다:

1. `presenceVersion: number` - room 단위 단조 증가 버전
2. `diagramId: string` - 대상 방 식별
3. `roomEpoch: string` - 방 세대 식별자(서버 프로세스 재시작/방 재생성 시 변경)

### 페이로드 스키마

```json
// 0x09 PRESENCE_SNAPSHOT
{
  "diagramId": "123",
  "roomEpoch": "e-20260212-001",
  "presenceVersion": 41,
  "participants": [
    { "userId": "u-1001", "displayName": "홍길동", "joinSeq": 5 },
    { "userId": "u-1002", "displayName": "김철수", "joinSeq": 9 }
  ],
  "totalIncludingSelf": 2
}
```

```json
// 0x0A PEER_JOINED
{
  "diagramId": "123",
  "roomEpoch": "e-20260212-001",
  "presenceVersion": 42,
  "participant": { "userId": "u-1003", "displayName": "이영희", "joinSeq": 11 }
}
```

```json
// 0x0B PEER_LEFT
{
  "diagramId": "123",
  "roomEpoch": "e-20260212-001",
  "presenceVersion": 43,
  "userId": "u-1002"
}
```

### 클라이언트 적용 규칙 (중요)

1. `roomEpoch`가 현재와 다를 때:
   - `PRESENCE_SNAPSHOT`만 수용하고 상태를 재초기화한다.
   - `PEER_JOINED`/`PEER_LEFT` 이벤트는 무시한다.
2. 동일 `roomEpoch`에서 `presenceVersion <= lastPresenceVersion` 이면 무시한다.
3. 동일 `roomEpoch`에서 `incomingPresenceVersion > lastPresenceVersion + 1`이면 gap으로 판단하고
   `PRESENCE_SNAPSHOT_REQUEST(0x0C)`를 전송한 뒤, 해당 이벤트는 적용하지 않는다.
4. `PRESENCE_SNAPSHOT` 수신 시 participants를 전량 교체한다.
5. `PEER_JOINED`는 upsert(idempotent) 처리한다.
6. `PEER_LEFT`는 존재할 때만 제거한다(idempotent).

`roomEpoch` 비교 규칙:

- UUID/ULID 문자열 동등성 비교만 수행(크기 비교 금지)
- 세대 변경 판단은 "현재와 다른 값이면 다른 세대"로 처리

---

## 서버 설계

대상 파일:

- `src/main/java/com/smarterd/domain/diagram/websocket/DiagramRoomManager.java`
- `src/main/java/com/smarterd/domain/diagram/websocket/DiagramWebSocketHandler.java`
- `src/main/java/com/smarterd/domain/diagram/websocket/WsTicketService.java`
- `src/main/java/com/smarterd/domain/diagram/websocket/WebSocketSessionInfo.java`
- `src/main/java/com/smarterd/domain/diagram/websocket/WsTicketHandshakeInterceptor.java`

### 1) Room 상태 확장

`diagramId` 단위로 관리:

1. `userId -> count`
2. `presenceVersion` (long)
3. `joinSeqGenerator` (long)
4. `userId -> joinSeq` (현재 접속 사용자용)
5. `roomEpoch` (String, 방 생성 시 1회 발급)

### 1-1) `userId` 주입 경로 (E2E)

`userId`를 핸들러까지 전달하기 위한 변경 범위를 명시한다:

1. `WsTicketService`:
   - 티켓 발급 시 인증 사용자의 `userId`를 조회해 `WebSocketSessionInfo`에 포함
2. `WebSocketSessionInfo`:
   - 필드 확장: `userId`, `loginId`, `userName`, `diagramId`, `sessionExpiresAt`
3. `WsTicketHandshakeInterceptor`:
   - 검증된 ticket payload에서 `userId`를 세션 attributes에 저장
4. `DiagramWebSocketHandler`/`DiagramRoomManager`:
   - 기존 `loginId` 기반 presence 카운트를 `userId` 기반으로 전환

### 2) join 처리

1. `join()`에서 `userId` count 증가
2. count `0 -> 1`이면:
   - `presenceVersion++`
   - `joinSeq` 발급
   - 다른 세션에 `PEER_JOINED(0x0A)` 발행
3. join 성공 세션에 항상 `PRESENCE_SNAPSHOT(0x09)` 발행
4. snapshot/event payload에 동일 `roomEpoch`를 포함
5. `PRESENCE_SNAPSHOT_REQUEST(0x0C)` 수신 시 요청 세션에 최신 snapshot을 재전송

### 3) leave 처리

1. `leave()`에서 `userId` count 감소
2. count `1 -> 0`이면:
   - `presenceVersion++`
   - `PEER_LEFT(0x0B)` 발행
3. count `> 0`이면 이벤트 미발행 (다중 탭 보호)

### 4) 락/원자성

`sessions` 락 안에서 다음을 원자 처리:

1. 세션 add/remove
2. user count 증감
3. version 증가 및 이벤트 판정 플래그 계산

메시지 직렬화/전송은 락 밖에서 수행한다.

### 5) 서버 재시작/룸 재생성 규칙

1. 서버 프로세스 재시작 또는 `discardRoom()` 후 재생성 시 `roomEpoch`를 새로 발급한다.
2. `presenceVersion`은 각 `roomEpoch` 범위에서만 단조 증가를 보장한다.

---

## 프론트엔드 설계

대상 파일:

- `client/src/constants/ws.ts`
- `client/src/collaboration/YjsProvider.ts`
- `client/src/stores/useCollaborationStore.ts`
- `client/src/hooks/useYjsCollaboration.ts`
- `client/src/components/layout/CollaboratorsBar.tsx`
- `client/src/components/layout/CollaboratorsPopover.tsx` (신규)

### 1) 스토어 액션

1. `applyPresenceSnapshot(payload)`
2. `applyPeerJoined(payload)`
3. `applyPeerLeft(payload)`
4. `reset()`

각 액션은 공통적으로 `presenceVersion` gate를 먼저 통과해야 한다.

bootstrap/fallback 규칙:

1. 연결 후 `PRESENCE_BOOTSTRAP_TIMEOUT_MS`(권장 3000ms) 내 snapshot 미수신 시 `presenceMode=degraded`
2. degraded 상태에서는 접속자 목록 UI 비활성(커서만 동작)
3. degraded 상태에서도 이후 snapshot 수신 시 `presenceMode=active`로 승격
4. 서버 capability가 `presenceProtocolVersion >= 1`일 때만 `PRESENCE_SNAPSHOT_REQUEST(0x0C)`를 전송한다.

### 2) UI 집계/정렬

1. 정렬 기준: `joinSeq ASC`, tie-breaker `displayName ASC`
2. 헤더: 최대 3명 아바타 + 총 접속자 배지(`N`)
3. 팝업: 전체 목록

### 3) 숫자 정책 (고정)

숫자 혼선을 막기 위해 규칙을 고정한다:

1. 내부 기준 카운트: `totalIncludingSelf`
2. 헤더/팝업 기본 노출: `excludingSelf`
3. 표기 텍스트:
   - 헤더 배지: `N` (`N = excludingSelf`)
   - 팝업 타이틀: `접속자 {excludingSelf}명`
4. 아바타는 최대 3개만 노출, 총원은 배지 숫자로 항상 표시

---

## 개인정보/보안 정책

1. Presence payload에 `loginId`를 포함하지 않는다.
2. `displayName`만 노출하고 민감 속성(이메일, 전화번호 등) 비포함.
3. 서버는 해당 방 접근 권한 검증 후에만 presence 메시지를 전송한다.
4. fallback 모드에서도 서버가 검증한 `userId/displayName` 이외 사용자 식별값은 사용하지 않는다.

---

## 호환성/배포 토폴로지/롤아웃

### 배포 토폴로지 가정

1. v2.3 1차 릴리즈: 단일 인스턴스 또는 WebSocket Sticky Session 전제
2. 멀티 인스턴스 확장 시:
   - Redis Pub/Sub(또는 동등 버스)로 presence event fan-out
   - room 상태를 노드 로컬이 아닌 공유 스토어/채널로 동기화
3. 위 2번 적용 전에는 non-sticky 다중 인스턴스를 공식 비지원으로 명시

### 호환 매트릭스

| 서버 | 클라이언트 | 결과 |
|------|------------|------|
| 구버전 | 구버전 | 기존 동작 |
| 신버전 | 구버전 | 기존 동작 + 신규 메시지 무시 |
| 구버전 | 신버전 | bootstrap timeout 후 presence 비활성(degraded), 커서만 동작 |
| 신버전 | 신버전 | 목표 동작(v2.3) |

degraded 진입 조건:

1. 연결 후 timeout 내 `PRESENCE_SNAPSHOT` 미수신
2. 또는 서버 capability에서 presence 미지원 표시(선택)

capability 전달 권장:

1. `requestWsTicket` 응답에 `presenceProtocolVersion` 필드를 포함한다.
2. 클라이언트는 `presenceProtocolVersion < 1`이면 즉시 degraded로 시작한다.

### 단계

1. 1단계: 서버 메시지 `0x09~0x0C` 추가
2. 2단계: 클라이언트 version-gated participant store 적용
3. 3단계: 모니터링 후 fallback 경로 정리
4. 4단계(선택): Redis 기반 멀티 인스턴스 presence 동기화

---

## 실패/복구 전략

1. 재연결 시 snapshot 재수신으로 강제 재정합
2. 이벤트 역전/중복은 `roomEpoch + presenceVersion`으로 차단
3. version gap 감지 시 `PRESENCE_SNAPSHOT_REQUEST(0x0C)`로 즉시 복구
4. 일정 시간 이벤트 공백 시 주기적 snapshot 재요청(선택사항)
5. snapshot request는 클라이언트/서버 모두 rate limit을 둔다 (예: 최대 분당 6회)

---

## 테스트 전략

### 1) 백엔드 단위 테스트

1. 동일 `userId` 2세션 join -> distinct participant 1명
2. count `> 0` leave -> `PEER_LEFT` 미발행
3. count `== 0` leave -> `PEER_LEFT` 발행
4. join/leave 시 `presenceVersion` 단조 증가 검증
5. snapshot participants가 room 상태와 일치 검증
6. room 재생성 시 `roomEpoch` 갱신 검증
7. `PRESENCE_SNAPSHOT_REQUEST(0x0C)` 처리 검증

### 2) 프론트엔드 단위 테스트

1. snapshot 수신 시 목록 치환 + version 갱신
2. 낮은 version joined/left 메시지 무시
3. joined 중복 수신 idempotent
4. left 중복 수신 idempotent
5. 새 roomEpoch 수신 시 상태 재초기화 검증
6. version gap 감지 시 snapshot request 발행 검증
7. bootstrap timeout 시 degraded 전환/복구 검증
8. 헤더 렌더링: 1~3명 아바타 + 총원 배지 `N`

### 3) 장애/경계 시나리오 E2E

1. snapshot 지연 + joined 선도착 -> 최종 목록 정합
2. 네트워크 재연결 후 stale 이벤트 수신 -> 무시
3. 동일 사용자 멀티탭 일부 종료 -> 목록 유지
4. 마지막 탭 종료 -> 목록 제거
5. 팝업 수와 헤더 규칙 일치
6. 서버 재시작 후(새 roomEpoch) 재입장 시 목록 정합

---

## 결정 필요 사항

1. `userId` wire 포맷(UUID 문자열 vs 숫자 문자열) 확정
2. fallback 모드 유지 기간(배포 후 n주) 확정
3. 모바일에서 popover 즉시 dialog 전환 여부 확정
4. 멀티 인스턴스 운영 시점(Sticky only -> Redis 동기화 전환 시점) 확정
