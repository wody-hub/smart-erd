# Code-ERD 자동 양방향 동기화 + 테이블 소프트 락 설계안 (Rev. 1.4)

## 1. 목표

- 코드 편집이 멈추고(Idle) 문법 오류가 없으면 자동으로 ERD에 반영한다.
- ERD를 수정하면 자동으로 코드(SQL/DSL)를 갱신한다.
- 협업 중 특정 테이블 편집 진입 시 소프트 락을 걸어 동시 수정 충돌을 줄인다.
- 코드 에디터(SQL/DSL)에서 특정 테이블을 편집 중일 때도 동일한 소프트 락 모델을 적용한다.

## 2. 범위 / 비범위

### 범위

- 프론트엔드 기준 자동 동기화 오케스트레이션
- 협업 Awareness 기반 테이블 소프트 락
- 충돌 방지(루프 방지), 디바운스/아이들 정책, 상태 표시 UX

### 비범위

- 서버 강제 락(하드 락, Redis TTL, 서버 거부 응답)
- 완전 자동 머지 엔진(의미 기반 3-way merge)
- 백엔드 프로토콜 변경(이번 단계는 클라이언트 협조형)

## 3. 현재 구조 요약

- 코드 → ERD: `Apply` 버튼으로 `replaceFromDdl` 수동 반영
- ERD → 코드: `Refresh` 버튼으로 수동 생성
- 협업: Awareness에 `selectedNodeId` 필드는 있으나 실제 편집 락 용도로 미사용
- 편집 모드: `activeEditNodeId` 로컬 상태만 존재 (원격 사용자와 충돌 제어 없음)
- 코드 에디터: 현재 커서/편집 테이블 식별 정보가 Awareness에 발행되지 않음

## 4. 핵심 설계 원칙

- ERD(Y.Doc)가 협업 상태의 최종 SSOT이다.
- 코드 에디터는 입력/파싱/자동반영을 위한 작업 버퍼다.
- 자동 동기화는 항상 `origin`(이벤트 출처)을 기록하여 역방향 재트리거를 차단한다.
- 소프트 락은 UX 충돌 완화 장치이며, 보안/무결성 강제 수단은 아님을 명시한다.
- `replaceFromDdl`이 전체 테이블/엣지를 교체하므로, 코드 자동반영은 **테이블 단위가 아니라 다이어그램 쓰기 게이트**를 거친다.

## 4.1 용어 정의

- `tableLock`: 테이블 인라인 편집 진입을 제어하는 소프트 락
- `diagramWriteGate`: 코드->ERD 전체 반영(`replaceFromDdl`) 실행 전 점검하는 전역 쓰기 게이트
- `origin`: 변경 이벤트 출처 (`user-code`, `code-auto-sync`, `erd-auto-sync`)
- `baseRevisionHash`: 자동 반영 시작 시점의 ERD 해시 스냅샷(스테일 적용 차단용)
- `lockKeySnapshot`: 편집 시작 시점에 고정한 테이블 락 키(편집 중 이름 변경과 분리)

## 4.2 상수 관리 정책

- 시간/owner/origin 문자열은 인라인 리터럴로 사용하지 않고 상수로 관리한다.
- 권장 위치:
  - `client/src/constants/collab-lock.ts` (`LOCK_HEARTBEAT_MS`, `LOCK_TTL_MS`, `LOCK_SETTLE_MS`)
  - `client/src/constants/code-sync.ts` (`CODE_IDLE_MS`, `ERD_IDLE_MS`, `MAX_QUEUE_WAIT_MS`, `CODE_LOCK_GRACE_MS`)
  - `client/src/constants/sync-origin.ts` (`SYNC_ORIGIN`)

## 5. 자동 양방향 동기화 설계

### 5.1 공통 동기화 엔진

- 신규 훅: `useBidirectionalCodeSync` (가칭)
- 책임:
  - 코드 변경 감지
  - 파싱 성공/실패 상태 감시
  - 아이들 타이머 관리
  - 코드→ERD / ERD→코드 트리거
  - 루프 방지 토큰 처리

### 5.2 코드 -> ERD 자동 반영

발동 조건:

- 사용자가 코드 입력을 멈춤
- 파싱 완료(`parsing=false`)
- 오류 진단 없음(`error` severity 0)
- 테이블 파싱 결과 존재
- `diagramWriteGate` 통과 (원격 tableLock 없음, 전역 보류 상태 아님)
- `baseRevisionHash` 검증 통과 (파싱 시작 시점과 적용 직전 해시가 정확히 동일)

추천 타이머:

- `CODE_IDLE_MS = 1200` (기본)
- 참고: 현재 파서 디바운스(DDL 500ms, DSL 300ms) 포함 체감 반영 시간은 약 1.5~1.7초

반영 방식:

- `replaceFromDdl(parseResult)` 호출
- 반영 origin: `code-auto-sync`
- 반영 직후 자동 배치(옵션): 기존 `applyDagreLayout` 유지
- 반영 성공 시 비차단 토스트/상태 뱃지 갱신

보류 정책:

- 원격 사용자가 tableLock을 보유하면 자동 반영 큐에 최신 1건만 보관(debounce queue)
- 락 해제 후 `LOCK_SETTLE_MS = 400` 경과 시 반영 재시도
- `MAX_QUEUE_WAIT_MS = 10000` 초과 시 자동 반영 취소 + 사용자에게 수동 Apply 유도

정합성 가드:

- 파싱 시작 시 `baseRevisionHash` 저장
- 적용 직전 현재 ERD 해시와 비교
- 해시가 달라 스테일로 판정되면 해당 자동 반영은 폐기(drop)하고 재파싱 사이클로 복귀
- `baseRevisionHash`는 `nodes/edges/groupNodes`를 정렬 직렬화 후 해시한 값으로 정의한다.

### 5.3 ERD -> 코드 자동 반영

발동 조건:

- `nodes/edges` 변경 감지(Y.Doc 동기화 포함)
- 최근 코드 직접 타이핑 중이 아님

추천 타이머:

- `ERD_IDLE_MS = 600`

반영 방식:

- 현재 모드가 `sql`이면 `generateDdl(nodes, edges, dbms)`
- 현재 모드가 `dsl`이면 `generateDsl(nodes, edges, dictionary)`
- 반영 origin: `erd-auto-sync`
- 에디터 텍스트 세터는 origin-aware API로 분리해 역방향 트리거를 차단

### 5.4 루프 방지(필수)

- `lastSyncOriginRef: 'user-code' | 'code-auto-sync' | 'erd-auto-sync' | null`
- `suppressNextRef` 플래그로 프로그램적 텍스트 반영 시 입력 핸들러 재해석 차단
- 동일 내용 비교(short-circuit):
  - 코드 문자열 해시 동일 시 무시
  - ERD 스냅샷 해시 동일 시 무시

### 5.5 자동 반영 동시성 규칙(결정적)

- 복수 사용자가 동시에 코드 자동 반영을 시도할 수 있으므로, 클라이언트 간 결정적 우선순위를 둔다.
- 우선순위 키: `(userId, clientId)` 오름차순
- 같은 시점 충돌 시 우선순위가 낮은 클라이언트는 자동 반영을 취소하고 대기 상태로 전환한다.
- 로컬 시간(`Date.now`) 기반 우선순위는 사용하지 않는다.

### 5.6 실패 처리 / 사용자 제어

- 자동 반영 실패(파싱 예외, 게이트 실패, 스테일 drop)는 상태 뱃지와 토스트로 노출한다.
- `MAX_QUEUE_WAIT_MS` 초과 시 자동 반영 큐를 비우고, 사용자가 명시적으로 `Apply`를 누를 때만 반영한다.
- 사용자가 `Apply`를 수동 실행하면 현재 화면 상태를 최종 의사결정으로 간주하고 자동 보류 큐는 폐기한다.

리소스 정리 규칙:

- 동기화 훅 내부의 `setTimeout`/`setInterval`은 언마운트 시 반드시 clear 한다.
- Awareness heartbeat 타이머는 편집 종료/연결 종료 시 즉시 중단한다.
- 자동 반영 큐 상태(ref/state)는 다이어그램 전환 시 초기화한다.

## 6. 테이블 소프트 락 설계

### 6.1 Awareness 모델 확장

- `AwarenessState`에 편집 락 필드 추가
  - `editingNodeId: string | null` (뷰 렌더링/하이라이트용)
  - `editingTableKey: string | null` (락 식별용 안정 키)
  - `editingSource: 'erd' | 'code' | null` (락 발생 원천 추적용)
  - `editingClientId: number | null` (결정적 tie-break 용)
  - `lockHeartbeatAt: number | null` (stale lock 정리용)

주의:

- 기존 `selectedNodeId`는 커서 선택 의미로 유지하고, 락은 별도 필드로 분리한다.
- `editingNodeId` 단독으로 락을 식별하지 않는다. (`replaceFromDdl` 시 nodeId 재생성 이슈 방지)

`editingTableKey` 규칙:

- 결정 규칙: 테이블 식별 입력값을 정규화 후 해시한 deterministic 키를 사용한다.
  - 입력값: `logicalName|physicalName|sortedColumns(name:type:pk:fk)`
  - 컬럼 순서 변경은 동일 테이블로 간주해야 하므로 정렬 후 직렬화한다.
  - 해시: 고정 알고리즘(djb2 또는 동급)으로 문자열 생성
- 동일 스키마 테이블이 완전히 중복되는 극단 케이스는 `nodeId`를 보조값으로 붙이되, 이는 표시 전용이며 락 우선순위 판단에는 사용하지 않는다.
- 편집 진입 시 계산한 `lockKeySnapshot`을 해제 전까지 유지한다. (편집 중 rename되어도 키를 재계산하지 않음)

### 6.2 락 획득/해제 규칙

- 획득: 테이블 클릭으로 편집 진입 시
  - 원격 tableLock 없음 -> `activeEditNodeId` 설정 + awareness 발행
  - 원격 락 있음 -> 진입 차단 + 안내 메시지
- 해제: 빈 영역 클릭, 편집 종료, 언마운트, 연결 종료 시 모든 락 필드 null 발행
- heartbeat: 편집 중 `LOCK_HEARTBEAT_MS = 2000` 주기로 lockHeartbeatAt 갱신

### 6.3 동시 획득 충돌 규칙

- 동일 테이블 동시 진입 시 결정 규칙:
  - 로컬 시계 기반 timestamp는 사용하지 않는다.
  - `(userId, editingClientId)` 오름차순 우선
- 패배 클라이언트는 편집 모드 즉시 해제 + 안내 토스트

stale lock 정리:

- `now - lockHeartbeatAt > LOCK_TTL_MS(기본 7000ms)`이면 stale로 판정하고 무시
- stale 판정 후 첫 편집 시도 클라이언트가 정상 락으로 대체 가능

### 6.4 UI 반영

- 잠긴 테이블 헤더에 락 뱃지 + 사용자명 표시
- 잠긴 테이블 입력 컨트롤 비활성화
- 캔버스 클릭 차단 시 상단 상태 메시지 제공
- 상태 메시지 영역은 `aria-live="polite"`로 선언한다.
- 색상은 시맨틱 토큰만 사용한다(`bg-accent`, `text-muted-foreground`, `border-border`).
- 아이콘 버튼/배지에는 `aria-label`을 부여한다. (예: `erd.lock.badgeAria`, `erd.sync.statusAria`)

### 6.5 신뢰 경계 / 보안 주의

- 소프트 락은 클라이언트 협조 모델이므로 악성/구버전 클라이언트가 우회 가능하다.
- 락 판단 시 Awareness 단독 신뢰를 피하고 `participantsByUserId`와 교차 검증한다.
  - 참가자 목록에 없는 userId의 락 정보는 무시한다.
  - roomEpoch/presenceVersion 역행 이벤트는 적용하지 않는다.
- 본 설계는 UX 충돌 완화가 목적이며, 강제 무결성 보장은 하드 락 단계에서 달성한다.

### 6.6 코드 에디터 편집 기반 락 확장

- 목적: ERD 캔버스 편집뿐 아니라 SQL/DSL 코드 편집 중인 테이블도 `editingTableKey` 기반으로 락에 포함한다.
- 핵심 규칙: "에디터 커서가 현재 속한 테이블 범위"를 락 대상으로 간주한다.

탐지 및 발행 흐름:

- `DdlCodeEditorPanel`/`DslCodeEditorPanel`에서 Monaco `editor`/`monaco` ref를 확보한다.
- `onDidFocusEditorText`, `onDidBlurEditorText`, `onDidChangeCursorPosition`, `onDidChangeModelContent`를 구독한다.
- 현재 커서 line 기준으로 테이블 범위를 역조회하여 `editingTableKey`를 계산한다.
- 계산된 키를 `useAwareness`로 전달해 `editingSource='code'`와 함께 발행한다.
- blur/패널 종료/룸 이탈 시 즉시 `editingTableKey=null`로 해제한다.

모드별 범위 추출:

- DSL:
  - `parseDsl` 결과에 테이블 line-range 메타데이터를 노출한다.
  - 커서가 특정 테이블 블록 내부일 때 해당 테이블 키를 사용한다.
- SQL:
  - `node-sql-parser` 호출 시 위치 메타를 포함해 AST를 받고, CREATE TABLE 단위 range를 추출한다.
  - 문법 오류 중에는 마지막 정상 range 캐시를 사용하고 `CODE_LOCK_GRACE_MS` 동안 락을 유지한다.

오류/경계 정책:

- 코드 입력 중 일시적 문법 오류로 range가 비어도 즉시 락을 해제하지 않는다.
- `CODE_LOCK_GRACE_MS`를 넘겨도 유효 range를 복원하지 못하면 락을 해제한다.
- 테이블 밖(헤더/공백/주석) 커서 이동 시 락을 해제한다.
- 동일 사용자가 ERD/Code 양쪽에서 편집 중이면 마지막 입력 소스를 `editingSource`로 갱신한다.

## 7. 파일 영향 범위

- `client/src/types/collaboration.ts`
  - AwarenessState 필드 확장(`editingSource`, `editingTableKey`, `lockHeartbeatAt` 등)
- `client/src/hooks/useAwareness.ts`
  - ERD/Code 편집 공통 락 상태 발행 + heartbeat 발행
- `client/src/types/erd.ts` 또는 파서 결과 타입 파일
  - 코드 편집용 테이블 범위 메타 타입 추가(예: `tableRanges`)
- `client/src/lib/ddl-parser.ts`
  - SQL 파싱 시 테이블 위치(range) 추출
- `client/src/lib/dsl-parser.ts`
  - DSL 파싱 결과에 테이블 위치(range) 노출
- `client/src/hooks/useDdlParse.ts`
  - parseResult의 테이블 위치 메타 전달
- `client/src/hooks/useDslParse.ts`
  - parseResult의 테이블 위치 메타 전달
- `client/src/stores/useCollaborationStore.ts`
  - 원격 락 계산용 selector/helper + stale lock 필터 추가
- `client/src/components/erd/ERDCanvas.tsx`
  - 테이블 클릭 시 락 검사 후 진입 + diagramWriteGate 연동
- `client/src/components/erd/TableNode.tsx`
  - 잠금 상태 기반 비활성화/안내 표시
- `client/src/components/erd/RemoteCursors.tsx`
  - 커서 라벨에 편집 대상 정보(선택) 표시
- `client/src/components/erd/DdlCodeEditorPanel.tsx`
  - 자동 동기화 훅 + 현재 커서 테이블 기반 락 발행
- `client/src/components/erd/DslCodeEditorPanel.tsx`
  - 자동 동기화 훅 + 현재 커서 테이블 기반 락 발행
- `client/src/hooks/useCodeEditorRefresh.ts`
  - 수동 Refresh 기능 유지(폴백), 자동 동기화와 충돌 없는 역할로 축소
- `client/src/hooks/useBidirectionalCodeSync.ts` (신규)
  - 양방향 동기화 오케스트레이션 + baseRevisionHash 검증 + queue TTL
- `client/src/lib/remote-edit-locks.ts`
  - `selectedNodeId` 대신 `editingTableKey` 우선 기반 락 계산으로 전환
- `client/src/i18n/locales/ko/translation.json`
  - `erd.sync.status.*`, `erd.lock.*` 문구 키 추가
- `client/src/i18n/locales/en/translation.json`
  - `erd.sync.status.*`, `erd.lock.*` 문구 키 추가

## 8. UX/운영 정책

- 기본값: 자동 동기화 ON
- 패널 상단에 상태 표시:
  - `자동 반영 대기중`
  - `문법 오류로 보류`
  - `원격 편집 락으로 보류`
  - `스테일 변경 감지로 자동 반영 취소`
  - `보류 시간 초과로 수동 적용 필요`
  - `동기화 완료`
- 수동 `Apply/Refresh` 버튼은 유지하여 예외 상황의 탈출 경로 제공

## 9. 테스트 계획

### 단위 테스트

- 코드 아이들 후 정상 파싱 시 1회만 `replaceFromDdl` 호출
- parse error 존재 시 자동 반영 미호출
- ERD 변경 시 코드 생성 호출, 동일 텍스트면 미반영
- origin/suppress 플래그로 역루프가 재발하지 않음
- 락 충돌 결정 규칙(`userId`, `editingClientId`) 검증
- stale lock TTL 초과 시 무시되는지 검증
- baseRevisionHash 불일치 시 자동 반영 drop 검증
- participants 교차검증 실패(유령 awareness) 시 락 무시 검증
- DSL table range 기반 커서 이동 시 `editingTableKey`가 올바르게 전환되는지 검증
- SQL parse error 중 `CODE_LOCK_GRACE_MS` 내에는 락이 유지되고 초과 시 해제되는지 검증

### 통합 테스트(2클라이언트)

- A가 T1 편집 중일 때 B의 T1 편집 진입 차단
- A 해제/이탈 시 B 즉시 진입 가능
- A가 비정상 종료되어 heartbeat가 멈추면 TTL 경과 후 B가 진입 가능한지 확인
- 코드 자동 반영 시 원격 락 존재하면 보류, 락 해제 후 최신 상태 1회 반영
- ERD 변경 -> 코드 자동 갱신 -> 다시 ERD 자동 반영 루프 미발생
- 자동 반영 대기 중 ERD가 원격 변경되면 스테일 적용이 폐기되는지 확인
- participants 목록에서 이탈한 사용자의 stale awareness가 남아도 락이 유지되지 않는지 확인
- A가 SQL/DSL 에디터에서 T1 편집 중일 때 B의 ERD 인라인 T1 편집 진입이 차단되는지 확인
- A가 코드 편집 중 일시적 문법 오류를 만들고 복구했을 때 락이 flicker 없이 유지/복구되는지 확인

## 10. 단계별 구현 순서

1. Awareness 모델 확장(tableKey/heartbeat/clientId) + 소프트 락 UI/진입 차단
2. 코드->ERD 자동 반영(아이들 + 오류 게이트 + diagramWriteGate + 보류 큐)
3. baseRevisionHash 검증 + stale drop + queue timeout 정책 적용
4. ERD->코드 자동 반영(모드별 생성 + 루프 방지)
5. 코드 에디터 기반 테이블 락(커서 range 추적 + parse fallback + awareness 발행)
6. i18n/a11y/디자인 토큰 정리 + 단위/통합 테스트 및 타이머 튜닝

## 10.1 구현 진행 현황

- [x] 1단계(1차): 소프트 락 UI/진입 차단 적용
  - `useRemoteEditLocks` 추가 및 `participantsByUserId` 교차검증 반영
  - `ERDCanvas` 테이블 클릭 시 원격 락 진입 차단 + 토스트 안내
  - `TableNode` 편집 비활성화/락 배지 표시
  - `useAwareness`에서 편집 대상(`selectedNodeId`) 발행 연동
- [x] 2단계: 코드->ERD 자동 반영(아이들/오류/락 게이트) 적용
  - `useBidirectionalCodeSync` 추가
  - `CODE_SYNC_IDLE_MS=1200`, `CODE_SYNC_MAX_QUEUE_WAIT_MS=10000` 적용
  - SQL/DSL 패널에 자동 반영 훅 연결
- [x] 4단계: ERD->코드 자동 반영(아이들/루프 방지) 적용
  - `ERD_SYNC_IDLE_MS=600` 적용
  - `origin` 플래그(`user-code`, `code-auto-sync`, `erd-auto-sync`)로 역루프 방지
- [x] 3단계(1차): baseRevisionHash/stale drop/queue timeout 정책 반영
  - parse 시작 시점 `baseRevisionHash` 캡처 + 적용 직전 불일치 drop 적용
  - 락 대기 timeout 기본 정책 반영
- [x] 3단계(고도화): queue timeout 시 사용자 상태 메시지/수동 Apply 유도 UX 강화
  - `erd.sync.status.*` 기반 상태 메시지에 `queueTimeoutManual` 반영
  - 수동 `Apply` 경로 유지(폴백 UX)
- [x] 5단계: 코드 에디터 기반 테이블 락 추가
  - SQL/DSL 테이블 range 메타 도출
  - Monaco 커서 이벤트 기반 `editingTableKey` 발행
  - parse error fallback(`CODE_LOCK_GRACE_MS`) 적용
  - `remote-edit-locks`를 `editingTableKey` 기준으로 전환
- [~] 6단계: 테스트/운영 튜닝 진행 중
  - 현재: lint/build 통과, `erd.sync.status.*` 상태 메시지/aria 반영
  - 현재: `node:test` + `tsc` 기반 단위 테스트 자동화(`npm run test:unit`) 추가
  - 현재: 리비전 해시/원격 락 결정 로직 단위 테스트 6건 통과
  - 남은 작업: 2클라이언트 통합 시나리오 자동화 + 코드 편집 테이블 락 시나리오

## 11. 의사결정(확정)

- 자동 반영 기준 아이들 시간은 `1200ms`로 시작한다.
- 협업 락은 소프트 락으로 먼저 적용한다.
- 하드 락은 운영 데이터에서 충돌이 반복될 때 2단계로 확장한다.
- 충돌 판정은 로컬 시간 기반이 아닌 결정적 키(`userId`, `clientId`) 기반으로 한다.
- 코드 자동반영(`replaceFromDdl`)은 tableLock 존재 시 실행하지 않고 보류한다.
- 테이블 락 기준은 `selectedNodeId`가 아니라 `editingTableKey`를 SSOT로 사용한다.
