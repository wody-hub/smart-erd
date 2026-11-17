import { tableNameCollision } from '@/lib/code-block-names';
import * as Y from 'yjs';
import { ensureColumnStorage, getColumnYMap, readColumnYMaps } from '@/collaboration/yjs-columns';
import { getTablesMap } from '@/collaboration/yjsBridge';
import { CANVAS_HISTORY_ORIGIN } from '@/constants/canvas-history';
import {
  CODE_BLOCK_COMMIT_KIND,
  type CodeBlockCommit,
  type CodeBlockCommitResult,
  type CodeBlockConflict,
  type CodeBlockFieldPatch,
  type CodeBlockFieldValue,
} from '@/lib/code-block-commit-contract';

/** 사용자 origin은 고정하고 커밋 ID는 transaction 메타데이터로 전달한다. */
export const CODE_BLOCK_COMMIT_META_KEY = 'erd-code-block-commit-id';

/** 문서를 수정하지 않는 포트별 현재 사전 지문 저장소. */
const dictionarySources = new WeakMap<Y.Doc, Map<object, string>>();

/** 투영 포트의 현재 사전 지문을 등록하고 해당 포트만 해제하는 함수를 반환한다. */
export function registerCodeBlockDictionary(
  doc: Y.Doc,
  owner: object,
  fingerprint: string,
): () => void {
  let sources = dictionarySources.get(doc);
  if (!sources) dictionarySources.set(doc, (sources = new Map()));
  sources.set(owner, fingerprint);
  return () => {
    sources.delete(owner);
    if (sources.size === 0) dictionarySources.delete(doc);
  };
}

/** 현재 투영들의 사전 지문이 일치할 때만 authoritative 지문을 반환한다. */
export function getCodeBlockDictionaryFingerprint(doc: Y.Doc): string | undefined {
  const values = new Set(dictionarySources.get(doc)?.values());
  return values.size === 1 ? values.values().next().value : undefined;
}

/** 배열·null을 제외한 외부 객체를 판별한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 공백뿐인 식별자를 차단한다. */
function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 허용하지 않은 부가 필드를 포함한 외부 명령은 거절한다. */
function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

/** 필드별 base와 next의 자료형을 검사한다. 논리명만 null로 제거할 수 있다. */
function isFieldValue(field: string, value: unknown): boolean {
  if (field === 'pk' || field === 'nullable') return typeof value === 'boolean';
  if (field === 'logicalName' || field === 'logicalTableName')
    return value === null || typeof value === 'string';
  return typeof value === 'string' && value.trim().length > 0;
}

/** S4-a에서 허용하는 필드·자료형·단일 대상·중복 패치를 쓰기 전에 검사한다. */
export function isCodeBlockCommit(value: unknown): value is CodeBlockCommit {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['kind', 'commitId', 'tableId', 'dictionaryFingerprint', 'patches']) ||
    value.kind !== CODE_BLOCK_COMMIT_KIND ||
    !isId(value.commitId) ||
    !isId(value.tableId) ||
    typeof value.dictionaryFingerprint !== 'string' ||
    !Array.isArray(value.patches)
  )
    return false;
  const seen = new Set<string>();
  for (const patch of value.patches) {
    if (!isRecord(patch) || patch.tableId !== value.tableId || typeof patch.field !== 'string')
      return false;
    const column = patch.target === 'column';
    if (
      (!column && patch.target !== 'table') ||
      !hasOnlyKeys(patch, [
        'target',
        'tableId',
        ...(column ? ['columnId'] : []),
        'field',
        'baseValue',
        'nextValue',
      ]) ||
      (column && !isId(patch.columnId)) ||
      !(
        column ? ['name', 'logicalName', 'type', 'pk', 'nullable'] : ['label', 'logicalTableName']
      ).includes(patch.field) ||
      !isFieldValue(patch.field, patch.baseValue) ||
      !isFieldValue(patch.field, patch.nextValue)
    )
      return false;
    const key = JSON.stringify([patch.target, column ? patch.columnId : null, patch.field]);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/** 생략된 레거시 필드를 DSL과 같은 의미값으로 정규화한다. */
function readField(body: Y.Map<unknown>, field: string): CodeBlockFieldValue {
  const value = body.get(field);
  if (value === undefined || value === null) {
    if (field === 'pk') return false;
    if (field === 'nullable') return false;
    return null;
  }
  return value as CodeBlockFieldValue;
}

/** strict 커밋에 필요한 현재 사전 및 히스토리 조건. */
export interface CodeBlockApplyOptions {
  dictionaryFingerprint: string | undefined;
  stopHistoryCapture?: () => void;
}

/**
 * 모든 패치를 검증한 뒤에만 기존 ID의 변경 필드를 원자 적용한다.
 * 레거시 이관은 검증 완료 후 사용자 transaction 전에 기존 헬퍼로 수행한다.
 * @param doc authoritative 공유 문서
 * @param value 검증 전 외부 커밋
 * @param options 현재 사전 지문과 undo 경계
 * @returns 적용 결과 또는 문서 변경 없는 거절 결과
 */
export function applyCodeBlockCommit(
  doc: Y.Doc,
  value: unknown,
  options: CodeBlockApplyOptions,
): CodeBlockCommitResult {
  const commitId = isRecord(value) && typeof value.commitId === 'string' ? value.commitId : '';
  if (!isCodeBlockCommit(value)) return { status: 'rejected', commitId, reason: 'invalid' };
  const reject = (
    reason:
      | 'missing-target'
      | 'duplicate-name'
      | 'dictionary-linked'
      | 'dictionary-changed'
      | 'invalid',
    patchIndex?: number,
  ): CodeBlockCommitResult => ({
    status: 'rejected',
    commitId,
    reason,
    ...(patchIndex === undefined ? {} : { patchIndex }),
  });
  if (
    options.dictionaryFingerprint === undefined ||
    value.dictionaryFingerprint !== options.dictionaryFingerprint
  )
    return reject('dictionary-changed');
  const table = getTablesMap(doc).get(value.tableId);
  if (!(table instanceof Y.Map)) return reject('missing-target');
  const changes: CodeBlockFieldPatch[] = [];
  const conflicts: CodeBlockConflict[] = [];
  const names = new Map<string, string>();
  for (const column of readColumnYMaps(table)) {
    if (!(column instanceof Y.Map)) return reject('invalid');
    const id = column.get('id'),
      name = column.get('name');
    if (!isId(id) || !isId(name) || names.has(id)) return reject('invalid');
    names.set(id, name);
  }
  for (const [patchIndex, patch] of value.patches.entries()) {
    const body = patch.target === 'table' ? table : getColumnYMap(table, patch.columnId);
    if (!(body instanceof Y.Map)) return reject('missing-target', patchIndex);
    const currentValue = readField(body, patch.field);
    if (!isFieldValue(patch.field, currentValue)) return reject('invalid', patchIndex);
    if (Object.is(currentValue, patch.nextValue)) continue;
    const linked =
      patch.target === 'table'
        ? body.get('tableTermId') != null
        : body.get('termId') != null || body.get('domainId') != null;
    if (linked && patch.field !== 'pk' && patch.field !== 'nullable')
      return reject('dictionary-linked', patchIndex);
    if (!Object.is(currentValue, patch.baseValue))
      conflicts.push({
        patchIndex,
        baseValue: patch.baseValue,
        currentValue,
        nextValue: patch.nextValue,
      });
    changes.push(patch);
    if (patch.target === 'column' && patch.field === 'name')
      names.set(patch.columnId, patch.nextValue as string);
  }
  if (conflicts.length) return { status: 'rejected', commitId, reason: 'conflict', conflicts };
  const physicalNames = [...names.values()].map((name) => name.toLowerCase());
  if (new Set(physicalNames).size !== physicalNames.length) return reject('duplicate-name');
  if (
    changes.some((patch) => patch.target === 'table') &&
    tableNameCollision(
      {
        label: String(
          changes.find((p) => p.target === 'table' && p.field === 'label')?.nextValue ??
            table.get('label') ??
            '',
        ),
        logicalTableName: changes.some(
          (p) => p.target === 'table' && p.field === 'logicalTableName',
        )
          ? (changes.find((p) => p.target === 'table' && p.field === 'logicalTableName')!
              .nextValue as string | null)
          : (table.get('logicalTableName') as string | undefined),
      },
      [...getTablesMap(doc)]
        .filter(([id]) => id !== value.tableId)
        .map(([, other]) => ({
          label: String(other.get('label') ?? ''),
          logicalTableName: other.get('logicalTableName') as string | undefined,
        })),
    )
  )
    return reject('duplicate-name');
  if (!changes.length) return { status: 'applied', commitId, changedFields: 0, noop: true };
  if (doc._transaction) return reject('invalid');
  if (changes.some((patch) => patch.target === 'column')) {
    try {
      ensureColumnStorage(table);
    } catch {
      return reject('invalid');
    }
  }
  options.stopHistoryCapture?.();
  try {
    doc.transact((transaction) => {
      transaction.meta.set(CODE_BLOCK_COMMIT_META_KEY, commitId);
      for (const patch of changes) {
        const body = patch.target === 'table' ? table : getColumnYMap(table, patch.columnId)!;
        if (patch.nextValue === null) body.delete(patch.field);
        else body.set(patch.field, patch.nextValue);
      }
    }, CANVAS_HISTORY_ORIGIN.USER_CODE_COMMIT);
  } finally {
    options.stopHistoryCapture?.();
  }
  return { status: 'applied', commitId, changedFields: changes.length, noop: false };
}
