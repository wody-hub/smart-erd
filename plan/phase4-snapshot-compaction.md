# Phase 4 — 스냅샷 컴팩션 구현 계획

## Context

설계서 `plan/diagram-delta-save-design.md`의 Phase 4 (L327-365)를 구현한다.
현재 누적 Yjs update가 계속 append되면서 `ydocSnapshot` 크기와 로딩 시간이 선형 증가한다.
`COMPACTION_WARN_THRESHOLD = 500`이지만 실제 컴팩션은 미구현 상태.

**목표:** 클라이언트가 `Y.encodeStateAsUpdate(doc)` → 단일 update로 압축 → 서버로 전송 →
서버가 `ydocSnapshot`을 교체하여 스냅샷 크기를 대폭 줄인다.

**방안 B 채택:** 방 접속자가 1명(본인)일 때만 컴팩션 허용. 구현이 단순하고 안전하다.

---

## Step 1. BE — 메시지 타입 상수 추가

**파일:** `DiagramWebSocketHandler.java`

```java
/** Compacted snapshot (클라이언트 → 서버, 스냅샷 교체 요청) */
private static final byte MSG_COMPACTED_SNAPSHOT = 0x08;
```

Javadoc의 메시지 프로토콜 목록에 `0x08 — Compacted snapshot` 항목 추가.

---

## Step 2. BE — `DiagramSnapshotService.replaceSnapshot()` 신규 메서드

**파일:** `DiagramSnapshotService.java`

컴팩션 스냅샷으로 기존 `ydocSnapshot`을 **교체**하는 메서드를 추가한다.

**추가 import:** `import java.util.List;` (기존에 `ArrayList`만 import되어 있음)

```java
/** 컴팩션 크기 허용 비율 (10% 여유) */
private static final double COMPACTION_SIZE_TOLERANCE = 1.1;

/**
 * 컴팩션된 스냅샷으로 기존 ydocSnapshot을 교체한다.
 * 크기 비교 검증을 수행하여 컴팩션 결과가 기존보다 큰 경우 거부한다.
 *
 * @param diagramId        다이어그램 ID
 * @param compactedUpdate  클라이언트가 전송한 컴팩션 바이트 (단일 Yjs update)
 * @return 교체 성공 여부
 */
@Transactional
public boolean replaceSnapshot(Long diagramId, byte[] compactedUpdate) {
    final var existingSnapshot = diagramRepository.findYdocSnapshotById(diagramId).orElse(null);
    final var existingSize = (existingSnapshot != null) ? existingSnapshot.length : 0;

    // 단일 update를 YLPF 포맷으로 래핑
    final var compactedSnapshot = YjsUpdateFormat.encode(List.of(compactedUpdate));

    // 크기 비교 검증: 컴팩션 결과가 기존보다 크면 거부
    if (existingSize > 0 && compactedSnapshot.length > existingSize * COMPACTION_SIZE_TOLERANCE) {
        log.warn(
            "컴팩션 거부: 크기 증가 (diagramId={}, existing={}B, compacted={}B)",
            diagramId, existingSize, compactedSnapshot.length
        );
        return false;
    }

    final var updated = diagramRepository.updateYdocSnapshotById(diagramId, compactedSnapshot);
    if (updated == 0) {
        log.warn("컴팩션 실패: 다이어그램 미존재 (id={})", diagramId);
        return false;
    }

    log.info(
        "Y.Doc 스냅샷 컴팩션 완료: diagramId={}, before={}B, after={}B ({}% 감소)",
        diagramId, existingSize, compactedSnapshot.length,
        existingSize > 0 ? (100 - compactedSnapshot.length * 100 / existingSize) : 0
    );
    return true;
}
```

---

## Step 3. BE — `DiagramWebSocketHandler`에 컴팩션 핸들러 추가

**파일:** `DiagramWebSocketHandler.java`

### 3-1. switch 분기 추가

`handleBinaryMessage`의 switch에 `MSG_COMPACTED_SNAPSHOT` 케이스 추가:

```java
case MSG_COMPACTED_SNAPSHOT -> handleCompaction(info.diagramId(), payload);
```

### 3-2. `handleCompaction()` private 메서드 추가

```java
/**
 * 클라이언트로부터 컴팩션된 스냅샷을 수신하여 교체한다.
 * flush 락 안에서 단독 접속 재확인 + 누적 update drain + 스냅샷 교체를 수행한다.
 *
 * @param diagramId 다이어그램 ID
 * @param payload   전체 메시지 payload (타입 바이트 포함)
 */
private void handleCompaction(Long diagramId, byte[] payload) {
    final var compactedUpdate = Arrays.copyOfRange(payload, 1, payload.length);
    if (compactedUpdate.length == 0) {
        return;
    }

    // flush 락 획득 → 단독 접속 재확인 → 누적 update drain → 컴팩션 스냅샷으로 교체
    // TOCTOU 방지: getSessionCount() 체크를 flushLock 안에서 수행하여
    // 체크-드레인 사이에 새 사용자 join + appendUpdate로 인한 데이터 유실을 방지한다.
    synchronized (roomManager.getFlushLock(diagramId)) {
        // 단독 접속 재확인 (클라이언트가 전송 후 다른 사용자가 접속한 경우 방어)
        if (roomManager.getSessionCount(diagramId) != 1) {
            log.info("컴팩션 거부: 단독 접속 아님 (diagramId={}, sessions={})",
                diagramId, roomManager.getSessionCount(diagramId));
            return;
        }

        // drain: 컴팩션 시점까지의 누적 update를 모두 제거
        // 단독 접속이므로 본인의 pending update만 있음. 컴팩션에 이미 포함됨
        final var mergedUpdates = roomManager.drainAndMergeUpdates(diagramId);

        try {
            final var success = snapshotService.replaceSnapshot(diagramId, compactedUpdate);
            if (!success) {
                // 크기 검증 실패 또는 다이어그램 미존재: drain된 update 복원
                restoreDrainedUpdates(diagramId, mergedUpdates);
            }
        } catch (Exception e) {
            restoreDrainedUpdates(diagramId, mergedUpdates);
            log.error("컴팩션 실패, drain된 update 복원 (diagramId={})", diagramId, e);
        }
    }
}
```

### 3-3. drain 복원은 `DiagramRoomManager.restoreUpdates()` 사용

`handleCompaction`에서 drain 실패 시 `roomManager.restoreUpdates(diagramId, mergedUpdates)`를 호출한다.
`restoreUpdates()`는 `DiagramRoomManager`에 공통 메서드로 추출되어 `flushSingleDiagram`과 `handleCompaction` 양쪽에서 사용한다.

**핵심 흐름:**
1. `flushLock` 획득 (Scheduled flush / 연결 종료 flush와 레이스 방지)
2. 락 안에서 `getSessionCount() != 1` → 거부 (TOCTOU 방지)
3. `drainAndMergeUpdates()` — 단독 접속이므로 본인의 pending update만 있음. 컴팩션에 이미 포함되어 있으므로 drain해서 버림
4. `replaceSnapshot()` — 크기 검증 + DB UPDATE
5. 실패 시(false 반환 또는 예외) `roomManager.restoreUpdates()` — drain된 update 복원

---

## Step 4. FE — `WS_MSG_TYPE` 상수 추가

**파일:** `client/src/constants/ws.ts`

```typescript
/** Compacted snapshot (클라이언트 → 서버, 스냅샷 교체 요청) */
COMPACTED_SNAPSHOT: 0x08,
```

---

## Step 5. FE — `YjsProvider`에 컴팩션 요청 메서드 추가

**파일:** `client/src/collaboration/YjsProvider.ts`

### 5-1. `requestCompaction()` public 메서드 추가

```typescript
/**
 * 사전 인코딩된 Y.Doc 전체 상태를 서버에 컴팩션 요청으로 전송한다.
 * 호출 측에서 Y.encodeStateAsUpdate()를 한 번만 실행하여 이중 인코딩을 방지한다.
 * 서버는 기존 ydocSnapshot을 이 압축 데이터로 교체한다.
 *
 * @param encodedState Y.encodeStateAsUpdate()로 사전 인코딩된 바이트 배열
 */
requestCompaction(encodedState: Uint8Array): void {
  this.sendMessage(WS_MSG_TYPE.COMPACTED_SNAPSHOT, encodedState);
}
```

### 5-2. `handleMessage()`에 컴팩션 결과 응답 처리는 불필요

설계서 방안 B에서 서버는 결과를 응답하지 않고 교체만 수행한다. 클라이언트는 fire-and-forget.

---

## Step 6. FE — `useSnapshotCompaction` 훅 신규 생성

**파일:** `client/src/hooks/useSnapshotCompaction.ts`

접속 시 스냅샷 크기가 임계치 초과 + 단독 접속 → 자동 컴팩션을 트리거하는 훅.

```typescript
import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import type { YjsProvider } from '@/collaboration/YjsProvider';
import useCollaborationStore from '@/stores/useCollaborationStore';

/** 컴팩션 트리거 크기 임계치 (bytes) — YLPF 오버헤드 감안 500 updates × ~200B */
const COMPACTION_SIZE_THRESHOLD = 100_000;

/** 컴팩션 지연 시간 (ms) — sync 완료 대기 */
const COMPACTION_DELAY = 5000;

/**
 * 스냅샷 크기가 임계치를 초과하고 단독 접속일 때 자동 컴팩션을 실행하는 훅.
 *
 * @param providerRef YjsProvider 참조
 */
export function useSnapshotCompaction(
  providerRef: React.RefObject<YjsProvider | null>,
): void {
  const compactedRef = useRef(false);
  const remoteCursors = useCollaborationStore((s) => s.remoteCursors);

  useEffect(() => {
    const provider = providerRef.current;
    if (!provider || compactedRef.current) return;

    // 단독 접속 확인 (원격 peer가 없어야 함)
    if (remoteCursors.size > 0) return;

    const timer = setTimeout(() => {
      const currentProvider = providerRef.current;
      if (!currentProvider || !currentProvider.isSynced()) return;

      // 현재 Y.Doc 크기 확인 + 컴팩션 전송을 한 번의 인코딩으로 처리
      const fullState = Y.encodeStateAsUpdate(currentProvider.doc);
      if (fullState.byteLength < COMPACTION_SIZE_THRESHOLD) return;

      // 단독 접속 재확인 (지연 시간 동안 다른 사용자가 접속했을 수 있음)
      const currentCursors = useCollaborationStore.getState().remoteCursors;
      if (currentCursors.size > 0) return;

      // 사전 인코딩된 fullState를 직접 전달하여 이중 인코딩 방지
      currentProvider.requestCompaction(fullState);
      compactedRef.current = true;
    }, COMPACTION_DELAY);

    return () => clearTimeout(timer);
  }, [providerRef, remoteCursors.size]);
}
```

**트리거 조건 (모두 충족 시):**
1. sync 완료 (`isSynced() === true`)
2. `Y.encodeStateAsUpdate(doc).byteLength >= 100KB`
3. `remoteCursors.size === 0` (원격 peer 없음 = 단독 접속)
4. 이번 세션에서 아직 컴팩션 미실행 (`compactedRef`)

**COMPACTION_DELAY 5초 이유:** 접속 직후 SNAPSHOT_RESPONSE + SYNC_STEP2 수신이 완료된 후 정확한 Y.Doc 크기를 측정하기 위함.

---

## Step 7. FE — `useYjsCollaboration`에서 `useSnapshotCompaction` 호출

**파일:** `client/src/hooks/useYjsCollaboration.ts`

```typescript
import { useSnapshotCompaction } from '@/hooks/useSnapshotCompaction';

// 기존 return 직전에 추가
useSnapshotCompaction(providerRef);

return { providerRef };
```

---

## Step 8. i18n — 컴팩션 관련 키는 불필요

컴팩션은 백그라운드 자동 실행이므로 토스트나 UI 텍스트가 없다. i18n 변경 없음.

---

## 수정 파일 요약

| 파일 | 작업 |
|------|------|
| `DiagramWebSocketHandler.java` | `MSG_COMPACTED_SNAPSHOT` 상수 + switch 분기 + `handleCompaction()` |
| `DiagramSnapshotService.java` | `COMPACTION_SIZE_TOLERANCE` 상수 + `replaceSnapshot()` 메서드 |
| `client/src/constants/ws.ts` | `COMPACTED_SNAPSHOT: 0x08` 추가 |
| `client/src/collaboration/YjsProvider.ts` | `requestCompaction()` public 메서드 |
| `client/src/hooks/useSnapshotCompaction.ts` | **신규** — 자동 컴팩션 트리거 훅 |
| `client/src/hooks/useYjsCollaboration.ts` | `useSnapshotCompaction()` 호출 추가 |

---

## 검증

```bash
# BE 컴파일
./gradlew compileJava

# FE 빌드 + 린트
cd client && npm run build && npm run lint
```

### 수동 테스트 시나리오

1. 다이어그램에 다수의 편집을 반복하여 update를 누적
2. 브라우저 새로고침 → 단독 접속 + 5초 후 컴팩션 자동 실행 확인 (서버 로그: "Y.Doc 스냅샷 컴팩션 완료")
3. 다시 새로고침 → 스냅샷 크기 감소 확인 (임계치 미만이면 컴팩션 미실행)
4. 다중 사용자 접속 시 컴팩션이 실행되지 않는지 확인
