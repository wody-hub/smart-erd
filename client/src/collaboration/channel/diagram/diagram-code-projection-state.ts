import {
  ErdCodeProjectionPort,
  applyErdCodeProjectionBatch,
  type ErdCodeProjectionPortOptions,
  type ProjectionDictionaryVersion,
  type TextPatchBatch,
} from '@/collaboration/plugins/erd/erd-code-projection-port';
import { diffProjection, type TableBlock } from '@/lib/dsl-block-projection';

/** 편집 권한과 독립적인 authoritative 읽기 연결. */
export interface DiagramCodeProjectionSource {
  /** 런타임이 이미 소유한 읽기·구독 포트. */
  read: ErdCodeProjectionPortOptions['read'];
  /** 현재 엔진 문서 조회. */
  getDocument: ErdCodeProjectionPortOptions['getDocument'];
  /** 현재 연결 세대의 authoritative 수화 완료 여부. */
  isReady: () => boolean;
  /** 연결·수화 세대 식별자. */
  getEpoch: () => string | number;
}

/** 렌더링에 사용할 불변 투영 상태. */
export interface DiagramCodeProjectionSnapshot {
  /** 현재 전체 읽기 전용 텍스트. */
  text: string;
  /** 소비자 기준 단조 증가 버전. */
  revision: number;
  /** 엔티티 ID와 전체 텍스트 범위. */
  blocks: TableBlock[];
  /** DSL로 표현하지 못한 관계 개수. */
  unsupportedNotices: number;
  /** 최초 수화와 재연결을 구분하는 표시 상태. */
  status: 'disabled' | 'hydrating' | 'ready' | 'resync';
}

/** Monaco에 순서대로 동기 전달하는 배치 이벤트. */
export interface DiagramCodeProjectionPatch {
  /** 소비자 버전 기준 패치 배치. */
  batch: TextPatchBatch;
  /** 배치 적용 후 스냅샷. */
  snapshot: DiagramCodeProjectionSnapshot;
  /** 문서 이벤트 수신 시각 (performance.now 기준). */
  receivedAt: number;
}

/**
 * sidecar에 명시된 미표현 관계를 중복 없이 센다.
 * @param blocks 현재 투영 블록
 * @returns 생략된 관계 개수
 */
export function countUnsupportedProjectionRelations(blocks: TableBlock[]): number {
  return new Set(blocks.flatMap((block) => block.metadata.unrepresentedRelationIds)).size;
}

/** React와 분리하여 실제 문서 스토어로 검증할 수 있는 읽기 상태 머신. */
export class DiagramCodeProjectionState {
  private snapshot: DiagramCodeProjectionSnapshot = {
    text: '',
    revision: 0,
    blocks: [],
    unsupportedNotices: 0,
    status: 'hydrating',
  };
  private readonly listeners = new Set<() => void>();
  private readonly patches = new Set<(event: DiagramCodeProjectionPatch) => void>();
  private source: DiagramCodeProjectionSource | null = null;
  private port: ErdCodeProjectionPort | null = null;
  private dictionary: ProjectionDictionaryVersion | null = null;
  private portState = { text: '', revision: 0 };
  private epoch: string | number | undefined;
  private receivedAt = 0;

  /**
   * 외부 저장소의 안정된 스냅샷을 반환한다.
   * @returns 현재 투영 상태
   */
  getSnapshot = (): DiagramCodeProjectionSnapshot => this.snapshot;

  /**
   * React 상태 변경을 구독한다.
   * @param listener 변경 알림
   * @returns 구독 해제 함수
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * React 렌더 병합과 무관하게 모든 배치를 순서대로 구독한다.
   * @param listener 배치 수신 함수
   * @returns 구독 해제 함수
   */
  subscribePatches = (listener: (event: DiagramCodeProjectionPatch) => void): (() => void) => {
    this.patches.add(listener);
    return () => {
      this.patches.delete(listener);
    };
  };

  /**
   * 활성 플래그일 때만 읽기 포트를 생성한다. 문서 교체 시 소비자 버전은 유지한다.
   * @param enabled 내부 rollout 활성 여부
   * @param source 런타임 읽기 연결
   * @param dictionary 사전 스냅샷
   * @returns 없음
   */
  connect(
    enabled: boolean,
    source: DiagramCodeProjectionSource | null,
    dictionary: ProjectionDictionaryVersion,
  ): void {
    this.disconnect();
    this.dictionary = dictionary;
    this.source = enabled ? source : null;
    if (!enabled) {
      this.setStatus('disabled');
      return;
    }
    this.setStatus(this.snapshot.revision ? 'resync' : 'hydrating');
    if (!source) return;
    this.portState = { text: '', revision: 0 };
    this.port = new ErdCodeProjectionPort({
      read: {
        execute: (query) => source.read.execute(query),
        getRevision: () => source.read.getRevision(),
        subscribe: (listener) =>
          source.read.subscribe((event) => {
            // 세대가 준비되기 전 이벤트는 읽지 않는다. 재수화 시 전체 재검증한다.
            if (!source.isReady()) return;
            this.receivedAt ||= performance.now();
            listener(event);
          }),
      },
      getDocument: source.getDocument,
      getEpoch: source.getEpoch,
      dictionary,
    });
    this.port.subscribe((batch) => this.accept(batch));
    this.refreshReadiness();
  }

  /**
   * 연결 세대의 준비 상태를 재확인한다. 복구에도 전체 치환 API를 사용하지 않는다.
   * @returns 없음
   */
  refreshReadiness(): void {
    if (!this.source || !this.port) return;
    if (!this.source.isReady()) {
      this.setStatus(this.snapshot.revision ? 'resync' : 'hydrating');
      return;
    }
    if (this.dictionary) this.port.setDictionary(this.dictionary);
    const epoch = this.source.getEpoch();
    if (this.epoch !== epoch || this.snapshot.status !== 'ready') {
      this.epoch = epoch;
      this.receivedAt = performance.now();
      // consumer 인수 없는 resync는 포트의 블록 diff를 구독 스트림으로 발행한다.
      this.port.resync();
    }
  }

  /**
   * 준비되지 않은 세대에서는 사전 읽기도 보류한다.
   * @param dictionary 새 사전 내용과 버전
   * @returns 없음
   */
  setDictionary(dictionary: ProjectionDictionaryVersion): void {
    const changed =
      this.dictionary?.version !== dictionary.version ||
      this.dictionary?.fingerprint !== dictionary.fingerprint;
    this.dictionary = dictionary;
    if (changed && this.source?.isReady()) {
      this.receivedAt ||= performance.now();
      this.port?.setDictionary(dictionary);
    }
  }

  /**
   * 읽기 포트만 폐기한다. 원본 문서와 공유 초안은 변경하지 않는다.
   * @returns 없음
   */
  disconnect(): void {
    this.port?.dispose();
    this.port = null;
    this.source = null;
    this.epoch = undefined;
  }

  /**
   * 포트 배치를 소비자 버전으로 연결하고 문서 교체 시에도 최소 diff로 재기준화한다.
   * @param batch 단위 B의 배치
   * @returns 없음
   */
  private accept(batch: TextPatchBatch): void {
    const previous = this.snapshot;
    const previousPortState = this.portState;
    this.portState = applyErdCodeProjectionBatch(this.portState, batch);
    // 직전 연결에서 이미 예약된 microtask 배치는 표시하지 않는다.
    // 포트 기준점만 따라가고 다음 authoritative resync에서 소비자와 최소 diff한다.
    if (!this.source?.isReady()) {
      this.receivedAt = 0;
      this.setStatus(previous.revision ? 'resync' : 'hydrating');
      return;
    }
    const revision = previous.revision + 1;
    const rebased =
      (previousPortState.revision === 0 && previous.revision > 0) ||
      previousPortState.text !== previous.text
        ? diffProjection(
            { text: previous.text, blocks: previous.blocks, revision: previous.revision },
            { text: this.portState.text, blocks: batch.blockMetadata, revision },
          ).patches
        : batch.patches;
    const next = {
      ...batch,
      baseRevision: previous.revision,
      nextRevision: revision,
      patches: rebased,
    };
    this.snapshot = {
      text: this.portState.text,
      revision,
      blocks: batch.blockMetadata,
      unsupportedNotices: countUnsupportedProjectionRelations(batch.blockMetadata),
      status: 'ready',
    };
    const event = { batch: next, snapshot: this.snapshot, receivedAt: this.receivedAt };
    this.receivedAt = 0;
    for (const listener of this.patches) listener(event);
    for (const listener of this.listeners) listener();
  }

  /**
   * 텍스트를 유지하면서 준비 상태만 변경한다.
   * @param status 다음 표시 상태
   * @returns 없음
   */
  private setStatus(status: DiagramCodeProjectionSnapshot['status']): void {
    if (status === this.snapshot.status) return;
    this.snapshot = { ...this.snapshot, status };
    for (const listener of this.listeners) listener();
  }
}
