# 다이어그램 저장 전략 설계안 (Yjs CRDT 기반)

## 폐기 사유 — 이전 설계와의 차이

이전 설계("Delta Save — Op 기반")는 Yjs 실시간 협업 기능 구현 전에 작성되었다.
Yjs CRDT 도입으로 다음 전제가 무효화되었으므로 전면 재작성한다.

| 이전 설계 전제 | 현재 상태 | 판단 |
|---------------|-----------|------|
| REST로 delta(op) 전송 | Yjs update가 WebSocket으로 실시간 전파 | 이중 구현 |
| `revision` + `409 Conflict` | CRDT가 충돌을 자동 병합 | 패러다임 충돌 |
| 서버가 op을 파싱·적용 | 서버는 Yjs 바이너리를 해석 없이 relay | 불필요한 복잡도 |
| `content` JSON이 유일한 저장소 | `ydocSnapshot` BYTEA가 primary 저장소 | 역할 역전 |

## 목적

- 현재 Yjs + WebSocket 실시간 동기화 아키텍처 위에서 **저장 안정성**을 확보한다.
- `ydocSnapshot`(BYTEA)과 `content`(TEXT) 두 컬럼의 **역할과 라이프사이클**을 명확히 정의한다.
- **데이터 유실 가능 구간**을 식별하고 허용 범위를 결정한다.
- Ctrl+S 수동 저장의 역할을 재정의한다.

## 현재 아키텍처 요약

### 데이터 흐름

```text
[클라이언트 A]                    [서버]                         [클라이언트 B]
    │                              │                                │
    │  Y.Doc 편집                   │                                │
    │  → Y.Doc.update 이벤트        │                                │
    │  → WS 전송 (0x03 YJS_UPDATE) │                                │
    │ ─────────────────────────► │                                │
    │                              │  appendUpdate() 메모리 누적      │
    │                              │  broadcast() relay              │
    │                              │ ──────────────────────────────► │
    │                              │                                │  Y.applyUpdate(remote)
    │                              │                                │  → Zustand 동기화
    │                              │                                │
    │                              │  [30초 주기 @Scheduled]         │
    │                              │  flushDirtySnapshots()         │
    │                              │  → drain + DB UPDATE           │
    │                              │    (ydocSnapshot BYTEA)        │
```

### 저장소 이원 구조

| 컬럼 | 타입 | 역할 | 갱신 시점 | 소스 |
|------|------|------|----------|------|
| `ydocSnapshot` | BYTEA | **Primary** — Yjs 바이너리 상태 | 30초 주기 + 마지막 퇴장 시 | WebSocket 누적 update |
| `content` | TEXT | **Backup** — React Flow JSON | Ctrl+S 수동 저장 시만 | `serialize()` 전체 직렬화 |

### 현재 문제점

1. **30초 유실 구간**: 서버 크래시 시 메모리 누적 update 최대 30초분 손실
2. **`content` 동기화 안 됨**: Ctrl+S를 누르지 않으면 `content`가 `ydocSnapshot`과 영구 괴리
3. **`content`의 역할 모호**: 레거시 저장소인데 REST API(`saveDiagram`)가 여전히 전체 JSON 저장
4. **이중 SSOT**: 신규 다이어그램은 `ydocSnapshot`이 SSOT, 레거시는 `content`가 SSOT → 로딩 시 분기 필요
5. **`isDirty` 오탐**: 원격 변경(다른 사용자 편집)에도 `isDirty: true`가 설정됨 → 백업 생략 최적화 불가

## 설계 원칙

1. **`ydocSnapshot`이 유일한 SSOT** — `content`는 읽기 전용 백업으로 격하
2. **Yjs 이진 프로토콜에 대한 서버 무해석 원칙 유지** — 서버는 relay + 저장만 담당
3. **Ctrl+S는 "JSON 백업 동기화"** — `ydocSnapshot` → `content` 변환 저장
4. **유실 허용 범위 명시** — flush 주기만큼의 유실을 허용, 주기 조절로 트레이드오프 관리

## 데이터 모델

### 변경 없음

현재 `Diagram` 엔티티 그대로 사용한다. `revision` 컬럼은 추가하지 않는다.

```java
// Diagram.java (변경 없음)
@Column(columnDefinition = "TEXT")
private String content;               // JSON 백업

@Basic(fetch = FetchType.LAZY)
@Column(columnDefinition = "BYTEA")
private byte[] ydocSnapshot;          // Yjs SSOT
```

## 선행 수정 — `isDirty` 제거 + `needsBackup()` 도입

### 문제

현재 `isDirty`는 `onNodesChange` / `onEdgesChange`에서 **무조건 true**로 설정된다.
원격 사용자의 편집이 Y.Doc → `observeDeep` → Zustand `set({ nodes })` → React Flow 리렌더 →
`onNodesChange` 발생 → `isDirty: true`로 이어져, 내가 편집하지 않아도 dirty가 된다.

이 문제가 해결되지 않으면 Phase 1~2의 "변경 없으면 백업 생략" 최적화가 무의미해진다.

또한 Yjs가 실시간으로 `ydocSnapshot`에 저장하는 아키텍처에서 "미저장 상태(unsaved)"라는 개념 자체가
의미를 잃었다. `isDirty: true`가 표시되면 사용자가 "저장 안 됨"으로 오해하지만,
실제로는 Yjs가 30초 주기로 DB에 저장하고 있다. `needsBackup()`으로 대체하면
`isDirty`와 `needsBackup()`이 이원화되어 "변경됨이라고 표시하면서 저장은 안 된다"는
UX 혼란이 발생한다. 따라서 **`isDirty`를 완전 제거**한다.

### 해결 방안 — `lastBackupHash` 비교 방식

`isDirty` 플래그 대신, 마지막 백업 시점의 `serialize()` 결과 해시와 현재 해시를 비교한다.

```typescript
// useCanvasStore.ts 확장
lastBackupHash: string;               // 마지막 백업 시점의 serialize() 해시 (initYDoc에서 초기화)
computeBackupHash: () => string;      // 현재 상태의 해시 계산
needsBackup: () => boolean;           // lastBackupHash !== computeBackupHash()
markBackedUp: (hash: string) => void; // lastBackupHash = hash (무조건 갱신, backupMutex로 직렬화되므로 조건부 검사 불필요)
```

**Ctrl+S / 자동 백업 흐름:**

```text
1. result = prepareBackup()  → null이면 백업 불필요, 종료
2. result.content → REST PUT
3. 성공 시 markBackedUp(result.hash)
```

**`prepareBackup()` 통합 진입점 (serialize 이중 호출 방지):**

`computeBackupHash()`와 `serialize()`가 내부에서 동일한 `yDocToJson()` → JSON 변환을 수행하므로,
별도로 호출하면 Y.Doc 전체를 2회 순회하게 된다. 이를 방지하기 위해 단일 진입점으로 통합한다:

```typescript
prepareBackup: () => { content: string; hash: string } | null;
// 1. content = serialize()
// 2. hash = djb2(content)
// 3. hash === lastBackupHash이면 null 반환 (변경 없음)
// 4. 아니면 { content, hash } 반환
```

이로써 `serialize()` 1회 호출로 백업 데이터와 해시를 동시에 얻는다.
`needsBackup()` / `computeBackupHash()` 개별 메서드는 유지하되, 실제 백업 흐름에서는 `prepareBackup()`만 사용한다.

**해시 함수:** 전체 serialize() 결과의 문자열 해시 (간단한 djb2 등). 정확한 비교가 필요하면 JSON 문자열 자체를 저장해도 되지만, 메모리 관점에서 해시가 효율적.

**`lastBackupHash` 초기화:** `initYDoc()` 완료 후 현재 상태의 해시로 초기화한다.
초기화하지 않으면(`""`) 페이지 로드 직후 첫 `prepareBackup()` 호출 시 DB의 `content`가 이미 최신이어도
불필요한 REST PUT이 발생한다. `initYDoc` 내부에서 `serialize()` 1회로 초기 해시를 설정하여 방지한다.

```typescript
initYDoc: (ydoc) => {
  // ... observer 등록 ...
  const initialHash = djb2(yDocToJson(ydoc));
  set({ lastBackupHash: initialHash });
};
```

**호출 시점 제한 (성능 주의):** `computeBackupHash()`는 내부에서 `serialize()` → `yDocToJson()`을 실행하므로
Y.Doc의 모든 테이블·엣지를 순회한다. 테이블 50개×컬럼 10개 규모에서 수백 개의 Y.Map 순회가 발생한다.
따라서 **Ctrl+S 이벤트와 자동 백업 타이머(Phase 2)에서만 호출**한다.
`onNodesChange`/`onEdgesChange` 등 빈번한 이벤트에서는 절대 호출하지 않는다.

**대안 — origin 구분 방식:**

`observeDeep` 콜백에서 Yjs transaction의 origin을 확인하여, `'remote'` origin인 경우
isDirty를 설정하지 않는 방식도 가능하다. 그러나 `onNodesChange`/`onEdgesChange`는
React Flow의 콜백이므로 origin 정보가 전파되지 않아 적용이 어렵다.
따라서 `lastBackupHash` 비교 방식을 채택한다.

### 구현 위치

- `useCanvasStore.ts` — `lastBackupHash`, `computeBackupHash()`, `needsBackup()`, `markBackedUp()`, `prepareBackup()` 추가
- `DiagramPage.tsx` — `handleSave`에서 `prepareBackup()` null이면 생략, `isDirty`/`markClean` 참조 제거
- `useYjsCollaboration.ts` — `markClean()` 호출 삭제
- `Header.tsx` — `isDirty` prop 수신 및 unsaved 마커 UI 제거
- `useAutoBackup.ts` (Phase 2) — 동일하게 `prepareBackup()` 사용

## 개선 사항

### 1. Ctrl+S 동작 변경 — JSON 백업 동기화

**현재**: `serialize()` → REST `PUT` → `diagram.content` 전체 교체
**변경 후**: `serialize()` → REST `PUT` → `diagram.content` 교체 (동일하지만 의미 재정의)

Ctrl+S의 역할을 "저장"에서 **"JSON 백업 동기화"**로 재정의한다.
실제 다이어그램 상태는 Yjs가 실시간 관리하고 있으므로, Ctrl+S는 `content` JSON을 최신 상태로 맞추는 역할만 한다.

**프론트 변경:**

- `prepareBackup() === null`이면 API 호출 자체를 생략 (불필요한 네트워크 방지)
- 저장 성공 토스트 메시지를 "저장 완료" → "백업 완료"로 변경

### 2. 자동 JSON 백업 — 클라이언트 주도

프론트에서 일정 주기(5분)마다 `serialize()` → REST `PUT` 자동 호출한다.
서버 변경 없이 구현 가능하며, `prepareBackup()`이 null이면 호출을 생략한다.

**자동/수동 백업 레이스 방어:**

5분 주기 자동 백업과 사용자 Ctrl+S가 동시에 실행될 수 있다.
두 요청이 서로 다른 시점의 `serialize()` 결과를 보내므로, 나중에 완료되는 요청이
서버 `content`를 이전 상태로 덮어쓸 위험이 있다.

방어 전략:
1. `useAutoBackup`에서 `saveMutation.isPending`이면 자동 백업을 생략한다.
2. `markBackedUp(hash)`는 `lastBackupHash = hash`로 무조건 갱신한다.
   `backupMutex` ref로 백업이 직렬화되므로 out-of-order 완료가 불가하고,
   REST 호출 중 편집이 발생해도 다음 `prepareBackup()`에서 해시 불일치로 재백업된다.
   조건부 검사(`hash === computeBackupHash()`)를 제거하여 불필요한 `serialize()` 추가 호출을 방지한다.

**서버 측 @Scheduled flush 시 content 동기화 대안:**

```text
flushDirtySnapshots()
  └─ flushSingleDiagram(id)
       ├─ DB UPDATE ydocSnapshot  (기존)
       └─ DB UPDATE content       (추가 — ydocSnapshot → Y.Doc → JSON 변환)
```

이 방식은 서버에서 Yjs 바이너리를 JSON으로 변환해야 하므로 Yjs 라이브러리(Java)가 필요하다.
Java Yjs 구현체가 없으므로 **클라이언트 주도 자동 백업을 채택**한다.

### 3. flush 주기 조절 — 유실 허용 범위 관리

| 설정값 | 유실 허용 | CPU/IO 부하 | 권장 상황 |
|--------|----------|-------------|----------|
| 10초 | 최대 10초 | 높음 | 실시간성 중시 |
| 30초 (현재) | 최대 30초 | 보통 | 범용 (기본값) |
| 60초 | 최대 60초 | 낮음 | 리소스 절약 |

`application.yml`의 `smart-erd.websocket.snapshot-flush-interval`로 조절 가능.

### 4. 다이어그램 로딩 최적화 — `hasYdocSnapshot` 플래그

현재 `useYjsCollaboration`의 로딩 순서:

```text
1. REST GET /diagrams/{id} → diagram.content (JSON) 수신
2. content가 있으면 migrateJsonToYDoc(ydoc, content) — 레거시 호환
3. WS 연결 → SNAPSHOT_REQUEST → ydocSnapshot 수신 → Y.applyUpdate
4. WS sync step 1/2 → 다른 클라이언트와 diff 교환
```

**문제:** `ydocSnapshot`이 존재하는 다이어그램에서도 2단계가 실행된다.
`content`와 `ydocSnapshot`이 동일한 데이터를 담고 있으면, 2단계 마이그레이션 + 3단계 스냅샷이
CRDT 특성으로 병합되어 데이터 유실은 없지만, **Yjs 내부 히스토리가 불필요하게 부풀어**난다.
이는 Phase 5 컴팩션 전까지 스냅샷 크기를 필요 이상으로 키운다.

**해결:**

- `DiagramDetailResponse`에 `hasYdocSnapshot: boolean` 필드 추가
- `hasYdocSnapshot === true`면 `migrateJsonToYDoc` 생략 (불필요한 JSON 파싱 + Y.Doc 히스토리 오염 방지)
- `hasYdocSnapshot === true`이고 로딩 최적화 시, `content` 필드를 응답에서 제외 가능 (대용량 JSON 전송 방지)

**BE 변경:**

`getYdocSnapshot()`을 호출하면 `@Basic(fetch = LAZY)` 프록시가 초기화되어 BYTEA 전체가 로딩된다.
이를 방지하기 위해 `DiagramRepositoryCustom`에 존재 여부만 확인하는 projection 쿼리를 추가한다.

```java
// DiagramRepositoryCustom — 추가
boolean existsYdocSnapshotById(Long id);

// DiagramRepositoryCustomImpl — 추가
@Override
public boolean existsYdocSnapshotById(Long id) {
    final var result = queryFactory
        .select(diagram.ydocSnapshot.isNotNull())
        .from(diagram)
        .where(diagram.id.eq(id))
        .fetchOne();
    return Boolean.TRUE.equals(result);
}
```

`DiagramDetailResponse.from()`에서는 엔티티의 `getYdocSnapshot()`을 호출하지 않고,
별도 파라미터로 `hasYdocSnapshot`을 전달받는다.

```java
// DiagramDetailResponse.java
public record DiagramDetailResponse(
    Long id,
    String name,
    Long projectId,
    String content,
    boolean hasYdocSnapshot,  // 추가
    Instant createdAt,
    Instant updatedAt
) {
    public static DiagramDetailResponse from(Diagram diagram, Long projectId, boolean hasYdocSnapshot) {
        return new DiagramDetailResponse(
            diagram.getId(),
            diagram.getName(),
            projectId,
            diagram.getContent(),
            hasYdocSnapshot,
            diagram.getCreatedAt(),
            diagram.getUpdatedAt()
        );
    }
}

// DiagramService.getDiagram() — 변경
public DiagramDetailResponse getDiagram(String loginId, Long teamId, Long projectId, Long diagramId) {
    final var project = verifyAccess(loginId, teamId, projectId);
    final var diagram = findDiagramByProjectAndId(project, diagramId);
    final var hasSnapshot = diagramRepository.existsYdocSnapshotById(diagramId);
    return DiagramDetailResponse.from(diagram, project.getId(), hasSnapshot);
}
```

**FE 변경:**

```typescript
// types/diagram.ts
export interface DiagramDetail extends DiagramSummary {
  content: string | null;
  hasYdocSnapshot: boolean;  // 추가
}

// useYjsCollaboration.ts
if (diagram.content && !diagram.hasYdocSnapshot) {
  migrateJsonToYDoc(ydoc, diagram.content);
}
```

**LAZY 프록시 안전성:** 위 설계에서 `DiagramDetailResponse.from()`은 `hasYdocSnapshot`을 외부 파라미터로 받으므로
`diagram.getYdocSnapshot()`을 호출하지 않는다. `existsYdocSnapshotById()`는 QueryDSL projection으로
`ydocSnapshot IS NOT NULL` 여부만 확인하므로 BYTEA 전체 로딩이 발생하지 않는다.

**`IS NOT NULL` 검증의 충분성:** `saveSnapshotWithUpdates()`와 `flushSingleDiagram()`은 빈 배열(`length == 0`)일 때
저장을 건너뛰므로, DB에 `ydocSnapshot`이 존재하면 반드시 1바이트 이상의 유효한 데이터다.
따라서 `IS NOT NULL`만으로 "유효한 스냅샷 존재"를 판단할 수 있으며, `length > 0` 추가 검사는 불필요하다.
이 불변 조건(invariant)은 `DiagramSnapshotService`의 저장 메서드들이 보장한다.

### 5. 스냅샷 컴팩션

현재 `COMPACTION_WARN_THRESHOLD = 500` 경고만 있고 실제 컴팩션은 없다.
누적 update가 증가하면 스냅샷 크기와 로딩 시간이 선형 증가한다.

**컴팩션 전략:**

서버에서 Yjs 바이너리를 해석할 수 없으므로, 클라이언트가 컴팩션을 수행한다:

```text
1. 클라이언트: Y.encodeStateAsUpdate(doc) → 전체 상태를 단일 update로 압축
2. 새 WS 메시지 타입 0x08 (COMPACTED_SNAPSHOT) 추가
3. 서버: ydocSnapshot을 수신한 단일 update로 교체
4. 트리거: 접속 시 스냅샷 크기가 임계치 초과 시 클라이언트가 자동 실행
```

**동시 편집 시 데이터 무결성 보장:**

서버가 `ydocSnapshot`을 교체하는 동안 `appendUpdate()`로 새 update가 누적될 수 있다.
교체 시점에 flush되지 않은 `accumulatedUpdates` 데이터가 유실될 위험이 있다.

대응 방안 (택 1):

- **방안 A — flush 락 획득 후 교체**: 컴팩션 메시지 수신 시 `flushLock` 획득 → `accumulatedUpdates` drain → 컴팩션 스냅샷과 병합 → `ydocSnapshot` 교체. 다른 사용자의 편집도 안전하게 포함.
- **방안 B — 단독 접속 시만 허용**: 방 접속자가 1명(본인)일 때만 컴팩션 실행. 다른 사용자의 동시 편집이 없으므로 `accumulatedUpdates`에 외부 update가 쌓이지 않음. 구현이 단순하고 안전.

**권장:** 방안 B를 기본으로 채택하고, 멀티 유저 환경에서 컴팩션이 필요해지면 방안 A로 확장.

**컴팩션 메시지 검증 (서버 측):**

서버는 Yjs 바이너리를 해석하지 않으므로 완전한 유효성 검증은 불가하지만,
악의적/잘못된 컴팩션 데이터로 스냅샷이 corrupt되는 것을 최소한으로 방어한다:

1. **크기 비교 검증**: 컴팩션은 데이터를 압축하는 것이므로, 결과가 기존 스냅샷보다 커서는 안 된다.
   `compactedSize > existingSnapshotSize * 1.1`이면 거부 (10% 여유 허용).
2. **단독 접속 재확인**: 메시지 수신 시점에 방 접속자가 1명인지 서버에서 재검증.
   클라이언트가 전송 후 다른 사용자가 접속한 경우를 방어한다.
3. **방안 B 자체의 방어 효과**: 공격자가 유일한 접속자여야 하므로 다른 사용자에 대한 즉각적 피해는 제한됨.
   단, 이후 접속자가 corrupt된 스냅샷을 로딩할 위험은 있으므로 크기 검증이 기본 방어선이다.

## 구현 계획

### Phase 0 — `isDirty` 제거 + `needsBackup()` 도입 (선행 필수)

- [ ] `useCanvasStore`에 `lastBackupHash`, `computeBackupHash()`, `needsBackup()`, `markBackedUp()`, `prepareBackup()` 추가
- [ ] `DiagramPage.tsx`의 `handleSave`에서 `prepareBackup()` null이면 호출 생략
- [ ] `isDirty` 플래그 및 `markClean()` 완전 제거 — Yjs가 실시간 저장하므로 "미저장 상태" 개념 불필요
- [ ] 헤더의 unsaved 마커 제거, `connectionStatus`로 연결 상태만 표시
- [ ] `onNodesChange`/`onEdgesChange`에서 `isDirty: true` 설정 코드 삭제

### Phase 1 — Ctrl+S 최적화 (즉시, Phase 0 이후)

- [ ] Ctrl+S에서 `prepareBackup()` null이면 API 호출 생략 + "변경 없음" 토스트
- [ ] 토스트 메시지 변경: "저장 완료" → "백업 동기화 완료"
- [ ] i18n 키 수정 (`diagram.toast.saved` → 백업 의미로 변경)

### Phase 2 — 클라이언트 자동 백업 (단기)

- [ ] 프론트: 5분 주기 자동 `prepareBackup()` → non-null이면 REST PUT
- [ ] `useAutoBackup` 커스텀 훅 추출
- [ ] 자동 백업 성공 시 토스트 없이 `markBackedUp()`만 호출
- [ ] 자동/수동 백업 동시 실행 방어: `saveMutation.isPending`일 때 자동 백업 생략 + `backupMutex` ref로 직렬화
- [ ] `markBackedUp(hash)`는 `lastBackupHash = hash` 무조건 갱신 (`backupMutex`로 직렬화되므로 조건부 검사 불필요, `serialize()` 추가 호출 방지)

### Phase 3 — 로딩 최적화 (단기, Phase 1과 병행 가능)

- [ ] `DiagramRepositoryCustom`에 `existsYdocSnapshotById(Long id): boolean` 추가 (projection 쿼리, LAZY 프록시 초기화 방지)
- [ ] `DiagramDetailResponse`에 `hasYdocSnapshot: boolean` 필드 추가, `from()`에 파라미터로 전달
- [ ] `DiagramService.getDiagram()`에서 `existsYdocSnapshotById()` 호출 후 `from()`에 전달
- [ ] FE `DiagramDetail` 타입에 `hasYdocSnapshot` 추가
- [ ] `useYjsCollaboration`에서 `hasYdocSnapshot === true`면 `migrateJsonToYDoc` 생략
- [ ] `hasYdocSnapshot === true`일 때 `content` 필드 응답 제외 가능 (대용량 JSON 전송 방지, 선택적)

### Phase 4 — 스냅샷 컴팩션 (중기)

- [ ] 새 WS 메시지 타입 `0x08 COMPACTED_SNAPSHOT` 추가 (FE 상수 + BE 핸들러)
- [ ] 클라이언트: 접속 시 스냅샷 크기 임계치 초과 + 방 접속자 1명 → `Y.encodeStateAsUpdate()` → 서버 전송
- [ ] 서버 검증: 크기 비교 (`compactedSize > existingSize * 1.1`이면 거부) + 단독 접속 재확인
- [ ] 서버: `flushLock` 획득 → `accumulatedUpdates` drain → 컴팩션 스냅샷으로 `ydocSnapshot` 교체
- [ ] 컴팩션 실행 로그 및 크기 변화 기록

## content 컬럼 장기 전략

| 시점 | content 역할 | 비고 |
|------|-------------|------|
| 현재 | 레거시 SSOT + 수동 백업 | `ydocSnapshot`이 없는 기존 다이어그램 호환 |
| Phase 2 완료 후 | 자동 갱신 백업 | 5분 주기로 최신 상태 유지 |
| 전체 마이그레이션 후 | 읽기 전용 내보내기 | 모든 다이어그램에 `ydocSnapshot` 존재 보장 시 |
| 최종 (선택) | 컬럼 제거 | 내보내기를 별도 API로 분리 시 |

`content` 컬럼 제거는 **모든 기존 다이어그램이 한 번이라도 Yjs 기반으로 열려서 `ydocSnapshot`이 생성된 이후**에만 가능하다.
마이그레이션 스크립트를 작성하거나, 자연적으로 사용자가 열 때까지 대기하는 전략 중 선택.

## 리스크와 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 서버 크래시 시 메모리 update 유실 | 최대 flush 주기만큼 데이터 손실 | flush 주기 단축 (10~30초), 중요도에 따라 결정 |
| `ydocSnapshot` 바이너리 무결성 | 손상 시 복구 불가 | `content` JSON 백업 유지로 최후 방어선 확보 |
| 스냅샷 크기 무한 증가 | 로딩 시간 증가, DB 용량 | Phase 4 컴팩션으로 해결 |
| `content`와 `ydocSnapshot` 괴리 | 사용자 혼란 (어느 게 최신?) | Phase 2 자동 백업으로 괴리 최소화, UI에서 SSOT 명시 |
| Java에서 Yjs 바이너리 해석 불가 | 서버 단독 JSON 변환 불가 | 클라이언트 주도 전략 채택 (serialize + REST) |
| 컴팩션 중 동시 편집 시 데이터 유실 | 누적 update가 교체로 소실 | 단독 접속 시만 컴팩션 허용 (방안 B), 필요 시 flushLock 방식으로 확장 (방안 A) |
| `hasYdocSnapshot` 조회 시 LAZY 초기화 | 불필요한 BYTEA 로딩 | `existsYdocSnapshotById()` projection 쿼리 + `from()`에 파라미터 전달 |
| `computeBackupHash()` 호출 비용 | Y.Doc 전체 순회로 성능 저하 | Ctrl+S와 자동 백업 타이머에서만 호출, 빈번한 이벤트에서 호출 금지 |
| 자동/수동 백업 레이스 컨디션 | `content`가 이전 상태로 덮어씌워짐 | `saveMutation.isPending` 체크 + `backupMutex` ref 직렬화 + `markBackedUp(hash)` 무조건 갱신 |
| 컴팩션 메시지로 스냅샷 corrupt | 악의적/잘못된 바이너리로 교체 | 크기 비교 검증 + 단독 접속 서버 재확인 |

## 테스트 계획

### Phase 0

- 로컬 편집 후 `needsBackup()`이 true로 전환되는지 확인
- 원격 변경 수신 후에도 `needsBackup()`이 true가 되는지 확인 (`content` 백업이 실제로 stale)
- `markBackedUp()` 후 `needsBackup()`이 false로 복귀하는지 확인
- 원격 변경만 있는 상태에서 Ctrl+S → `prepareBackup()` non-null → REST PUT 정상 실행 확인
- `prepareBackup()` → REST PUT → `markBackedUp(hash)` 후 `needsBackup()` false 복귀 확인
- `isDirty` 및 `markClean()` 제거 후 빌드 성공 확인
- 헤더에 unsaved 마커 대신 `connectionStatus`만 표시되는지 확인

### Phase 1

- `needsBackup()` false 시 API 호출이 발생하지 않는지 확인
- `needsBackup()` true 시 정상 저장 후 `markBackedUp()` 호출 확인
- 토스트 메시지가 "백업 동기화 완료"로 표시되는지 확인

### Phase 2

- 5분 주기 자동 백업 실행 확인
- `needsBackup()` false 시 자동 백업 생략 확인
- 수동 Ctrl+S 진행 중 자동 백업 타이머 발동 → 자동 백업 생략 확인 (`saveMutation.isPending` 체크)
- 자동 백업 완료 직후 사용자 편집 → `markBackedUp(hash)`로 `lastBackupHash` 갱신 후, 다음 `prepareBackup()`에서 편집분이 감지되어 non-null 반환 확인
- 동시 실행 후 서버 `content`가 최신 상태인지 확인

### Phase 3

- `hasYdocSnapshot: true`일 때 `migrateJsonToYDoc` 미실행 확인
- `hasYdocSnapshot: false`일 때 기존 content 마이그레이션 정상 동작 확인
- `existsYdocSnapshotById()` 호출 시 `ydocSnapshot` BYTEA LAZY 필드가 로딩되지 않는지 확인 (SQL 로그에서 `SELECT ydoc_snapshot IS NOT NULL` 형태만 발생하는지 검증)
- `DiagramDetailResponse.from()`에서 `getYdocSnapshot()` 호출이 없는지 확인
- `saveSnapshotWithUpdates()`에 빈 배열 전달 시 DB에 저장되지 않는지 확인 (`IS NOT NULL` 불변 조건 보장)

### Phase 4

- 컴팩션 전후 스냅샷 크기 감소 확인
- 컴팩션 후 새 클라이언트 접속 시 정상 로딩 확인
- 방 접속자 2명 이상일 때 컴팩션이 실행되지 않는지 확인
- 컴팩션 직후 다른 사용자 접속 시 데이터 무결성 확인
- 기존 스냅샷보다 큰 컴팩션 데이터 전송 시 서버가 거부하는지 확인 (크기 검증)
- 컴팩션 전송 후 다른 사용자가 접속한 경우 서버가 거부하는지 확인 (단독 접속 재확인)
