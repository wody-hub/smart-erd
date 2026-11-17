import { STORAGE_KEYS } from '../constants/storage.js';
import type { CodeBlockEditingController } from './diagram-code-block-editing.js';
import type { TableBlock } from './dsl-block-projection.js';
import {
  CodeBlockRecoveryJournal,
  RECOVERY_LIMITS,
  recoveryBase,
  recoveryRecord,
} from './code-block-recovery-journal.js';

/** 테스트 가능한 복구 어댑터의 읽기·타이머 포트. 공유 문서 쓰기 포트는 받지 않는다. */
interface RecoverySessionOptions {
  controller: CodeBlockEditingController;
  journal: CodeBlockRecoveryJournal;
  ready: () => boolean;
  active: () => boolean;
  authoritative: () => TableBlock[];
  schedule: (run: () => void, delay: number) => () => void;
  restored: (count: number, refreshModel?: boolean) => void;
  now?: () => number;
}
/** debounce·종료 flush·복원 순서를 묶는다. 다른 탭이 소유한 레코드는 건드리지 않는다. */
export class CodeBlockRecoverySession {
  private pending = new Set<string>();
  private tracked = new Set<string>();
  private versions = new Map<string, number>();
  private restoredIds = new Set<string>();
  private cancel?: () => void;
  private restoring = false;
  private stopped = false;
  constructor(private options: RecoverySessionOptions) {}
  /** 변경 블록만 예약하고 CLEAN 전이는 즉시 삭제한다. */
  changed(id?: string): void {
    if (this.stopped || this.restoring || !this.options.active()) return;
    let newInput = false;
    for (const key of id ? [id] : this.options.controller.blocks.keys()) {
      const block = this.options.controller.get(key);
      if (!block || block.state.dirtySince === undefined || block.state.status === 'CLEAN') {
        this.pending.delete(key);
        if (this.tracked.delete(key)) this.options.journal.remove(key);
        if (this.restoredIds.delete(key)) this.options.restored(this.restoredIds.size, false);
      } else {
        this.tracked.add(key);
        this.pending.add(key);
        if (this.versions.get(key) !== block.state.version) newInput = true;
        this.versions.set(key, block.state.version);
      }
    }
    if (!this.pending.size || (this.cancel && !newInput)) return;
    this.cancel?.();
    this.cancel = this.options.schedule(() => this.flush(), RECOVERY_LIMITS.debounceMs);
  }
  /** 현재 텍스트를 동기 저장한다. 인증 해제 이후의 늦은 cleanup은 저장하지 않는다. */
  flush(): void {
    this.cancel?.();
    this.cancel = undefined;
    if (this.stopped || !this.options.active()) {
      this.pending.clear();
      return;
    }
    for (const id of this.pending) {
      const block = this.options.controller.get(id);
      if (
        block &&
        block.state.dirtySince !== undefined &&
        block.state.status !== 'CLEAN' &&
        this.options.journal.owns(id)
      )
        this.options.journal.put(
          recoveryRecord(block, (this.options.now ?? Date.now)(), this.options.journal.tabId),
        );
    }
    this.pending.clear();
  }
  /** authoritative 수화·쓰기 권한이 준비된 뒤에만 탭 소유권을 획득하고 일반 편집 경로로 복원한다. */
  restore(): void {
    if (this.stopped || !this.options.active() || !this.options.ready()) return;
    for (const id of this.tracked) this.options.journal.claim(id);
    let count = 0;
    this.restoring = true;
    try {
      for (const record of this.options.journal.read()) {
        const existing = this.options.controller.get(record.tableId);
        if (this.restoredIds.has(record.tableId) || existing?.state.dirtySince !== undefined)
          continue;
        const owned = this.options.journal.claim(record.tableId);
        if (!owned) continue;
        this.restoredIds.add(record.tableId);
        this.tracked.add(record.tableId);
        this.options.controller.recover(
          recoveryBase(owned),
          owned.text,
          owned.editKind,
          this.options.authoritative().find((b) => b.tableId === record.tableId),
        );
        count++;
      }
    } finally {
      this.restoring = false;
    }
    if (count) {
      this.options.restored(this.restoredIds.size);
      this.changed();
    }
  }
  /** 살아 있는 탭의 heartbeat를 갱신하고 crash 후 만료된 레코드를 다시 확인한다. */
  heartbeat(): void {
    if (this.stopped || !this.options.active()) return;
    this.options.journal.heartbeat();
    this.restore();
  }
  /** pagehide·unmount는 공유 문서 쓰기 없이 동기 flush 후 탭 소유권만 해제한다. */
  release(): void {
    this.flush();
    if (this.options.active()) this.options.journal.release();
  }
  /** 복원한 블록을 최신 authoritative 값으로 되돌리거나 삭제된 블록 표시를 제거한다. */
  discard(): void {
    this.restoring = true;
    try {
      for (const id of this.restoredIds) {
        this.pending.delete(id);
        this.tracked.delete(id);
        this.options.journal.remove(id);
        this.options.controller.discardRecovered(id);
      }
      this.restoredIds.clear();
    } finally {
      this.restoring = false;
    }
    this.options.restored(0);
  }
  /** 마운트 해제 후 예약된 저장을 차단한다. */
  dispose(): void {
    this.release();
    this.stopped = true;
  }
}
/** 브라우저 저장소가 허용된 인증 계정에만 저널을 연결한다. */
export function browserRecoveryJournal(
  accountId: string | null | undefined,
  diagramId: string | undefined,
): CodeBlockRecoveryJournal | undefined {
  if (!accountId || !diagramId) return;
  try {
    return new CodeBlockRecoveryJournal(
      window.localStorage,
      accountId,
      diagramId,
      crypto.randomUUID(),
    );
  } catch {
    return;
  }
}
/** 로그아웃·계정 교체 뒤 이전 세션이 저널을 다시 만들지 못하게 한다. */
export function recoveryAccountActive(accountId: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.LOGIN_ID) === accountId;
  } catch {
    return false;
  }
}
