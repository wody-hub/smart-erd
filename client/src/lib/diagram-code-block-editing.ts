import {
  computeBlockCommit,
  mergeRemoteIntoLocalEdit,
  isOwnCommitEcho,
  ownCommitEchoPatchIndexes,
  type BlockCommitBase,
  type BlockCommitConflictFailure,
  type BlockEditKind,
  type BlockFieldConflict,
} from './code-block-commit.js';
import {
  createBlockCommitState,
  reduceBlockCommit,
  type BlockCommitEvent,
  type BlockCommitState,
  type BlockCommitTimer,
} from './code-block-commit-state.js';
import type { CodeBlockCommit, CodeBlockCommitResult } from './code-block-commit-contract.js';
import {
  generateTableBlock,
  type ProjectionSnapshot,
  type TableBlock,
} from './dsl-block-projection.js';

/** 미커밋 로컬 편집 세션의 텍스트 이력. 원격 변경이 도착하면 undo·redo를 모두 폐기한다. */
interface TextHistoryEntry {
  /** 블록 전체 사용자 텍스트. */
  text: string;
  /** 안정 ID를 모호하게 만든 편집 종류. */
  kind: BlockEditKind;
}
/** UI와 Monaco 실행자가 함께 읽는 블록 상태. */
export interface EditingBlock {
  /** 불변 파싱·ID 기준. */
  base: BlockCommitBase;
  /** 마지막 성공 커밋 시점의 사용자 텍스트. */
  cleanText: string;
  /** 최신 서버 투영. 삭제된 대상은 없다. */
  authoritative?: TableBlock;
  /** 단위 A의 순수 상태 머신. */
  state: BlockCommitState;
  /** 사용자 선택이 필요한 필드. */
  conflicts: BlockFieldConflict[];
  /** 자동 적용하지 않은 원격 변경 여부. */
  remotePending: boolean;
  /** 마커와 안내에 사용할 진단. */
  failure?: BlockCommitConflictFailure;
  /** 구조 변경의 출처를 보존한다. */
  kind: BlockEditKind;
  /** 블록별 사용자 undo 이력. */
  undo: TextHistoryEntry[];
  /** 블록별 사용자 redo 이력. */
  redo: TextHistoryEntry[];
  /** 커밋 echo의 값 비교 기준. */
  sent?: { commit: CodeBlockCommit; base: BlockCommitBase };
}
/** React·Monaco 없이 테스트할 수 있는 부작용 포트. */
export interface CodeBlockEditingOptions {
  /** 현재 시각. */
  now: () => number;
  /** 취소 함수를 반환하는 타이머. */
  schedule: (run: () => void, delay: number) => () => void;
  /** dispatch 직전의 세션·권한 검사. */
  ready: () => boolean;
  /** 현재 authoritative 읽기 스냅샷. */
  snapshot: () => ProjectionSnapshot;
  /** 현재 사전 지문. */
  fingerprint: () => string;
  /** UUID 생성기. */
  uuid: () => string;
  /** 단위 B 문서 명령. */
  commit: (commit: CodeBlockCommit) => CodeBlockCommitResult | Promise<CodeBlockCommitResult>;
  /** 상태·진단 갱신 알림. */
  changed: (id?: string) => void;
  /** 원격 선택·텍스트 이력의 비기록 편집. */
  replaceText: (id: string, text: string, authoritative?: TableBlock) => void;
  /** 이중 플래그로 제한한 성능 계측. */
  mark?: (phase: 'parse' | 'dispatch' | 'applied' | 'echo', id: string, duration?: number) => void;
}

/** 블록별 타이머·명령·충돌·사용자 이력을 실행하는 편집 컨트롤러. */
export class CodeBlockEditingController {
  readonly blocks = new Map<string, EditingBlock>();
  private timers = new Map<string, Map<BlockCommitTimer, () => void>>();
  private ready: boolean;
  private disposed = false;
  private paused = false;

  /** 주입된 포트만 사용하고 문서를 직접 쓰지 않는다. */
  constructor(private readonly options: CodeBlockEditingOptions) {
    this.ready = options.ready();
  }
  /**
   * 새 블록의 기준과 상태를 만든다. 기존 dirty 상태는 보존한다.
   * @param block 새 authoritative 블록
   * @returns 없음
   */
  add(block: TableBlock): void {
    if (this.blocks.has(block.tableId)) return;
    this.blocks.set(block.tableId, {
      base: { ...block, dictionaryFingerprint: this.options.fingerprint() },
      cleanText: block.text,
      authoritative: block,
      state: createBlockCommitState(block.text, this.ready),
      conflicts: [],
      remotePending: false,
      kind: 'field',
      undo: [],
      redo: [],
    });
  }
  /**
   * 블록별 UI 상태를 반환한다.
   * @param id 안정 테이블 ID
   * @returns 현재 편집 상태 또는 없음
   */
  get(id: string): EditingBlock | undefined {
    return this.blocks.get(id);
  }
  /**
   * 사용자 입력만 이력에 남긴다. 구조 변경은 undo로 되돌릴 때까지 유지한다.
   * @param id 안정 테이블 ID
   * @param text 사용자 텍스트
   * @param kind 편집의 구조적 출처
   * @returns 없음
   */
  edit(id: string, text: string, kind: BlockEditKind = 'field'): void {
    const block = this.blocks.get(id);
    if (!block) return;
    if (block.state.text === text) {
      if (kind !== 'field') {
        block.kind = kind;
        block.state.dirtySince ??= this.options.now();
        this.fail(id, { status: 'unsupported', reasons: ['structure-changed'], diagnostics: [] });
        this.options.changed(id);
      }
      return;
    }
    block.undo.push({ text: block.state.text, kind: block.kind });
    block.redo = [];
    if (kind !== 'field') block.kind = kind;
    block.failure = undefined;
    this.dispatch(id, { type: 'edit', text, now: this.options.now() });
    if (
      text === block.cleanText &&
      !block.remotePending &&
      block.state.inFlightVersion === undefined
    ) {
      this.cancel(id);
      block.state = { ...createBlockCommitState(text, this.ready), version: block.state.version };
      block.kind = 'field';
      block.conflicts = [];
      this.options.changed(id);
    }
  }
  /**
   * 저널 기준으로 일반 편집을 재개한 뒤 최신 원격 값과 세 방향 병합한다.
   * @param base 저장한 안정 ID·필드·토큰 기준
   * @param text 미커밋 원문
   * @param kind 구조 편집 출처
   * @param authoritative 수화 완료된 현재 블록 또는 원격 삭제
   * @returns 없음
   */
  recover(
    base: BlockCommitBase,
    text: string,
    kind: BlockEditKind,
    authoritative?: TableBlock,
  ): void {
    if (!this.ready || !this.options.ready()) return;
    this.cancel(base.tableId);
    this.blocks.delete(base.tableId);
    this.add(base);
    const block = this.blocks.get(base.tableId)!;
    block.base = base;
    this.edit(base.tableId, text, kind);
    this.remote(authoritative, [], base.tableId);
  }
  /**
   * 복구 원문을 버리고 현재 원격 값으로 되돌린다. 삭제된 ID는 재생성하지 않는다.
   * @param id 복구 블록 ID
   * @returns 없음
   */
  discardRecovered(id: string): void {
    const block = this.blocks.get(id);
    if (!block) return;
    this.cancel(id);
    const authoritative = block.authoritative;
    this.blocks.delete(id);
    if (authoritative) this.add(authoritative);
    this.options.changed();
  }
  /**
   * IME·커서 이탈·blur 이벤트를 순수 reducer에 전달한다. pagehide는 쓰지 않는다.
   * @param id 안정 테이블 ID
   * @param type 에디터 이벤트
   * @returns 없음
   */
  event(id: string, type: 'leave' | 'blur' | 'composition-start' | 'composition-end'): void {
    const conflict = this.blocks.get(id)?.state.status === 'CONFLICT';
    this.dispatch(id, { type, now: this.options.now() });
    if (conflict && type === 'composition-end')
      this.dispatch(id, { type: 'conflict', now: this.options.now() });
  }
  /**
   * 연결 상실 시 타이머를 취소하고 텍스트를 유지한다.
   * @param ready 현재 쓰기 가능 여부
   * @returns 없음
   */
  setReady(ready: boolean): void {
    if (this.ready === ready) return;
    this.ready = ready;
    for (const id of this.blocks.keys())
      this.dispatch(id, { type: 'readiness', ready, now: this.options.now() });
  }
  /**
   * 원격 변경은 dirty 텍스트를 건드리지 않고 단위 A로 재기준화한다.
   * @param authoritative 최신 투영 또는 삭제
   * @param commitIds 배치에 포함된 커밋 ID
   * @param id 삭제 시에도 유지하는 테이블 ID
   * @returns 표시 텍스트를 유지해야 하면 참
   */
  remote(
    authoritative: TableBlock | undefined,
    commitIds: string[],
    id = authoritative?.tableId,
  ): boolean {
    if (!id) return false;
    const block = this.blocks.get(id);
    if (!block) {
      if (authoritative) this.add(authoritative);
      return false;
    }
    const previous = block.authoritative;
    block.authoritative = authoritative;
    if (
      authoritative &&
      block.sent &&
      isOwnCommitEcho(commitIds, authoritative, block.sent.commit, block.sent.base)
    ) {
      this.options.mark?.('echo', id);
      block.sent = undefined;
      // 성공 시점에 기준은 갱신되어 있으므로 echo로 추가 입력을 재기준화하지 않는다.
      this.options.changed(id);
      return true;
    }
    // 전체 블록 스냅샷은 원격 이전 필드를 되살릴 수 있으므로 같은 echo 이외의 변경에서 폐기한다.
    if (
      !authoritative ||
      !previous ||
      previous.text !== authoritative.text ||
      JSON.stringify(previous.metadata) !== JSON.stringify(authoritative.metadata)
    ) {
      block.undo = [];
      block.redo = [];
    }
    if (
      authoritative &&
      block.sent &&
      commitIds.includes(block.sent.commit.commitId) &&
      ownCommitEchoPatchIndexes(commitIds, authoritative, block.sent.commit).length <
        block.sent.commit.patches.length
    ) {
      const raced = mergeRemoteIntoLocalEdit({
        base: block.sent.base,
        edited: block.state.text,
        authoritativeBlock: authoritative,
      });
      if (raced.status === 'conflict') {
        block.base = block.sent.base;
        block.sent = undefined;
        block.remotePending = true;
        block.state.dirtySince ??= this.options.now();
        block.conflicts = raced.conflicts;
        this.dispatch(id, { type: 'conflict', now: this.options.now() });
        return true;
      }
    }
    if (block.state.dirtySince === undefined && block.state.inFlightVersion === undefined) {
      if (authoritative) {
        block.base = { ...authoritative, dictionaryFingerprint: this.options.fingerprint() };
        block.state.text = authoritative.text;
        block.cleanText = authoritative.text;
        block.remotePending = false;
      } else this.blocks.delete(id);
      return false;
    }
    if (
      authoritative &&
      previous &&
      JSON.stringify(previous.metadata) === JSON.stringify(authoritative.metadata) &&
      previous.text === authoritative.text
    )
      return true;
    block.remotePending = true;
    const merged = mergeRemoteIntoLocalEdit({
      base: block.base,
      edited: block.state.text,
      authoritativeBlock: authoritative,
    });
    if (merged.status === 'merged') block.base = merged.base;
    else if (merged.status === 'conflict') {
      block.conflicts = merged.conflicts;
      this.dispatch(id, { type: 'conflict', now: this.options.now() });
    } else if (merged.status === 'entity-removed')
      this.dispatch(id, { type: 'entity-removed', now: this.options.now() });
    else this.fail(id, merged);
    this.options.changed(id);
    return true;
  }
  /**
   * 블록 단위 선택 후 최신 authoritative 기준에서 커밋을 다시 계산한다.
   * @param id 안정 테이블 ID
   * @param choice 적용할 값의 소유자
   * @returns 없음
   */
  resolve(id: string, choice: 'mine' | 'remote'): void {
    const block = this.blocks.get(id);
    if (!block || !this.ready || !this.options.ready() || block.state.composing) return;
    const snapshot = this.options.snapshot();
    if (!snapshot.nodes.some((node) => node.id === id)) return;
    const authoritative = generateTableBlock(id, snapshot);
    if (choice === 'remote') {
      block.base = { ...authoritative, dictionaryFingerprint: this.options.fingerprint() };
      block.cleanText = authoritative.text;
      block.state = createBlockCommitState(authoritative.text, true);
      block.undo = [];
      block.redo = [];
      block.kind = 'field';
      block.conflicts = [];
      block.failure = undefined;
      block.remotePending = false;
      this.cancel(id);
      this.options.replaceText(id, authoritative.text, authoritative);
      this.options.changed(id);
      return;
    }
    if (
      JSON.stringify(block.base.metadata.columnIds) !==
      JSON.stringify(authoritative.metadata.columnIds)
    ) {
      this.remote(authoritative, []);
      return;
    }
    // 토큰 기준은 유지하고, 승인할 필드의 비교값만 현재 문서 값으로 전진시킨다.
    // 최초 base.text를 재병합하면 이전에 확정한 토큰이 새 변경으로 오인된다.
    const metadata = structuredClone(block.base.metadata);
    for (const conflict of block.conflicts) {
      const target =
        conflict.target === 'table'
          ? metadata
          : metadata.columns.find((column) => column.id === conflict.columnId);
      if (!target) continue;
      const field =
        conflict.target === 'table'
          ? conflict.field === 'label'
            ? 'tablePhysicalName'
            : 'tableLogicalName'
          : conflict.field;
      const current =
        conflict.target === 'table'
          ? authoritative.metadata[field as 'tablePhysicalName' | 'tableLogicalName']
          : authoritative.metadata.columns.find((column) => column.id === conflict.columnId)?.[
              conflict.field as keyof (typeof metadata.columns)[number]
            ];
      Object.assign(target, { [field]: current });
    }
    block.base = { ...block.base, metadata };
    block.conflicts = [];
    block.failure = undefined;
    block.state = {
      ...block.state,
      status: 'DIRTY',
      blockedReason: undefined,
      inFlightVersion: undefined,
    };
    this.dispatch(id, { type: 'leave', now: this.options.now() });
  }
  /**
   * dirty 이력은 블록 상대 텍스트로, CLEAN은 문서 이력으로 라우팅한다.
   * @param id 커서의 테이블 ID
   * @param direction undo 또는 redo
   * @returns 실행한 이력 또는 문서 위임·차단 결정
   */
  history(id: string | undefined, direction: 'undo' | 'redo'): 'text' | 'document' | 'blocked' {
    if (this.paused || !this.ready || !this.options.ready()) return 'blocked';
    const block = id ? this.blocks.get(id) : undefined;
    if (!block) return 'document';
    if (block.state.composing || block.state.inFlightVersion !== undefined) return 'blocked';
    const stack = direction === 'undo' ? block.undo : block.redo;
    if (direction === 'redo' ? stack.length > 0 : block.state.dirtySince !== undefined) {
      const next = stack.pop();
      if (!next) return 'blocked';
      (direction === 'undo' ? block.redo : block.undo).push({
        text: block.state.text,
        kind: block.kind,
      });
      block.kind = next.kind;
      block.failure = undefined;
      block.conflicts = [];
      this.options.replaceText(id!, next.text);
      this.dispatch(id!, { type: 'edit', text: next.text, now: this.options.now() });
      if (next.text === block.cleanText && !block.remotePending) {
        this.cancel(id!);
        block.state = { ...createBlockCommitState(next.text, true), version: block.state.version };
      }
      this.options.changed(id);
      return 'text';
    }
    return 'document';
  }
  /**
   * 다중 블록 편집의 로컬 undo에 필요한 상태를 복사한다.
   * @returns 문서 참조가 없는 블록별 체크포인트
   */
  checkpoint(): EditingBlock[] {
    return structuredClone([...this.blocks.values()]);
  }
  /**
   * ID 범위가 모호한 모델 편집 중 자동 쓰기와 타이머를 보류한다.
   * @returns 없음
   */
  pause(): void {
    this.paused = true;
    for (const id of this.timers.keys()) this.cancel(id);
  }
  /**
   * 다중 블록 로컬 undo를 복원하고 현재 준비 상태에서 재검증한다.
   * @param checkpoint 복원할 사용자 상태
   * @returns 없음
   */
  restore(checkpoint: EditingBlock[]): void {
    for (const id of this.timers.keys()) this.cancel(id);
    this.blocks.clear();
    this.paused = false;
    for (const block of structuredClone(checkpoint)) {
      block.state.version++;
      block.state.inFlightVersion = undefined;
      this.blocks.set(block.base.tableId, block);
      const status = block.state.status;
      this.dispatch(block.base.tableId, {
        type: 'readiness',
        ready: this.ready && this.options.ready(),
        now: this.options.now(),
      });
      if (status === 'CONFLICT')
        this.dispatch(block.base.tableId, { type: 'conflict', now: this.options.now() });
      else if (status === 'INVALID' || status === 'UNSUPPORTED') {
        this.cancel(block.base.tableId);
        block.state.status = status;
      }
    }
    this.options.changed();
  }
  /**
   * 다중 블록 구조 편집의 모호한 ID를 진단하고 원문을 보존한다.
   * @param id 보존할 블록 ID
   * @returns 없음
   */
  unsupportedStructure(id: string): void {
    const block = this.blocks.get(id);
    if (!block) return;
    block.kind = 'replace-lines';
    block.state.dirtySince ??= this.options.now();
    this.fail(id, { status: 'unsupported', reasons: ['structure-changed'], diagnostics: [] });
    this.options.changed(id);
  }
  /**
   * 마운트 해제 시 늦은 응답과 모든 타이머를 무효화한다.
   * @returns 없음
   */
  dispose(): void {
    this.disposed = true;
    for (const id of this.timers.keys()) this.cancel(id);
  }
  /**
   * 블록의 타이머를 모두 취소한다.
   * @param id 안정 테이블 ID
   * @returns 없음
   */
  private cancel(id: string): void {
    for (const stop of this.timers.get(id)?.values() ?? []) stop();
    this.timers.delete(id);
  }
  /**
   * reducer 효과를 실행하며 오래된 세대의 콜백을 무시한다.
   * @param id 안정 테이블 ID
   * @param event 순수 상태 이벤트
   * @returns 없음
   */
  private dispatch(id: string, event: BlockCommitEvent): void {
    const block = this.blocks.get(id);
    if (!block || this.disposed) return;
    const transition = reduceBlockCommit(block.state, event);
    block.state = transition.state;
    for (const effect of transition.effects) {
      if (effect.type === 'cancel-timers') this.cancel(id);
      else if (effect.type === 'schedule') {
        const timers = this.timers.get(id) ?? new Map<BlockCommitTimer, () => void>();
        this.timers.set(id, timers);
        timers.get(effect.timer)?.();
        timers.set(
          effect.timer,
          this.options.schedule(() => {
            timers.delete(effect.timer);
            this.dispatch(id, {
              type: 'timer',
              timer: effect.timer,
              version: effect.version,
              now: this.options.now(),
            });
          }, effect.delayMs),
        );
      } else if (effect.type === 'parse') {
        this.options.mark?.('parse', id);
        const result = this.compute(block, effect.text, 'parse');
        if ('kind' in result)
          this.dispatch(id, {
            type: 'parsed',
            version: effect.version,
            result: 'VALID',
            now: this.options.now(),
          });
        else this.fail(id, result, effect.version);
      } else if (effect.type === 'commit') this.commit(id, effect.text, effect.version);
      // 복구 저널은 changed 포트에서 ID sidecar와 함께 저장한다.
    }
    this.options.changed(id);
  }
  /**
   * 현재 기준으로 커밋을 계산한다. 사용자 ID는 dispatch 시에만 생성한다.
   * @param block 편집 기준과 출처
   * @param text 검증할 사용자 텍스트
   * @param commitId 커밋 식별자
   * @returns 엄격 커밋 또는 적용 불가 진단
   */
  private compute(block: EditingBlock, text: string, commitId: string) {
    return computeBlockCommit({
      base: block.base,
      edited: text,
      currentSnapshot: this.options.snapshot(),
      dictionaryFingerprint: this.options.fingerprint(),
      commitId,
      editKind: block.kind,
    });
  }
  /**
   * 계산 실패를 지속 상태로 바꾸고 타이머를 취소한다.
   * @param id 안정 테이블 ID
   * @param failure 계산 진단
   * @param version 파싱 대상 텍스트 세대
   * @returns 없음
   */
  private fail(id: string, failure: BlockCommitConflictFailure, version?: number): void {
    const block = this.blocks.get(id)!;
    block.failure = failure;
    this.cancel(id);
    if (failure.conflicts?.length) {
      block.conflicts = failure.conflicts;
      this.dispatch(id, { type: 'conflict', now: this.options.now() });
    } else if (failure.reasons.includes('entity-removed'))
      this.dispatch(id, { type: 'entity-removed', now: this.options.now() });
    else {
      if (version !== undefined)
        this.dispatch(id, {
          type: 'parsed',
          version,
          result: failure.status === 'invalid' ? 'INVALID' : 'UNSUPPORTED',
          now: this.options.now(),
        });
      else block.state.status = failure.status === 'invalid' ? 'INVALID' : 'UNSUPPORTED';
    }
  }
  /**
   * dispatch 직전에 재검증하고 성공한 텍스트 세대만 이력 경계로 확정한다.
   * @param id 안정 테이블 ID
   * @param text 커밋할 사용자 텍스트
   * @param version 커밋 텍스트 세대
   * @returns 없음
   */
  private commit(id: string, text: string, version: number): void {
    const block = this.blocks.get(id)!;
    if (this.paused || !this.ready || !this.options.ready()) {
      this.dispatch(id, {
        type: 'commit-rejected',
        version,
        reason: 'not-ready',
        now: this.options.now(),
      });
      return;
    }
    this.options.mark?.('parse', id);
    const commit = this.compute(block, text, this.options.uuid());
    if (!('kind' in commit)) {
      block.state.inFlightVersion = undefined;
      this.fail(id, commit);
      return;
    }
    const sentBase = block.base;
    block.sent = { commit, base: sentBase };
    const started = this.options.now();
    this.options.mark?.('dispatch', id);
    /**
     * 늦은 응답을 배제하고 커밋 결과를 상태와 이력에 반영한다.
     * @param result 문서 명령 결과
     * @returns 없음
     */
    const finish = (result: CodeBlockCommitResult) => {
      if (this.disposed || block.state.inFlightVersion !== version) return;
      if (result.status === 'applied') {
        const snapshot = this.options.snapshot();
        const expected = structuredClone(snapshot);
        const node = expected.nodes.find((node) => node.id === id);
        if (!node) {
          this.dispatch(id, { type: 'entity-removed', now: this.options.now() });
          return;
        }
        for (const patch of commit.patches) {
          const target =
            patch.target === 'table'
              ? node.data
              : node.data.columns.find((col) => col.id === patch.columnId);
          if (target) Object.assign(target, { [patch.field]: patch.nextValue });
        }
        const authoritative = generateTableBlock(id, expected);
        const merged = mergeRemoteIntoLocalEdit({
          base: sentBase,
          edited: text,
          authoritativeBlock: authoritative,
        });
        if (merged.status === 'merged') block.base = merged.base;
        block.cleanText = text;
        block.failure = undefined;
        block.conflicts = [];
        if (block.state.version === version) {
          block.undo = [];
          block.redo = [];
          block.kind = 'field';
        } else {
          // 커밋 중 추가 입력은 방금 확정한 텍스트 이후부터만 되돌린다.
          block.undo = [{ text, kind: 'field' }];
          block.redo = [];
        }
        this.options.mark?.('applied', id, this.options.now() - started);
        const settleRemote = block.remotePending && block.state.version === version;
        if (settleRemote) {
          block.base = { ...authoritative, dictionaryFingerprint: this.options.fingerprint() };
          block.cleanText = authoritative.text;
          block.state.text = authoritative.text;
          block.remotePending = false;
        }
        this.dispatch(id, { type: 'commit-success', version, now: this.options.now() });
        if (settleRemote) this.options.replaceText(id, authoritative.text, authoritative);
      } else {
        block.sent = undefined;
        block.conflicts = (result.conflicts ?? []).flatMap((conflict) => {
          const patch = commit.patches[conflict.patchIndex];
          return patch
            ? [
                {
                  target: patch.target,
                  columnId: patch.target === 'column' ? patch.columnId : undefined,
                  field: patch.field,
                  baseValue: conflict.baseValue,
                  localValue: conflict.nextValue,
                  currentValue: conflict.currentValue,
                },
              ]
            : [];
        });
        const reason =
          result.reason === 'conflict'
            ? 'conflict'
            : result.reason === 'not-ready'
              ? 'not-ready'
              : ['invalid', 'duplicate-name'].includes(result.reason)
                ? 'invalid'
                : 'unsupported';
        this.dispatch(id, { type: 'commit-rejected', version, reason, now: this.options.now() });
        if (result.reason === 'missing-target')
          this.dispatch(id, { type: 'entity-removed', now: this.options.now() });
        block.failure = {
          status: reason === 'invalid' ? 'invalid' : 'unsupported',
          reasons: [result.reason],
          diagnostics: [],
        };
        this.options.changed(id);
      }
    };
    const result = this.options.commit(commit);
    if (result instanceof Promise)
      void result.then(finish, () =>
        finish({ status: 'rejected', commitId: commit.commitId, reason: 'not-ready' }),
      );
    else finish(result);
  }
}
