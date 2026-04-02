# 04. Command/Event 설계

## 이 문서의 가장 중요한 결정

이번 설계에서는 `명령`, `공유 상태 변경`, `원격 동기화 payload`를 같은 것으로 취급하지 않는다.

정리하면 아래와 같다.

- `Command` = 로컬 입력 계약
- `DocumentChangeEvent` = 공유 상태 변경 사실
- `RemoteSyncEnvelope` = 서버와 주고받는 동기화 payload

이 구분이 있어야 재사용 가능성과 구현 단순화를 동시에 잡을 수 있다.

## 1. Local Command 계약

Command는 사용자의 로컬 입력을 표준화하는 용도다.  
Command 자체가 네트워크 표준이 되지는 않는다.

```typescript
interface DocumentCommand<TPayload = unknown> {
  pluginId: string;
  kind: string;
  payload: TPayload;
  meta: CommandMeta;
}

interface CommandMeta {
  source: 'text-editor' | 'canvas' | 'form' | 'toolbar' | 'system';
  clientId: string;
  requestId: string;
  issuedAt: number;
}
```

### 핵심 규칙

- core는 `kind`의 의미를 해석하지 않는다.
- `kind`의 의미는 플러그인이 해석한다.
- Command는 로컬에서만 생성되고 검증된다.
- Command는 원격으로 그대로 전파하지 않는다.

### 플러그인별 예시

```typescript
// ERD
{ pluginId: 'erd', kind: 'table.rename', payload: { tableId: 't1', name: '주문' } }

// 화면 기획서
{ pluginId: 'screen-spec', kind: 'section.move', payload: { sectionId: 's1', index: 2 } }

// 디자인
{ pluginId: 'design', kind: 'layer.resize', payload: { layerId: 'l1', width: 320, height: 120 } }
```

## 2. Shared Document Change Event 계약

공유 권위 상태가 실제로 바뀐 뒤에만 이벤트를 발행한다.

```typescript
interface DocumentChangeEvent {
  documentId: string;
  pluginId: string;
  revision: number;
  origin: ChangeOrigin;
  affectedScopes: ScopeRef[];
  delta: DocumentDelta;
}

interface ChangeOrigin {
  cause: 'local' | 'remote' | 'system';
  source: 'text-editor' | 'canvas' | 'form' | 'toolbar' | 'runtime';
  clientId?: string;
  requestId?: string;
}

interface ScopeRef {
  pluginId: string;
  scopeType: string;
  scopeId: string;
}
```

`DocumentDelta`는 core가 해석할 수 있는 최소 단위만 가진다.

```typescript
interface DocumentDelta {
  changedKeys: string[];
  pluginPayload?: unknown;
}
```

핵심은 `delta`의 자세한 의미도 플러그인이 안다는 점이다.  
코어는 `revision`, `origin`, `affectedScopes` 같은 공통 메타만 신뢰한다.

## 3. Remote Sync Envelope 계약

원격 동기화의 canonical payload는 `SharedDocumentEngine`이 정의하는 delta다.  
v1 기본 구현은 CRDT/Yjs update를 사용하지만, 코어 계약은 엔진 구현에 고정하지 않는다.

```typescript
interface RemoteSyncEnvelope {
  channel: 'document' | 'lock' | 'presence' | 'handoff';
  documentId: string;
  clientId: string;
  engineId: string;
  revisionHint?: number;
  payload: Uint8Array;
}
```

핵심 규칙:

- 문서 변경의 원격 전파는 `RemoteSyncEnvelope`로만 한다.
- `engineId`는 어떤 document engine 규약으로 payload를 해석해야 하는지 식별한다.
- 로컬 Command를 서버에 그대로 보내 재생시키지 않는다.
- 서버는 domain command executor가 아니라 collaboration relay + persistence coordinator 역할을 갖는다.

## 3-1. Presence Envelope 계약

캔버스형 문서의 협업 UX를 위해 presence도 참여자 목록만이 아니라 ephemeral 상태를 담을 수 있어야 한다.

```typescript
interface PresenceEnvelope {
  documentId: string;
  clientId: string;
  pluginId: string;
  payload: {
    pointer?: { x: number; y: number };
    selection?: string[];
    viewport?: { x: number; y: number; zoom: number };
    activeTool?: string;
    pluginPayload?: unknown;
  };
}
```

핵심 규칙:

- presence는 shared authoritative state가 아니라 ephemeral collaboration state다.
- 포인터, selection, viewport는 snapshot 저장 대상이 아니다.
- plugin은 `pluginPayload`를 통해 캔버스별 추가 ephemeral 상태를 확장할 수 있다.

## 4. Draft 보호 규칙

재사용 가능한 구조를 만들려면 invalid draft 문제를 계약 수준에서 먼저 막아야 한다.

```typescript
interface DraftState {
  draftId: string;
  dirty: boolean;
  parseStatus: 'idle' | 'parsing' | 'valid' | 'invalid';
  lastAcceptedRevision?: number;
  pendingRemoteRevision?: number;
  reconcileState: 'clean' | 'dirty-valid' | 'dirty-invalid' | 'remote-pending';
}
```

### 필수 규칙

1. 불완전 입력은 로컬 draft에만 존재한다.
2. parse/validate 성공 전에는 `DocumentCommand`를 만들지 않는다.
3. dirty draft가 있으면 projector가 생성한 텍스트로 editor 본문을 즉시 덮어쓰지 않는다.
4. dirty draft 동안 원격 변경이 오면 “원격 변경 있음” 상태만 표시하고, 적용 시점은 plugin 정책이 결정한다.
5. `dirty-invalid` 또는 `remote-pending` 상태에서는 shared save를 바로 수행하지 않는다.
6. 페이지 이탈 시 dirty draft는 필요하면 로컬 recovery cache에만 저장하고, shared authoritative state로 업로드하지 않는다.

이 규칙은 ERD 코드 편집기에만 필요한 특수 규칙이 아니다.  
화면 기획서의 JSON 편집기, 디자인 문서의 스크립트 편집기에도 같은 유형으로 재사용된다.

### Draft 재조정 계약

원격 변경이 local draft와 충돌할 때는 아래 상태 전이를 따른다.

```text
clean
  -> local edit -> dirty-valid / dirty-invalid

dirty-valid or dirty-invalid
  -> remote change arrives -> remote-pending

remote-pending
  -> acceptRemote
     = local draft 폐기, remote revision 반영, clean
  -> keepLocalAndRebase
     = latest shared state를 새 base로 잡고 draft 재파싱, 성공 시 dirty-valid
  -> compareLater
     = 본문 overwrite 없이 pending 유지
```

이 상태 머신은 plugin마다 UI가 달라질 수 있지만, 상태 이름과 전이 의미는 공통으로 유지한다.

## 5. 루프 방지 규칙

기존의 `origin/version`은 유지하되, 그것만으로 끝내지 않는다.

### 루프 방지의 3축

| 축 | 역할 |
|------|------|
| origin / requestId | 내가 보낸 변경인지 식별 |
| revision | 이미 적용한 변경인지 판정 |
| draft barrier | dirty draft 상태에서 projection overwrite 방지 |

즉, 이번 설계의 루프 방지는 아래와 같이 정의한다.

```text
echo 방지
  + revision 중복 방지
  + dirty draft overwrite 방지
```

### 각 구독자의 기본 스킵 정책

| 구독자 | 스킵 조건 |
|------|------|
| CollaborationRuntime | `origin.cause === 'remote'` 인 이벤트는 재전송 금지 |
| Projector | 현재 보는 adapter가 dirty draft 보호 중이면 본문 overwrite 금지 |
| UndoManager | 원격 변경은 로컬 undo 스택에 직접 넣지 않음 |
| LockRuntime | 변경 자체가 아니라 scope만 보고 동작 |

## 6. EventBus 전달 보장

```typescript
interface ChangeBus {
  subscribe(listener: (event: DocumentChangeEvent) => void): Unsubscribe;
  emit(event: DocumentChangeEvent): void;
}
```

전달 규칙:

1. 동기 발행을 기본으로 한다.
2. 구독자 예외는 격리한다.
3. debounce나 비동기 처리는 각 구독자 내부에서 한다.
4. 재진입이 발생하면 큐에 넣고 현재 이벤트 종료 후 처리한다.

## 7. Revision 관리

Revision은 문서 변경의 단조 증가 버전이다.  
로컬 revision과 원격 revision hint를 함께 관리하되, 최종 merge는 `DocumentStore`가 책임진다.

```typescript
class RevisionClock {
  private local = 0;

  next(): number {
    return ++this.local;
  }

  merge(remoteHint?: number): number {
    if (remoteHint != null) {
      this.local = Math.max(this.local, remoteHint);
    }
    return this.local;
  }
}
```

## 8. 구현 가드레일

다음은 금지한다.

- 플러그인 Command를 그대로 서버에 보내는 구조
- origin/version만으로 overwrite 문제까지 해결했다고 간주하는 구조
- parse 실패 draft를 shared state에 반영하는 구조
- core가 `table.rename`, `edge.add` 같은 command kind를 해석하는 구조
- `affectedScopes` 와 락 scope 표현을 서로 다른 형식으로 두는 구조

이번 문서의 최종 의도는 명확하다.  
`입력 계약`, `공유 상태 변경`, `원격 동기화`를 분리해 재사용 가능성과 안정성을 동시에 확보한다.
