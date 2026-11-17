import type * as Y from 'yjs';
import type {
  DocumentReadExecutor,
  DocumentSubscriptionPort,
  ScopeRef,
} from '@/collaboration/core/contracts/document-read-executor';
import {
  affectedTableIds,
  generateProjection,
  updateProjection,
  diffProjection,
  type DslProjection,
  type ProjectionDictionary,
  type ProjectionSnapshot,
  type TextPatchBatch as BlockTextPatchBatch,
} from '@/lib/dsl-block-projection';
import {
  needsFullProjectionRead,
  readErdCodeProjectionSnapshot,
} from './erd-code-projection-snapshot';

/** 사전의 로컬 무효화 버전과 재현 가능한 내용 fingerprint를 함께 전달한다. */
export interface ProjectionDictionaryVersion {
  version: string | number;
  fingerprint: string;
  dictionary: ProjectionDictionary;
}

/** 읽기 전용 모델에 전달하는 패치와 전체 좌표·sidecar 정보. */
export interface TextPatchBatch extends BlockTextPatchBatch {
  baseRevision: number;
  nextRevision: number;
  dictionaryVersion: string | number;
  dictionaryFingerprint: string;
  blockMetadata: DslProjection['blocks'];
  invalidatedTableIds: string[];
  fullRevalidation: boolean;
  fullResync: boolean;
}

/** 포트는 읽기·구독만 요구하며 권한 게이트나 mutation 포트를 받지 않는다. */
export interface ErdCodeProjectionPortOptions {
  read: Pick<DocumentReadExecutor, 'execute' | 'getRevision'> & DocumentSubscriptionPort;
  getDocument: () => Y.Doc;
  getEpoch?: () => string | number;
  dictionary: ProjectionDictionaryVersion;
}

/** 소비자가 현재 보유한 투영 텍스트와 revision. */
export interface ProjectionTextState {
  text: string;
  revision: number;
}

/**
 * 기준 revision이 같은 경우에만 UTF-16 패치를 뒤에서부터 적용한다.
 * @param state 소비자의 현재 상태
 * @param batch 전달받은 배치
 * @returns 새 텍스트와 revision (입력 객체는 변경하지 않음)
 */
export function applyErdCodeProjectionBatch(
  state: ProjectionTextState,
  batch: TextPatchBatch,
): ProjectionTextState {
  if (state.revision !== batch.baseRevision || batch.nextRevision <= batch.baseRevision) {
    throw new Error('Projection base revision mismatch; resync required');
  }
  let text = state.text;
  let boundary = text.length;
  for (let i = batch.patches.length - 1; i >= 0; i--) {
    const patch = batch.patches[i];
    if (
      !Number.isInteger(patch.start) ||
      !Number.isInteger(patch.end) ||
      patch.start < 0 ||
      patch.end < patch.start ||
      patch.end > boundary
    ) {
      throw new Error('Invalid projection patch range');
    }
    text = text.slice(0, patch.start) + patch.text + text.slice(patch.end);
    boundary = patch.start;
  }
  return { text, revision: batch.nextRevision };
}

/**
 * 공유 문서에서만 읽고 단위 A의 블록 생성·의존성·diff를 재사용한다.
 * 먼저 구독한 뒤 authoritative hydration 완료 시 hydrate를 명시적으로 호출한다.
 * 재접속·문서 교체 시 resync, 동일 문서 세대 변경 시 getEpoch 또는 resync를 사용한다.
 * 구독자는 배치를 순서대로 적용하고 누락 시 resync(현재 소비자 상태)를 요청한다.
 */
export class ErdCodeProjectionPort {
  private dictionary: ProjectionDictionaryVersion;
  private snapshot?: ProjectionSnapshot;
  private projection: DslProjection = { revision: 0, text: '', blocks: [] };
  private document?: Y.Doc;
  private epoch?: string | number;
  private revision = 0;
  private hydrated = false;
  private dirty = false;
  private full = false;
  private scheduled = false;
  private disposed = false;
  private readonly scopes = new Map<string, ScopeRef>();
  private readonly listeners = new Set<(batch: TextPatchBatch) => void>();
  private readonly unsubscribe: () => void;

  constructor(private readonly options: ErdCodeProjectionPortOptions) {
    this.dictionary = structuredClone(options.dictionary);
    this.unsubscribe = options.read.subscribe((event) => {
      for (const scope of event.affectedScopes)
        this.scopes.set(JSON.stringify([scope.kind, scope.id]), scope);
      this.full ||= needsFullProjectionRead(event.affectedScopes);
      this.schedule();
    });
  }

  /**
   * 배치 구독을 등록한다. 초기 텍스트는 hydrate 또는 resync로 요청한다.
   * @param listener 새 배치 수신 함수
   * @returns 구독 해제 함수
   */
  subscribe(listener: (batch: TextPatchBatch) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 불변 사전 사본을 보관하고 버전 또는 fingerprint 변경을 다음 배치로 병합한다.
   * @param dictionary 버전과 내용 fingerprint를 포함한 새 사전 뷰
   * @returns 없음
   */
  setDictionary(dictionary: ProjectionDictionaryVersion): void {
    if (
      this.disposed ||
      (dictionary.version === this.dictionary.version &&
        dictionary.fingerprint === this.dictionary.fingerprint)
    )
      return;
    this.dictionary = structuredClone(dictionary);
    this.schedule();
  }

  /**
   * bootstrap 이벤트와 무관하게 authoritative 전체 스냅샷으로 초기화한다.
   * @returns 초기화 배치 또는 폐기·재시도로 인해 발행하지 않은 경우 undefined
   */
  hydrate(): TextPatchBatch | undefined {
    if (this.disposed) return;
    this.hydrated = true;
    this.full = true;
    this.dirty = true;
    return this.flush();
  }

  /**
   * 전체 재검증도 기존 텍스트와 최소 diff한다. 누락한 소비자에게는 전체 치환을 반환한다.
   * consumer를 전달하면 구독 발행을 생략하고 요청자가 반환 배치를 직접 적용한다.
   * 이렇게 복구한 상태로 기존 구독의 다음 배치부터 계속 적용한다.
   * @param consumer 배치를 놓친 소비자의 현재 텍스트와 revision
   * @returns 소비자 기준 전체 복구 배치 또는 일반 재검증 배치
   */
  resync(consumer?: ProjectionTextState): TextPatchBatch | undefined {
    if (
      consumer &&
      (!Number.isSafeInteger(consumer.revision) ||
        consumer.revision < 0 ||
        consumer.revision > this.revision)
    ) {
      throw new Error('Invalid consumer projection revision');
    }
    if (!consumer) return this.hydrate();
    if (this.disposed) return;
    this.hydrated = true;
    this.full = true;
    this.dirty = true;
    const batch = this.flushPending(false);
    if (!batch) return;
    return {
      ...batch,
      baseRevision: consumer.revision,
      fullResync: true,
      patches: [{ start: 0, end: consumer.text.length, text: this.projection.text }],
    };
  }

  /**
   * 누적 이벤트를 한 번 읽고 하나의 증가하는 투영 revision으로 발행한다.
   * @returns 발행한 배치 또는 변경이 없거나 수화 전인 경우 undefined
   */
  flush(): TextPatchBatch | undefined {
    return this.flushPending(true);
  }

  /**
   * 누적 변경을 계산하며 복구 요청에서는 일반 구독 발행을 생략한다.
   * @param notify 일반 구독자에게 계산 결과를 전달할지 여부
   * @returns 계산한 배치 또는 아직 발행할 수 없는 경우 undefined
   */
  private flushPending(notify: boolean): TextPatchBatch | undefined {
    if (this.disposed || !this.hydrated) return;
    const document = this.options.getDocument();
    const epoch = this.options.getEpoch?.();
    const full = this.full || this.document !== document || this.epoch !== epoch;
    if (!this.dirty && !full) return;
    const scopes = [...this.scopes.values()];
    this.dirty = false;
    this.full = false;
    this.scopes.clear();
    const dictionary = this.dictionary;
    const result = readErdCodeProjectionSnapshot(
      this.options.read,
      this.options.getDocument,
      dictionary.dictionary,
      this.revision + 1,
      full ? undefined : this.snapshot,
      full ? undefined : scopes,
    );
    // 동기 읽기 중 문서/사전 세대가 바뀌었으면 계산을 버리고 다음 tick에 다시 읽는다.
    if (
      this.dictionary !== dictionary ||
      result.document !== document ||
      result.document !== this.options.getDocument() ||
      epoch !== this.options.getEpoch?.() ||
      result.documentRevision !== this.options.read.getRevision()
    ) {
      this.full = true;
      this.schedule();
      return;
    }
    const affected =
      full || !this.snapshot ? undefined : affectedTableIds(this.snapshot, result.snapshot);
    const next =
      full || !this.snapshot
        ? generateProjection(result.snapshot)
        : updateProjection(this.projection, this.snapshot, result.snapshot, affected);
    const invalidated =
      full || !this.snapshot
        ? [
            ...new Set([
              ...this.projection.blocks.map((block) => block.tableId),
              ...next.blocks.map((block) => block.tableId),
            ]),
          ].sort()
        : [...affected!];
    const batch: TextPatchBatch = {
      ...(affected?.size === 0 ? { patches: [] } : diffProjection(this.projection, next)),
      baseRevision: this.revision,
      nextRevision: ++this.revision,
      dictionaryVersion: dictionary.version,
      dictionaryFingerprint: dictionary.fingerprint,
      blockMetadata: next.blocks,
      invalidatedTableIds: invalidated,
      fullRevalidation: full,
      fullResync: false,
    };
    this.snapshot = result.snapshot;
    this.projection = next;
    this.document = result.document;
    this.epoch = epoch;
    if (notify) for (const listener of this.listeners) listener(batch);
    return batch;
  }

  /**
   * 문서 구독과 예약 배치를 해제한다. 문서 자체에는 쓰지 않는다.
   * @returns 없음
   */
  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    this.listeners.clear();
    this.scopes.clear();
  }

  /**
   * 같은 tick의 변경을 microtask 하나로 병합한다. 수화 전 이벤트는 보류한다.
   * @returns 없음
   */
  private schedule(): void {
    this.dirty = true;
    if (this.scheduled || this.disposed || !this.hydrated) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.flush();
    });
  }
}
