import { STORAGE_KEYS } from '../constants/storage.js';
import type { EditingBlock } from './diagram-code-block-editing.js';
import type { BlockCommitBase, BlockEditKind } from './code-block-commit.js';
import type { BlockCommitStatus } from './code-block-commit-state.js';
import { generateTableBlock, type BlockMetadata } from './dsl-block-projection.js';

/** UTF-8 바이트 기준 저장 상한과 탭 소유권 정책. heartbeat는 원문 TTL을 연장하지 않는다. */
export const RECOVERY_LIMITS = {
  ttlMs: 7 * 24 * 60 * 60 * 1000,
  maxRecords: 50,
  maxRecordBytes: 128 * 1024,
  maxTotalBytes: 1024 * 1024,
  debounceMs: 500,
  heartbeatMs: 5000,
  leaseMs: 30000,
} as const;

/** 공유 문서와 독립적인 버전 1 복구 레코드. ID·사전·토큰 비교 기준을 함께 보존한다. */
export interface CodeBlockRecoveryRecord {
  version: 1;
  savedAt: number;
  tableId: string;
  baseBlockSidecar: BlockMetadata;
  baseText: string;
  text: string;
  state: BlockCommitStatus;
  ownerTabId: string;
  heartbeatAt: number;
  editKind: BlockEditKind;
  dictionaryFingerprint?: string;
  textFieldBaselines?: BlockCommitBase['textFieldBaselines'];
}
/** localStorage와 테스트 저장소가 공유하는 최소 인터페이스. */
export interface RecoveryStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
/** JSON 원문의 UTF-8 크기를 계산한다. */
function bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
/** 배열·null을 제외한 JSON 객체인지 검사한다. */
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** 선택 필드는 존재할 때만 타입을 검사한다. */
function optional(value: unknown, type: string): boolean {
  return value === undefined || typeof value === type;
}
/** 손상된 sidecar가 파서·컨트롤러까지 도달하지 않도록 구조와 안정 ID를 검사한다. */
function valid(value: unknown): value is CodeBlockRecoveryRecord {
  if (
    !object(value) ||
    value.version !== 1 ||
    typeof value.tableId !== 'string' ||
    typeof value.baseText !== 'string' ||
    typeof value.text !== 'string' ||
    typeof value.savedAt !== 'number' ||
    !Number.isFinite(value.savedAt) ||
    typeof value.ownerTabId !== 'string' ||
    typeof value.heartbeatAt !== 'number' ||
    !Number.isFinite(value.heartbeatAt) ||
    !['DIRTY', 'VALID', 'INVALID', 'UNSUPPORTED', 'COMMITTING', 'CONFLICT', 'BLOCKED'].includes(
      String(value.state),
    ) ||
    !['field', 'block-paste', 'duplicate', 'replace-lines', 'reorder'].includes(
      String(value.editKind),
    ) ||
    !optional(value.dictionaryFingerprint, 'string')
  )
    return false;
  if (
    value.textFieldBaselines !== undefined &&
    (!object(value.textFieldBaselines) ||
      !Object.values(value.textFieldBaselines).every(
        (v) => v === null || ['string', 'boolean'].includes(typeof v),
      ))
  )
    return false;
  const m = value.baseBlockSidecar;
  if (
    !object(m) ||
    m.tableId !== value.tableId ||
    typeof m.tablePhysicalName !== 'string' ||
    !optional(m.tableLogicalName, 'string') ||
    !optional(m.tableTermId, 'number') ||
    !Array.isArray(m.columnIds) ||
    !m.columnIds.every((id) => typeof id === 'string') ||
    new Set(m.columnIds).size !== m.columnIds.length ||
    !Array.isArray(m.columns) ||
    m.columns.length !== m.columnIds.length ||
    !Array.isArray(m.relations) ||
    !Array.isArray(m.unrepresentedRelationIds) ||
    !m.unrepresentedRelationIds.every((id) => typeof id === 'string')
  )
    return false;
  const ids = m.columnIds;
  return (
    m.columns.every(
      (c, i) =>
        object(c) &&
        c.id === ids[i] &&
        typeof c.name === 'string' &&
        typeof c.type === 'string' &&
        optional(c.logicalName, 'string') &&
        ['pk', 'nullable', 'fk', 'autoIncrement'].every((k) => optional(c[k], 'boolean')) &&
        ['termId', 'domainId'].every((k) => optional(c[k], 'number')),
    ) &&
    m.relations.every(
      (r) =>
        object(r) &&
        object(r.edge) &&
        typeof r.edge.id === 'string' &&
        typeof r.edge.source === 'string' &&
        typeof r.edge.target === 'string' &&
        typeof r.emitted === 'boolean' &&
        optional(r.sourceColumnId, 'string') &&
        optional(r.targetColumnId, 'string'),
    )
  );
}
/** 컨트롤러 상태를 문서 참조 없는 저장 레코드로 복사한다. */
export function recoveryRecord(
  block: EditingBlock,
  now: number,
  ownerTabId: string,
): CodeBlockRecoveryRecord {
  return structuredClone({
    version: 1,
    savedAt: now,
    tableId: block.base.tableId,
    baseBlockSidecar: block.base.metadata,
    baseText: block.base.text,
    text: block.state.text,
    state: block.state.status,
    ownerTabId,
    heartbeatAt: now,
    editKind: block.kind,
    dictionaryFingerprint: block.base.dictionaryFingerprint,
    textFieldBaselines: block.base.textFieldBaselines,
  });
}
/** 저장된 ID sidecar와 원문으로 비교 기준을 복원한다. 사용자 이름으로 ID를 추측하지 않는다. */
export function recoveryBase(record: CodeBlockRecoveryRecord): BlockCommitBase {
  const m = record.baseBlockSidecar;
  const block = generateTableBlock(record.tableId, {
    revision: 0,
    dictionary: { terms: [], domains: [] },
    nodes: [
      {
        id: record.tableId,
        data: {
          label: m.tablePhysicalName,
          logicalTableName: m.tableLogicalName,
          tableTermId: m.tableTermId,
          columns: m.columns,
        },
      },
    ],
    edges: [],
  });
  return {
    ...block,
    text: record.baseText,
    metadata: structuredClone(m),
    dictionaryFingerprint: record.dictionaryFingerprint,
    textFieldBaselines: record.textFieldBaselines,
  };
}
/** 계정·다이어그램별 단일 키를 사용한다. 쓰기 직전에 다시 읽어 다른 테이블의 최신 값을 보존한다. */
export class CodeBlockRecoveryJournal {
  readonly key: string;
  /** 다른 탭의 커밋이 레코드를 지운 뒤에도 이전 소유자의 늦은 커밋을 거절한다. */
  private owned = new Set<string>();
  constructor(
    private storage: RecoveryStorage,
    readonly accountId: string,
    diagramId: string,
    readonly tabId: string,
    private now: () => number = Date.now,
  ) {
    this.key = `${CodeBlockRecoveryJournal.accountPrefix(accountId)}${encodeURIComponent(diagramId)}`;
  }
  /** 계정 경계를 이스케이프하여 접두사 충돌을 막는다. */
  private static accountPrefix(accountId: string): string {
    return `${STORAGE_KEYS.CODE_BLOCK_RECOVERY_PREFIX}:${encodeURIComponent(accountId)}:`;
  }
  /** 로그아웃 시 해당 계정의 모든 다이어그램 저널을 제거한다. */
  static clearAccount(storage: RecoveryStorage, accountId: string): void {
    try {
      const prefix = this.accountPrefix(accountId);
      const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
      for (const key of keys) if (key?.startsWith(prefix)) storage.removeItem(key);
    } catch {
      /* 저장소 거부가 로그아웃을 방해하지 않는다. */
    }
  }
  /** TTL·버전·크기·구조 검사를 통과한 레코드만 읽고 나머지는 조용히 폐기한다. */
  read(): CodeBlockRecoveryRecord[] {
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      const records =
        object(parsed) && parsed.version === 1 && Array.isArray(parsed.records)
          ? parsed.records.filter(
              (r): r is CodeBlockRecoveryRecord =>
                valid(r) &&
                r.savedAt <= this.now() &&
                this.now() - r.savedAt <= RECOVERY_LIMITS.ttlMs &&
                bytes(r) <= RECOVERY_LIMITS.maxRecordBytes,
            )
          : [];
      const capped = this.cap(records);
      if (JSON.stringify(parsed) !== JSON.stringify({ version: 1, records: capped }))
        this.write(capped);
      return capped;
    } catch {
      try {
        this.storage.removeItem(this.key);
      } catch {
        /* 접근 거부는 무시한다. */
      }
      return [];
    }
  }
  /** 가장 오래된 레코드부터 버려 개수와 총 바이트 상한을 지킨다. */
  private cap(records: CodeBlockRecoveryRecord[]): CodeBlockRecoveryRecord[] {
    const result = [...new Map(records.map((r) => [r.tableId, r])).values()].sort(
      (a, b) => a.savedAt - b.savedAt,
    );
    while (
      result.length > RECOVERY_LIMITS.maxRecords ||
      bytes({ version: 1, records: result }) > RECOVERY_LIMITS.maxTotalBytes
    )
      result.shift();
    return result;
  }
  /** quota·보안 예외가 편집 흐름으로 전파되지 않게 저장한다. */
  private write(records: CodeBlockRecoveryRecord[]): boolean {
    try {
      if (records.length) this.storage.setItem(this.key, JSON.stringify({ version: 1, records }));
      else this.storage.removeItem(this.key);
      return true;
    } catch {
      /* 복구 저장 실패로 편집을 중단하지 않는다. */
      return false;
    }
  }
  /** 테이블별 마지막 쓰기가 이기며 다른 테이블 레코드는 유지한다. */
  put(record: CodeBlockRecoveryRecord): void {
    if (!valid(record) || bytes(record) > RECOVERY_LIMITS.maxRecordBytes) return;
    const records = this.cap([...this.read().filter((r) => r.tableId !== record.tableId), record]);
    if (this.write(records) && record.ownerTabId === this.tabId && records.includes(record))
      this.owned.add(record.tableId);
  }
  /** 자기 탭 또는 해제된 레코드만 삭제한다. */
  remove(tableId: string): void {
    const records = this.read();
    const record = records.find((r) => r.tableId === tableId);
    if (record && record.ownerTabId !== this.tabId && record.ownerTabId !== '') return;
    this.owned.delete(tableId);
    this.write(records.filter((r) => r.tableId !== tableId));
  }
  /** 유효한 heartbeat를 가진 다른 탭의 레코드는 복원하지 않는다. */
  claim(tableId: string): CodeBlockRecoveryRecord | undefined {
    const record = this.read().find((r) => r.tableId === tableId);
    if (
      !record ||
      (record.ownerTabId &&
        record.ownerTabId !== this.tabId &&
        this.now() - record.heartbeatAt <= RECOVERY_LIMITS.leaseMs)
    )
      return;
    const owned = { ...record, ownerTabId: this.tabId, heartbeatAt: this.now() };
    this.put(owned);
    return owned;
  }
  /** 커밋 직전에도 소유권을 확인하여 일시 중지된 탭의 중복 커밋을 막는다. */
  owns(tableId: string): boolean {
    const record = this.read().find((r) => r.tableId === tableId);
    return record ? record.ownerTabId === this.tabId : !this.owned.has(tableId);
  }
  /** 원문 저장 시각을 바꾸지 않고 자기 레코드의 생존 신호만 갱신한다. */
  heartbeat(): void {
    this.write(
      this.read().map((r) => (r.ownerTabId === this.tabId ? { ...r, heartbeatAt: this.now() } : r)),
    );
  }
  /** 정상 종료·pagehide에서는 소유권을 즉시 해제하여 reload 복원을 허용한다. */
  release(): void {
    this.write(
      this.read().map((r) =>
        r.ownerTabId === this.tabId ? { ...r, ownerTabId: '', heartbeatAt: 0 } : r,
      ),
    );
  }
}
