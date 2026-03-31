# Code ↔ ERD 양방향 동기화 안정화 계획

**작성일:** 2026-03-04
**상태:** 구현 완료, 수동 검증 대기

## 리스크 해소 전략 (적용 확정)

### R1. `position` 해시 제외로 인한 위치 유실 위험

- 해소 전략
  - Code→ERD apply 직전, 테이블별 위치 스냅샷(`tableKey -> {x,y}`)을 캡처한다.
  - apply 이후 동일 `tableKey`로 매칭되는 테이블에 한해 위치를 복원한다.
  - `full-replace`/`full-replace-fallback` 경로 모두 위치 복원을 동일하게 적용한다.
- `tableKey` 원칙
  - 1순위: `tableTermId`
  - 2순위: `logicalTableName`
  - 3순위: `label` (정규화)

### R2. suppress 윈도우 중 실제 변경 누락 위험

- 해소 전략
  - suppress 윈도우에서 감지된 revision은 폐기하지 않고 `suppressedRevisionRef`에 저장한다.
  - 윈도우 종료 시점에 `suppressedRevisionRef`를 재평가하여 ERD→Code를 지연 실행한다.
  - 즉, “무시(drop)”가 아니라 “보류(defer) 후 재처리(replay)” 정책으로 전환한다.

### R3. ref/deps 변경 후 타이밍 회귀 위험

- 해소 전략
  - fake timer 테스트 3종을 필수 게이트로 설정한다.
    1. apply 직후 즉시 타이핑
    2. 원격 이동 + 로컬 타이핑 경쟁
    3. suppress 종료 후 보류 revision 재처리
  - 런타임 디버그 로그 키(`sync-stale`, `sync-suppressed`, `sync-replayed`)를 추가해 추적성을 확보한다.

### R4. UX 문구와 실제 동작 불일치 위험

- 해소 전략
  - 보장형 표현(“곧 재시도”)을 제거하고 조건형 표현으로 변경한다.
  - 문구 기준:
    - ko: “자동반영을 건너뛰었습니다. 코드 또는 ERD가 다시 변경되면 다시 시도합니다.”
    - en: “Auto-apply was skipped. It will run again when code or ERD changes.”

### R5. 장애 시 복구 지연 위험

- 해소 전략
  - 변경을 #1/#2/#3/FE-UI 커밋으로 분리 유지한다.
  - 부분 롤백 매트릭스를 운영 문서에 명시한다.

## 목표/범위/비범위

### 목표 (이번 변경에서 달성)

- `dropped-stale` 오탐(false drop) 비율을 유의미하게 감소시킨다.
- 협업/대형 다이어그램에서도 Code→ERD 자동 반영이 영구 지연되지 않도록 한다.
- Code→ERD 직후 ERD→Code 역동기화로 사용자 코드가 덮어써지는 위험을 제거한다.

### 범위 (In Scope)

- `useBidirectionalCodeSync` 상태머신과 revision hash 기준 정밀화
- 동기화 suppress 메커니즘 개선
- 동기화 상태(`syncStatus`) UX 가이드 및 검증 플로우 보강

### 비범위 (Out of Scope)

- DSL/DDL 파서 규칙 자체 변경
- Yjs 프로토콜/CRDT 충돌 해결 전략 변경
- 대규모 UI 리디자인

## 아키텍처 경계/제약

- Code→ERD는 "구조 데이터" 기준으로만 충돌을 판단하고, 레이아웃(position) 변경은 분리해 다룬다.
- 협업 모드(원격 편집)에서 원격 이벤트 폭주가 있어도 로컬 입력 반영 지연이 무한정 누적되면 안 된다.
- 결정은 가급적 가역적으로 유지하고, 상수/플래그 기반으로 빠른 롤백이 가능해야 한다.

## 의사결정 요약 (Architecture)

- 결정 1: revision hash에서 `position`을 제외해 구조 충돌만 감지
- 결정 2: `currentRevisionHash`는 ref 미러링으로 읽어 stale closure 제거
- 결정 3: suppress는 `reason + timestamp`로 확장하고, 사용자 입력 재개 시 즉시 해제

## 마일스톤/오너십

1. 구현
- FE-DATA: `useBidirectionalCodeSync`, `code-sync-revision`, `code-sync` 상수 반영
- FE-UI: 상태 문구/시각 피드백 점검

2. 검증
- FE-DATA: 단위 테스트 + fake timer 테스트
- QA: 협업 포함 수동 시나리오 검증

3. 배포/관측
- PM/QA: 내부 → beta → 전체 단계 승인
- FE-DATA: 지표 관측 및 상수 튜닝

## 배경

DSL/DDL 코드 편집 중 "코드 자동반영 취소 (파싱 중 ERD가 먼저 변경됨)" 에러 메시지가 간헐적으로 발생한다.
이 메시지는 `dropped-stale` 동기화 상태로, Code→ERD 자동 반영이 취소되었음을 뜻한다.

## 핵심 구조

```
사용자 코드 입력
  → handleUserCodeChange (parseBaseRevisionHashRef = currentRevisionHash 캡처)
  → 파싱 시작 (비동기)
  → 1200ms idle 대기 (setTimeout)
  → 타이머 콜백:
      parseBaseRevisionHashRef !== currentRevisionHash?
        → YES: setStatus('dropped-stale') ← 문제 발생 지점
        → NO:  applyParsedToErd() 실행 → ERD 반영
```

### 관련 파일

| 파일 | 역할 |
|------|------|
| `hooks/useBidirectionalCodeSync.ts` | 양방향 sync 상태 머신 (핵심) |
| `lib/code-sync-revision.ts` | ERD 리비전 해시 계산 |
| `lib/code-sync-apply-gate.ts` | 코드 자동반영 게이트 판단 |
| `constants/sync-status.ts` | SyncStatus 타입 정의 |
| `constants/code-sync.ts` | 타이밍 상수 (idle 1200ms, ERD 600ms 등) |
| `lib/sync-status-meta.ts` | 상태별 UI 메타 (메시지, 아이콘, 색상) |
| `components/erd/DslCodeEditorPanel.tsx` | DSL 편집기 (sync 훅 호출자) |
| `components/erd/DdlCodeEditorPanel.tsx` | DDL 편집기 (sync 훅 호출자) |
| `stores/canvas/canvasTableActions.ts` | replaceFromDsl, replaceFromDdl |

---

## 발견된 문제

### #1. 리비전 해시가 position을 포함 — 과잉 민감 (High)

**위치:** `code-sync-revision.ts:4-10`, `useBidirectionalCodeSync.ts:115-136`

**현상:** `buildRevisionHash()`가 노드의 `position: { x, y }`를 해시에 포함한다. 코드 편집 중 테이블을 드래그하거나, 원격 사용자가 테이블을 이동하면 해시가 변경되어 `dropped-stale` 발생.

**문제 본질:** Code→ERD 적용은 구조(테이블명, 컬럼, 엣지) 변경이다. 위치 변경과는 무관하므로, 위치 변경만으로 코드 반영이 취소되는 것은 과잉 방어.

**재현 시나리오:**
1. 코드 패널에서 테이블 정의 입력
2. 1200ms 이내에 캔버스에서 테이블 드래그 (위치만 변경)
3. → "코드 자동반영 취소 (파싱 중 ERD가 먼저 변경됨)"

**수정 방향:** `RevisionSnapshotNode` 인터페이스에서 `position` 필드를 제거하고, `buildRevisionHash` 호출 측에서도 position을 전달하지 않는다. ERD→Code 역방향 동기화 트리거에도 position 포함이 불필요하다 — DSL/DDL 코드에는 position 정보가 없으므로, position만 변경 시 `generateDsl`/`generateDdl` 결과가 동일하며 ERD→Code 경로의 코드 동일성 검사(`djb2(generated) === djb2(codeTextRef.current)`, `useBidirectionalCodeSync.ts:364`)에서 이미 걸러진다.

**수정 범위:**

```typescript
// code-sync-revision.ts — 인터페이스에서 position 제거
export interface RevisionSnapshotNode {
  id: string;
  type: string;
  parentId: string | null;
  // position 제거 — 구조 변경만 감지
  data: unknown;
}

// useBidirectionalCodeSync.ts — 호출 측에서 position 전달 제거
nodes.map((node) => ({
  id: node.id,
  type: node.type ?? 'table',
  parentId: node.parentId ?? null,
  data: node.data,
}))
```

**`buildRevisionHash` 사용처 분석:** `useBidirectionalCodeSync.ts`에서만 사용됨 (Grep 확인 완료). 다른 곳에 영향 없음.

**옵션 비교 (Architecture):**

- 옵션 A: 현재 해시에서 `position` 완전 제외
- 옵션 B: `structureRevisionHash`와 `layoutRevisionHash`를 분리해 이중 관리

**권고안:** 이번 배포는 **옵션 A**를 우선 적용한다. 구현 복잡도가 낮고 즉시 오탐을 줄인다. 추후 레이아웃 충돌 규칙이 필요해지면 옵션 B로 확장한다.

---

### #2. handleUserCodeChange의 stale closure + 타이머 의존성 (High)

**위치:** `useBidirectionalCodeSync.ts:186-199, 300-314`

**현상 (stale closure):** `handleUserCodeChange` 내부에서 `currentRevisionHash`를 useCallback 클로저로 캡처한다. `applyParsedToErd()` 실행 직후 React 재렌더 전에 사용자가 타이핑하면, 갱신되지 않은 old hash가 `parseBaseRevisionHashRef`에 저장된다.

**타이밍:**
```
T=0ms:    applyParsedToErd() → Y.Doc 변경 → Zustand set() 예약 (hash A→B)
T=1ms:    사용자 타이핑 → handleUserCodeChange 호출
          parseBaseRevisionHashRef = hash_A (stale 클로저!)
T=5ms:    React 재렌더 → currentRevisionHash = hash_B
T=1200ms: 타이머 → hash_A !== hash_B → dropped-stale!
```

**현상 (타이머 의존성):** Code→ERD useEffect 의존성 배열에 `currentRevisionHash`가 포함되어, ERD가 변경될 때마다 타이머가 cancel→recreate된다. 원격 협업에서 상대방이 테이블을 자주 수정하면 타이머가 반복 리셋되어 apply가 영구 지연될 수 있다.

**수정 방향:** 두 문제 모두 `currentRevisionHash`를 ref로 미러링하여 해결한다. 하나의 ref를 공유하여 `handleUserCodeChange`와 Code→ERD 타이머 콜백 양쪽에서 최신 값을 읽는다.

```typescript
// 1) ref 미러링 (한 번만 선언)
const currentRevisionHashRef = useRef(currentRevisionHash);
useEffect(() => {
  currentRevisionHashRef.current = currentRevisionHash;
}, [currentRevisionHash]);

// 2) handleUserCodeChange에서 ref 사용 (stale closure 해소)
parseBaseRevisionHashRef.current = currentRevisionHashRef.current;
// → useCallback deps에서 currentRevisionHash 제거

// 3) Code→ERD 타이머 콜백에서 ref 사용 (타이머 의존성 해소)
// 타이머 내부: currentRevisionHashRef.current로 최신 해시 읽기
// → useEffect deps에서 currentRevisionHash 제거

// 4) parsing 시작 effect에서도 ref 사용
// parseBaseRevisionHashRef.current = currentRevisionHashRef.current;
// → useEffect deps에서 currentRevisionHash 제거
```

**`currentRevisionHash` 참조 5곳의 처리 방침:**

| 위치 (현재 라인) | 용도 | 처리 |
|-----------------|------|------|
| ERD 변경 감지 effect (L156-173) | ERD 구조 변경을 감지하여 `pendingErdSyncRevisionRef` 설정 | **deps 유지** — 이 effect가 ERD 변경 감지의 핵심 진입점 |
| `handleUserCodeChange` useCallback (L186-199) | `parseBaseRevisionHashRef` 캡처 | **ref로 전환**, deps에서 제거 |
| Code→ERD effect (L214-314) | 타이머 콜백 내 stale 검사 | **ref로 전환**, deps에서 제거 |
| parsing 시작 effect (L317-322) | 파싱 시작 시점 해시 고정 | **ref로 전환**, deps에서 제거 |
| ERD→Code effect (L325-391) | 타이머 트리거 | **deps 유지** — `pendingErdSyncRevisionRef`는 `useRef`이므로 effect를 트리거하지 않음. deps에서 제거하면 순수 ERD 편집 시 코드 자동 생성이 중단됨. ERD→Code 방향은 ERD idle debounce이므로 ERD 변경마다 타이머 리셋이 정상 동작 |

**최종 deps 변경 요약:**

```typescript
// handleUserCodeChange deps: currentRevisionHash 제거
[clearErdToCodeTimer, onCodeTextChange, setStatus]

// Code→ERD effect deps: currentRevisionHash 제거
[applyParsedToErd, clearCodeToErdTimer, codeIdleMs, codeText,
 enabled, hasBlockingErrors, hasParsedTables, hasRemoteEditLocks,
 maxQueueWaitMs, parsing, ready, setStatus]

// parsing 시작 effect deps: currentRevisionHash 제거
[parsing]

// ERD→Code effect deps: currentRevisionHash **유지** (ERD idle debounce 트리거 필요)
[codeIdleMs, enabled, erdIdleMs, generateCodeFromErd,
 hasBlockingErrors, syncUpdate, parsing, ready, setStatus,
 currentRevisionHash, clearErdToCodeTimer]
```

**방법 B (Zustand getState 직접 계산) 미채택 사유:** `buildRevisionHash`는 `JSON.stringify` + `sortObjectKeys` + `djb2`를 수행하므로, 호출 빈도가 높은 `handleUserCodeChange`에서 매번 재계산하면 대형 다이어그램에서 성능 저하 우려.

**옵션 비교 (Architecture/Dev):**

- 옵션 A: `currentRevisionHashRef` 미러링 (현재 제안)
- 옵션 B: 입력 시점마다 store snapshot을 읽어 해시 재계산

**권고안:** **옵션 A** 채택. stale closure와 타이머 의존성 문제를 함께 해결하면서 런타임 비용이 낮다.

---

### #3. suppressNextErdSyncRef — 다중 렌더 사이클 시 1회 suppress 한계 (Medium)

**위치:** `useBidirectionalCodeSync.ts:163-172, 280-293`

**현상:** Code→ERD 적용 시 `suppressNextErdSyncRef = true`로 설정하여 적용 직후의 ERD 리비전 변경 1회를 무시한다. 하지만 `applyParsedToErd()`가 다수 테이블/엣지를 수정하면, React 렌더링 배치에 따라 `currentRevisionHash`가 **여러 번** 변경될 수 있다.

- 첫 번째 변경: suppress로 catch → pendingErdSyncRevisionRef 미설정 (정상)
- 두 번째 변경: suppress 이미 리셋 → pendingErdSyncRevisionRef 설정 → ERD→Code 역동기화 트리거
- 결과: 사용자 코드가 자동 생성 코드로 덮어쓰여질 수 있음

**수정 방향:** boolean 1회 suppress를 제거하고, `reason + timestamp` 기반으로 다중 변경 구간을 보호한다. Code→ERD apply 후 짧은 suppress 윈도우를 두되, 사용자 입력이 재개되면 즉시 해제한다.

**삭제 대상 (기존 `suppressNextErdSyncRef` 코드 5곳):**

| 현재 라인 | 코드 | 처리 |
|----------|------|------|
| L99 | `const suppressNextErdSyncRef = useRef(false);` | **삭제** → `suppressUntilRef` + `suppressReasonRef`로 대체 |
| L163-170 | ERD 변경 감지 내 suppress 체크 (`if (suppressNextErdSyncRef.current && ...)`) | **교체** → timestamp 기반 suppress 로직 |
| L280 | apply 직전 `suppressNextErdSyncRef.current = true;` | **교체** → reason + timestamp 설정 |
| L283 | apply 실패 시 `suppressNextErdSyncRef.current = false;` | **교체** → reason/timestamp 리셋 |
| L400 | cleanup `suppressNextErdSyncRef.current = false;` | **교체** → `suppressUntilRef.current = 0; suppressReasonRef.current = null;` |

**신규 코드:**

```typescript
// constants/code-sync.ts — 새 상수 추가
/** Code→ERD apply 직후 ERD 변경을 무시하는 suppress 윈도우 (ms) */
export const CODE_SYNC_SUPPRESS_WINDOW_MS = 200;

// useBidirectionalCodeSync.ts — 새 ref 선언 (L99 부근)
const suppressUntilRef = useRef<number>(0);
const suppressReasonRef = useRef<'code-auto-sync' | null>(null);
const suppressedRevisionRef = useRef<string | null>(null); // R2: defer+replay용

// apply 직전 (L280 부근)
suppressReasonRef.current = 'code-auto-sync';
suppressUntilRef.current = Date.now() + CODE_SYNC_SUPPRESS_WINDOW_MS;

// ERD 변경 감지 effect 내부 (L163 부근) — 기존 suppress 체크 교체
if (suppressReasonRef.current === 'code-auto-sync' && Date.now() < suppressUntilRef.current) {
  // suppress 윈도우 내 — 보류(defer)하되, 관측 해시는 갱신 (R2)
  lastObservedErdRevisionRef.current = currentRevisionHash;
  suppressedRevisionRef.current = currentRevisionHash;
  return;
}
// suppress 윈도우 만료 후 보류 revision 재처리(replay) (R2)
if (suppressedRevisionRef.current) {
  pendingErdSyncRevisionRef.current = suppressedRevisionRef.current;
  suppressedRevisionRef.current = null;
}

// handleUserCodeChange 내부 (L188 부근) — 사용자 입력 시 즉시 suppress 해제
suppressReasonRef.current = null;
suppressUntilRef.current = 0;
suppressedRevisionRef.current = null;

// cleanup effect (L400 부근) — suppressedRevisionRef도 정리
suppressedRevisionRef.current = null;
```

**R2 replay 시점:** suppress 만료 후 다음 ERD 변경이 effect를 트리거할 때 lazy replay한다. suppress 만료~다음 ERD 변경 사이의 공백은 200ms 이내이므로 실용상 문제 없음. 만약 ERD 변경 없이 suppress만 만료되는 경우, ERD→Code 방향은 `currentRevisionHash` deps 유지로 별도 처리 불필요.

**`originRef` 관계:** 기존 ERD 변경 감지 effect의 `originRef.current === 'code-auto-sync'` 체크는 `suppressReasonRef` 체크로 대체되어 제거된다. `originRef`의 cross-direction 루프 방지 역할(Code→ERD L229 `'erd-auto-sync'` 체크, ERD→Code L370 설정)은 변경 없이 유지.

**200ms 근거:** React 렌더 배치는 일반적으로 16ms(60fps) ~ 50ms 내에 완료된다. 200ms는 대형 다이어그램(10+ 테이블)에서 다중 렌더 사이클을 충분히 커버하면서도, 사용자 입력 재개 시 즉시 해제되므로 과도한 억제 리스크를 줄인다.

**리스크/완화:**

- 리스크: suppress 윈도우가 너무 길면 실제 ERD 변경을 놓칠 수 있음
- 완화: 상수화 + telemetry 기반 튜닝 + 사용자 입력 시 즉시 해제

**옵션 비교 (Architecture/Dev):**

- 옵션 A: timestamp 윈도우만 사용
- 옵션 B: origin reason + timestamp 하이브리드 (현재 제안)

**권고안:** **옵션 B** 채택. 윈도우만 쓰는 경우의 과잉 억제 리스크를 줄이면서 다중 렌더 구간 보호를 유지한다.

---

## 수정 우선순위

| 순위 | 문제 | 심각도 | 효과 |
|------|------|--------|------|
| 1 | #1 리비전 해시 position 제거 | High | dropped-stale 발생 빈도 대폭 감소 |
| 2 | #2 stale closure + 타이머 의존성 해결 (통합) | High | apply 직후 타이핑 시 false drop 방지 + 협업 시 apply 지연 감소 |
| 3 | #3 suppress reason+timestamp 전환 | Medium | code→ERD 역동기화 코드 덮어쓰기 방지 |

## 수정 파일 요약

### FE-DATA (핵심 로직)

| 파일 | 변경 내용 |
|------|-----------|
| `lib/code-sync-revision.ts` | `RevisionSnapshotNode`에서 `position` 필드 제거 |
| `constants/code-sync.ts` | `CODE_SYNC_SUPPRESS_WINDOW_MS` 상수 추가 |
| `hooks/useBidirectionalCodeSync.ts` | position 제거, ref 미러링, suppress reason+timestamp화, deps 정리, suppress 보류 revision 재처리 |
| `hooks/useApplyToErd.ts` | apply 전/후 테이블 위치 스냅샷 및 복원 로직 추가 |

### FE-UI (문구/시각 정렬)

| 파일 | 변경 내용 |
|------|-----------|
| `lib/sync-status-meta.ts` | (변경 여부 점검 후 확정) |
| `i18n/locales/ko/translation.json` | `staleDrop` 문구 → 안내형 톤 변경 |
| `i18n/locales/en/translation.json` | `staleDrop` 문구 → 안내형 톤 변경 |

## 검증 계획

1. DSL 패널에서 테이블 정의 입력 후 캔버스에서 테이블 드래그 → dropped-stale 미발생 확인
2. 코드 입력 → auto-apply 직후 즉시 추가 타이핑 → dropped-stale 미발생 확인
3. 대형 다이어그램(10+ 테이블) code→ERD apply 후 역방향 코드 덮어쓰기 없음 확인
4. 협업 모드에서 상대방 테이블 이동 중 코드 입력 → 정상 apply 확인
5. TypeScript 컴파일 + ESLint 통과

## 구현/테스트 상세 (Dev)

- 필수(이번 배포 게이트)
  - 수동 검증 시나리오 1~4 + 협업 시나리오 1종
  - `cd client && npm run lint` / `cd client && npm run build` 실행
  - `useBidirectionalCodeSync` fake timer 테스트 3종
    - apply 직후 타이핑
    - 원격 이동 + 로컬 타이핑 경쟁
    - suppress 종료 후 보류 revision 재처리
- 후속(인프라 고도화)
  - 테스트 인프라(vitest/happy-dom) 신규 도입 및 범위 확장
- 단위 테스트(필수)
  - `code-sync-revision.ts`: position 변경 전/후 동일 해시 보장 케이스 추가
  - `useBidirectionalCodeSync`: stale closure 제거 및 deps 변경 회귀 방지
  - `useApplyToErd`: 위치 복원 매칭(tableKey) 성공/실패 케이스
- 통합/E2E
  - 단일 사용자: 코드 입력 + 캔버스 드래그 동시 시나리오
  - 협업 사용자: 원격 이동/로컬 타이핑 경쟁 시나리오
- 관측(로그/메트릭)
  - `dropped-stale` 발생 카운트
  - `resolveCodeAutoApplyStatus(false)` 원인별 비율
  - `hold-queue-timeout` 발생 비율
  - `sync-suppressed`/`sync-replayed` 카운트

## 합격 기준 (Definition of Done)

- 기능
  - 재현 시나리오 1~4에서 오탐 `dropped-stale`가 재현되지 않는다.
  - Code→ERD 직후 사용자 코드가 ERD→Code로 덮어써지지 않는다.
- 품질
  - TypeScript 컴파일/ESLint 통과
  - 신규 테스트가 CI에서 안정적으로 통과
- 운영
  - 내부 배포 1일 관측에서 `hold-queue-timeout` 급증이 없다.

## QA 핸드오프 체크리스트

- 변경 파일/의도
  - 해시 계산 기준 변경, stale closure 해소, suppress 정책 변경
- 자동 검증 결과
  - 단위 테스트/타입체크/린트 결과를 실행 로그와 함께 첨부
- 수동 검증 항목
  - 단일 사용자 시나리오 4종
  - 협업 시나리오 1종(원격 이동+로컬 타이핑)
- 회귀 위험 경로
  - 코드 입력 직후 자동 apply
  - ERD 편집 직후 역방향 코드 생성
  - 원격 락 대기/queue-timeout 상태 전이

## UX/디자인 점검 항목 (Design)

### `dropped-stale` 문구 개선

현재 문구가 "실패/취소" 톤이라 사용자에게 불필요한 불안을 준다. 보장형 표현 대신 조건형 안내 문구로 변경한다.

| 키 | 현재 | 개선안 |
|----|------|--------|
| ko `staleDrop` | "코드 자동반영 취소 (파싱 중 ERD가 먼저 변경됨)" | "자동반영을 건너뛰었습니다. 코드 또는 ERD가 다시 변경되면 다시 시도합니다." |
| en `staleDrop` | "Code auto-apply canceled (ERD changed during parsing)" | "Auto-apply was skipped. It will run again when code or ERD changes." |

### 상태별 시각 처리 현황 및 점검

| 상태 | 색상 클래스 | 아이콘 | 성격 | 점검 |
|------|------------|--------|------|------|
| `idle-wait` | `text-muted-foreground` | `Loader2` (spin) | 진행중 | OK |
| `hold-parse-error` | `text-destructive` | `XCircle` | 차단 | OK — 유일한 빨강 |
| `hold-remote-lock` | `text-erd-warning` | `AlertTriangle` | 보류 | OK |
| `hold-queue-timeout` | `text-erd-warning` | `AlertTriangle` | 보류 | OK |
| `hold-manual-confirm` | `text-erd-warning` | `AlertTriangle` | 보류 | OK |
| `dropped-stale` | `text-erd-warning` | `AlertTriangle` | 일시 건너뛰기 | **점검 필요** — 보류(`hold-*`)와 동일 시각이지만 성격이 다름. 문구 변경만으로 충분한지, 아이콘을 `Info`로 전환할지 검토 |
| `synced` | `text-success` | `CheckCircle2` | 완료 | OK |

**결론:** 이번 배포에서는 문구 변경만 적용하고, 아이콘/색상 변경은 사용자 피드백 후 판단한다.

### 기타 점검

- i18n 키(`erd.sync.status.*`) 변경 시 ko/en 문구를 동시에 점검하고, 길이 차이로 인한 UI 깨짐을 확인한다.
- 상태 전이 기준을 PM/QA가 재현 가능하도록 문서화한다.

## 롤아웃/롤백

- 단계 배포
  1. 내부 사용자
  2. beta 그룹
  3. 전체
- 관측 지표
  - `dropped-stale` 발생률
  - auto-apply 성공률
  - queue-timeout 비율
  - suppressed→replayed 비율
- 롤백
  - 부분 롤백 매트릭스:
    1. #3 이슈 시: `CODE_SYNC_SUPPRESS_WINDOW_MS=0` 또는 #3 커밋 리버트
    2. #2 이슈 시: ref/deps 변경 커밋만 리버트
    3. #1 이슈 시: revision hash 기준 변경 커밋만 리버트
    4. FE-UI 이슈 시: i18n 문구 커밋만 리버트

## 오픈 이슈 / 가정

- 확인된 사실: `buildRevisionHash`는 `useBidirectionalCodeSync` 외 경로에서 사용되지 않는다 (Grep 확인 완료).
- 가정: `dropped-stale`는 오탐 비중이 높고, 실제 충돌 보호 기능은 다른 게이트로 충분히 유지된다.
- 오픈 이슈: suppress 기본값 200ms가 대형 도면에서도 적정한지 내부 배포 데이터로 재검증 필요.
- 오픈 이슈: tableKey 매칭 실패 테이블의 위치 복원 fallback 정책(기본 배치 vs 직전 좌표 근접값) 확정 필요.

## 역할 기반 실행안 (표준 준수)

### [PM] 범위/수용기준 고정

- 본 문서의 In/Out Scope를 이슈 본문에 그대로 고정한다.
- 수용기준은 Definition of Done 섹션을 기준으로 삼는다.
- 우선순위는 `#1 → #2 → #3` 순서로 고정한다.

### [BE] 백엔드 영향 확인

- `BE: no code change`를 기본값으로 둔다.
- 단, 동기화 상태/메시지 키 추가로 API 계약 변경이 필요한 경우에만 별도 BE 이슈를 분리한다.

### [FE-DATA] 핵심 로직 변경

- 대상 파일:
  - `client/src/lib/code-sync-revision.ts`
  - `client/src/constants/code-sync.ts`
  - `client/src/hooks/useBidirectionalCodeSync.ts`
  - `client/src/hooks/useApplyToErd.ts`
- 작업:
  - revision hash에서 `position` 제외
  - `currentRevisionHashRef` 미러링으로 stale closure 제거
  - suppress를 `reason + timestamp`로 전환 + `suppressedRevisionRef` defer+replay 추가
  - effect/useCallback deps 재정리
  - `useApplyToErd`: apply 전/후 테이블 위치 스냅샷 및 복원 로직 추가 (R1)
  - 디버그 로그 키 추가: `sync-stale`, `sync-suppressed`, `sync-replayed` (R3, `useBidirectionalCodeSync.ts`에 `console.debug` 삽입)

### [FE-UI] 상태 UX/문구 정렬

- 대상 파일:
  - `client/src/lib/sync-status-meta.ts`
  - `client/src/i18n/locales/ko/translation.json`
  - `client/src/i18n/locales/en/translation.json`
- 작업:
  - `dropped-stale` 문구를 재시도 가능한 안내형 톤으로 정리
  - 경고 상태(`hold-*`)의 시각적 강도 일관성 점검

### [QA-PACKET] 검증/회귀 보고

- 자동 검증:
  - `cd client && npm run lint`
  - `cd client && npm run build`
  - (전체 실패 시) 변경 범위 대상 검증 + 기존 실패 항목 분리 기록
- 수동 검증:
  - 단일 사용자 4시나리오
  - 협업 사용자 1시나리오
- 리스크:
  - suppress 윈도우 과대/과소로 인한 미감지 또는 과잉 억제

### [DOC/COMMIT] 문서/커밋 규칙

- 문서:
  - 본 계획서와 실제 변경점 불일치 시 즉시 동기화
- 커밋 분할(권장 — 수정 항목별 분리로 리뷰 용이):
  1. `fix(sync): exclude position from revision hash and add position restore` (#1 + R1)
  2. `fix(sync): resolve stale closure and timer deps via ref mirroring` (#2)
  3. `fix(sync): replace boolean suppress with reason+timestamp window and defer replay` (#3 + R2 + R3)
  4. `fix(sync-i18n): update dropped-stale copy to guidance tone` (FE-UI + R4)
  5. `docs(plan): code-erd sync stabilization plan`

## PR 체크리스트 템플릿 (복붙용)

```markdown
## Scope
- [ ] In Scope만 변경했다.
- [ ] Out of Scope 변경이 없다.

## PM/Architecture
- [ ] 우선순위 #1/#2/#3 순서로 반영했다.
- [ ] 옵션/트레이드오프를 PR 설명에 명시했다.
- [ ] 롤백 방법을 PR 설명에 명시했다.

## Backend
- [ ] BE 영향 없음 (`BE: no code change`)을 확인했다.
- [ ] (필요 시) BE 계약/마이그레이션 변경을 별도 PR로 분리했다.

## Frontend Data/Store
- [ ] `code-sync-revision.ts`에서 `position` 제외를 반영했다.
- [ ] `useApplyToErd.ts`에서 apply 전/후 테이블 위치 스냅샷/복원을 구현했다 (R1).
- [ ] `useBidirectionalCodeSync.ts` ref 미러링을 반영했다.
- [ ] suppress reason+timestamp 로직 + `suppressedRevisionRef` defer+replay를 반영했다 (R2).
- [ ] effect/callback deps를 점검했다.
- [ ] 디버그 로그 키(`sync-stale`, `sync-suppressed`, `sync-replayed`)를 추가했다 (R3).

## Frontend UI/Design
- [ ] `dropped-stale` 안내 문구를 사용자가 행동 가능하게 작성했다.
- [ ] `hold-*` 상태의 시각 강도를 일관되게 유지했다.
- [ ] ko/en i18n 문구 길이 차이로 UI 깨짐이 없는지 확인했다.

## Verification
- [ ] `cd client && npm run lint` 통과
- [ ] `cd client && npm run build` 통과
- [ ] (전체 실패 시) 변경 범위 대상 검증과 기존 실패 항목을 분리 기록했다.
- [ ] 수동 시나리오 1~4 통과
- [ ] 협업 시나리오 통과

## QA Packet
- [ ] 변경 파일 목록(역할별)을 첨부했다.
- [ ] 실행 명령/결과를 첨부했다.
- [ ] 고위험 회귀 경로를 명시했다.
- [ ] 남은 리스크/가정을 명시했다.
```
