import { duplicateColumnNames, tableNameCollision } from './code-block-names.js';
import {
  CODE_BLOCK_COMMIT_KIND,
  type CodeBlockCommit,
  type CodeBlockFieldPatch,
  type CodeBlockFieldValue,
  type CodeBlockColumnField,
  type CodeBlockTableField,
} from './code-block-commit-contract.js';
import type { BlockMetadata, ProjectionSnapshot, TableBlock } from './dsl-block-contracts.js';
import { generateTableBlock } from './dsl-block-projection.js';
import { formatDslTableLines } from './dsl-generator.js';
import { normalizeBlockDisplayName } from './dsl-block-display.js';
import {
  parseDslBlock,
  type DslBlockParseResult,
  type DslDictionary,
  type DslError,
} from './dsl-parser.js';
import { buildWordMatchIndex } from './word-composition.js';
import type { Domain, Term } from '../types/dictionary.js';

export * from './code-block-commit-state.js';

/** 원격 병합 후에도 화면 토큰의 비교 기준을 유지하는 불변 편집 기준. */
export interface BlockCommitBase extends TableBlock {
  textFieldBaselines?: Record<string, CodeBlockFieldValue>;
  /** 편집 시작 시 관측한 사전 지문. 제공하면 계산 단계에서도 변경을 차단한다. */
  dictionaryFingerprint?: string;
}
/** 커밋하지 않고 로컬 텍스트와 진단을 유지하는 결과. */
export interface BlockCommitFailure {
  status: 'unsupported' | 'invalid';
  reasons: string[];
  diagnostics: DslError[];
}
/** 위치·내용 검증을 통과한 안정 ID 바인딩. */
export interface BoundBlockIds {
  status: 'bound';
  tableId: string;
  parsed: DslBlockParseResult;
  original: DslBlockParseResult;
}
/** 사용자 편집 이력에서 확인한 구조 변경은 텍스트 유사도보다 우선한다. */
export type BlockEditKind = 'field' | 'block-paste' | 'duplicate' | 'replace-lines' | 'reorder';

const tableFields: CodeBlockTableField[] = ['label', 'logicalTableName'];
const columnFields: CodeBlockColumnField[] = ['name', 'logicalName', 'type', 'pk', 'nullable'];

/** 사전 미등록 진단을 생성하되 이름의 물리명 자동 재추론은 편집 토큰에만 사용한다. */
function emptyDictionary(): DslDictionary {
  return {
    termByName: new Map(),
    domainByName: new Map(),
    domainById: new Map(),
    wordMatchIndex: buildWordMatchIndex([]),
  };
}
/** 투영 사전에서 파서가 읽는 이름·도메인 인덱스를 만든다. 단어 추론은 명시 인자로만 받는다. */
function snapshotDictionary(snapshot: ProjectionSnapshot): DslDictionary {
  return {
    ...emptyDictionary(),
    termByName: new Map(
      snapshot.dictionary.terms.map((term) => [display(term.logicalName), term as Term]),
    ),
    domainByName: new Map(
      snapshot.dictionary.domains.map((domain) => [display(domain.logicalName), domain as Domain]),
    ),
    domainById: new Map(snapshot.dictionary.domains.map((domain) => [domain.id, domain as Domain])),
  };
}
/** sidecar만 주어진 경우 이름·컬럼 순서 기준 텍스트를 복원한다. */
function asBlock(base: TableBlock | BlockMetadata): BlockCommitBase {
  if ('metadata' in base) return base;
  return generateTableBlock(base.tableId, {
    revision: 0,
    nodes: [
      {
        id: base.tableId,
        data: {
          label: base.tablePhysicalName,
          logicalTableName: base.tableLogicalName,
          tableTermId: base.tableTermId,
          columns: base.columns,
        },
      },
    ],
    edges: [],
    dictionary: { terms: [], domains: [] },
  });
}
/** 오류 위치를 포함해 자동 적용 불가 사유를 만든다. */
function failure(
  status: BlockCommitFailure['status'],
  reason: string,
  parsed?: DslBlockParseResult,
  index?: number,
): BlockCommitFailure {
  const range = index === undefined ? parsed?.tableRange : parsed?.columnRanges[index];
  return {
    status,
    reasons: [reason],
    diagnostics: [
      ...(parsed?.diagnostics ?? []),
      {
        messageKey: `erd.codeBlock.${reason}`,
        severity: 'error',
        line: range?.startLine ?? 1,
        startColumn: range?.startColumn ?? 1,
        endColumn: Math.max(2, range?.endColumn ?? 2),
      },
    ],
  };
}
/** 병합 전부터 중복인 블록은 위치로 ID를 추측하지 않고 명시적 이름 진단을 반환한다. */
function duplicateNameFailure(
  duplicates: ReturnType<typeof duplicateColumnNames>,
): BlockCommitFailure {
  return {
    status: 'invalid',
    reasons: ['duplicate-name'],
    diagnostics: [
      {
        messageKey: 'erd.unifiedEditing.duplicateColumnNames',
        messageArgs: {
          count: String(duplicates.reduce((count, issue) => count + issue.columnIds.length, 0)),
          names: duplicates.map((issue) => issue.name).join(', '),
        },
        severity: 'error',
        line: 1,
        startColumn: 1,
        endColumn: 2,
      },
    ],
  };
}
/** 표시 이름만 비교하며 원본 CR/LF와 물리명은 sidecar에 남긴다. */
function display(value: string): string {
  return normalizeBlockDisplayName(value).trim();
}

/**
 * 같은 열 수·순서에서 위치로 ID를 결합한다. 기존 이름이 다른 위치로 이동하면 거절한다.
 * 이름이 모두 바뀐 교체/붙여넣기는 텍스트만으로 판별 불가하므로 호출자가 editKind를 제공한다.
 */
export function bindBlockIds(
  base: TableBlock | BlockMetadata,
  editedText: string,
  dictionary: DslDictionary = emptyDictionary(),
  editKind: BlockEditKind = 'field',
): BoundBlockIds | BlockCommitFailure {
  const block = asBlock(base);
  const duplicates = duplicateColumnNames(block.metadata.columns);
  if (duplicates.length) return duplicateNameFailure(duplicates);
  const options = { unknownTermSeverity: 'warning' as const };
  const original = parseDslBlock(block.text, dictionary, options);
  const parsed = parseDslBlock(editedText, dictionary, options);
  if (editKind !== 'field') return failure('unsupported', 'structure-changed', parsed);
  if (!editedText.trim() || parsed.result.tables.length > 1)
    return failure('unsupported', 'structure-changed', parsed);
  if (!parsed.syntax || !original.syntax) return failure('invalid', 'syntax', parsed);
  if (parsed.syntax.columns.length !== block.metadata.columnIds.length)
    return failure('unsupported', 'structure-changed', parsed);
  if (
    block.tableId !== block.metadata.tableId ||
    new Set(block.metadata.columnIds).size !== block.metadata.columnIds.length ||
    block.metadata.columns.some((col, index) => col.id !== block.metadata.columnIds[index])
  )
    return failure('unsupported', 'ambiguous-id', parsed);
  const originals = block.metadata.columns.map((col) => col.logicalName || col.name);
  const names = originals.map(display);
  if (
    names.some((name, index) =>
      names.some((other, j) => j !== index && other === name && originals[j] !== originals[index]),
    )
  )
    return failure('unsupported', 'ambiguous-id', parsed);
  // 중복 입력은 이름 이동 검사보다 먼저 진단한다.
  if (parsed.diagnostics.some((d) => d.messageKey.includes('duplicateColumnLogicalName')))
    return failure('invalid', 'duplicate-name', parsed);
  for (let index = 0; index < parsed.syntax.columns.length; index++) {
    const col = parsed.syntax.columns[index];
    if (
      names.some(
        (name, j) => j !== index && name === col.logicalName && names[index] !== col.logicalName,
      )
    )
      return failure('unsupported', 'structure-changed', parsed, index);
  }
  parsed.columnRanges.forEach((range, index) => {
    range.columnId = block.metadata.columnIds[index];
  });
  return { status: 'bound', tableId: block.tableId, parsed, original };
}

/** 패치 주소를 구분 문자와 무관한 안정 키로 만든다. */
function fieldKey(target: 'table' | 'column', id: string, field: string): string {
  return JSON.stringify([target, id, field]);
}
/** sidecar에서 계약의 필드 값을 읽는다. 선택 불리언은 문서 기본값으로 정규화한다. */
function readValue(
  metadata: BlockMetadata,
  patch: CodeBlockFieldPatch,
): CodeBlockFieldValue | undefined {
  if (patch.target === 'table')
    return patch.field === 'label'
      ? metadata.tablePhysicalName
      : (metadata.tableLogicalName ?? null);
  const column = metadata.columns.find((col) => col.id === patch.columnId);
  if (!column) return undefined;
  const value = column[patch.field];
  return patch.field === 'pk' || patch.field === 'nullable' ? !!value : (value ?? null);
}
/** 원본 값과 바뀐 토큰만 비교하기 위한 텍스트 필드 서명을 만든다. */
function tokenValues(
  parsed: DslBlockParseResult,
  metadata: BlockMetadata,
): Record<string, CodeBlockFieldValue> {
  const values: Record<string, CodeBlockFieldValue> = {};
  for (const field of tableFields)
    values[fieldKey('table', metadata.tableId, field)] = parsed.syntax!.logicalName;
  parsed.syntax!.columns.forEach((col, i) => {
    const id = metadata.columnIds[i];
    const options = col.options.map((option) => option.toUpperCase());
    for (const field of columnFields) {
      values[fieldKey('column', id, field)] =
        field === 'name' || field === 'logicalName'
          ? col.logicalName
          : field === 'type'
            ? (col.explicitType ?? null)
            : field === 'pk'
              ? options.includes('PK')
              : !(options.includes('PK') || options.includes('NN'));
    }
  });
  return values;
}

/** 블록 편집의 입력. 현재 스냅샷은 대상 존재·중복·충돌 확인에만 사용한다. */
export interface ComputeBlockCommitInput {
  base: BlockCommitBase;
  edited: string;
  currentSnapshot: ProjectionSnapshot;
  dictionaryFingerprint: string;
  commitId: string;
  dictionary?: DslDictionary;
  editKind?: BlockEditKind;
}
/** 현재 문서의 관측 충돌. 적용 전 UI 선택이 필요하며 커밋은 반환하지 않는다. */
export interface BlockFieldConflict {
  target: 'table' | 'column';
  columnId?: string;
  field: CodeBlockTableField | CodeBlockColumnField;
  baseValue: CodeBlockFieldValue;
  localValue: CodeBlockFieldValue;
  currentValue: CodeBlockFieldValue;
}
/** 필드 패치와 함께 충돌 상세를 유지하는 자동 커밋 거절. */
export interface BlockCommitConflictFailure extends BlockCommitFailure {
  conflicts?: BlockFieldConflict[];
}

/**
 * base→local에서 바뀐 토큰만 기존 엔티티의 필드 패치로 만든다.
 * 물리명은 이름 토큰을 직접 편집했을 때만 산출하고 연결·관계·구조는 쓰지 않는다.
 */
export function computeBlockCommit(
  input: ComputeBlockCommitInput,
): CodeBlockCommit | BlockCommitConflictFailure {
  const { base, edited, currentSnapshot, dictionaryFingerprint, commitId } = input;
  if (
    base.dictionaryFingerprint !== undefined &&
    base.dictionaryFingerprint !== dictionaryFingerprint
  )
    return failure('unsupported', 'dictionary-changed');
  const existing = currentSnapshot.nodes.find((node) => node.id === base.tableId);
  const duplicates = existing && duplicateColumnNames(existing.data.columns);
  if (duplicates?.length) return duplicateNameFailure(duplicates);
  const bound = bindBlockIds(
    base,
    edited,
    input.dictionary ?? snapshotDictionary(currentSnapshot),
    input.editKind,
  );
  if (bound.status !== 'bound') return bound;
  const { parsed, original } = bound;
  const oldSyntax = original.syntax!,
    syntax = parsed.syntax!;
  for (let i = 0; i < syntax.columns.length; i++) {
    const prev = oldSyntax.columns[i],
      next = syntax.columns[i];
    if (/[[\]{}:>]/.test(next.logicalName)) return failure('invalid', 'syntax', parsed, i);
    if (prev.explicitType && !next.explicitType && !next.domainName)
      return failure('invalid', 'type-required', parsed, i);
    if (prev.fkTable !== next.fkTable || prev.fkColumn !== next.fkColumn)
      return failure('unsupported', 'fk-changed', parsed, i);
    if (prev.domainName !== next.domainName)
      return failure('unsupported', 'dictionary-linked', parsed, i);
    const extra = (options: string[]) =>
      options
        .map((option) => option.toUpperCase())
        .filter((option) => option !== 'PK' && option !== 'NN')
        .sort()
        .join(',');
    if (extra(prev.options) !== extra(next.options))
      return failure('unsupported', 'unsupported-option', parsed, i);
    if (next.options.some((option) => !['PK', 'NN', 'AI'].includes(option.toUpperCase())))
      return failure('invalid', 'syntax', parsed, i);
  }
  // 동일 FK 토큰은 sidecar의 관계 ID가 기준이다. 부모 rename은 로컬 오류로 취급하지 않는다.
  const errors = parsed.diagnostics.filter((d) => {
    if (
      d.severity !== 'error' ||
      d.messageKey.includes('unknownFk') ||
      d.messageKey.includes('duplicateColumnPhysicalName')
    )
      return false;
    // 미편집 도메인은 기존 링크가 기준이다. 외부 사전이 없는 병합 계산에서도 PK 편집을 허용한다.
    if (d.messageKey.endsWith('unknownDomain')) {
      const index = syntax.columns.findIndex((col) => col.line === d.line);
      if (
        index >= 0 &&
        base.metadata.columns[index].domainId != null &&
        syntax.columns[index].domainName === oldSyntax.columns[index].domainName
      )
        return false;
    }
    return true;
  });
  if (errors.length)
    return { status: 'invalid', reasons: ['syntax'], diagnostics: parsed.diagnostics };
  const current = currentSnapshot.nodes.find((node) => node.id === base.tableId);
  if (!current) return failure('unsupported', 'entity-removed', parsed);
  const currentMetadata = {
    ...base.metadata,
    tablePhysicalName: current.data.label,
    tableLogicalName: current.data.logicalTableName,
    columns: current.data.columns,
  };
  const before = base.textFieldBaselines ?? tokenValues(original, base.metadata);
  const after = tokenValues(parsed, base.metadata);
  const patches: CodeBlockFieldPatch[] = [];
  const table = parsed.result.tables[0];
  for (const field of tableFields) {
    if (
      before[fieldKey('table', base.tableId, field)] ===
      after[fieldKey('table', base.tableId, field)]
    )
      continue;
    if (base.metadata.tableTermId != null || current.data.tableTermId != null)
      return failure('unsupported', 'dictionary-linked', parsed);
    const patch: CodeBlockFieldPatch = {
      target: 'table',
      tableId: base.tableId,
      field,
      baseValue:
        field === 'label'
          ? base.metadata.tablePhysicalName
          : (base.metadata.tableLogicalName ?? null),
      nextValue: field === 'label' ? table.name : (table.logicalTableName ?? null),
    };
    if (patch.baseValue !== patch.nextValue) patches.push(patch);
  }
  for (let i = 0; i < base.metadata.columns.length; i++) {
    const column = base.metadata.columns[i],
      next = table.columns[i];
    const currentColumn = current.data.columns.find((col) => col.id === column.id);
    if (!currentColumn) return failure('unsupported', 'entity-removed', parsed, i);
    for (const field of columnFields) {
      if (
        before[fieldKey('column', column.id, field)] === after[fieldKey('column', column.id, field)]
      )
        continue;
      if (
        ['name', 'logicalName', 'type'].includes(field) &&
        (column.termId != null ||
          column.domainId != null ||
          currentColumn.termId != null ||
          currentColumn.domainId != null)
      )
        return failure('unsupported', 'dictionary-linked', parsed, i);
      // 새 토큰이 사전 항목에 연결되더라도 이번 조각은 링크를 생성하지 않는다.
      if (
        ['name', 'logicalName', 'type'].includes(field) &&
        (next.termId != null || next.domainId != null)
      )
        return failure('unsupported', 'dictionary-linked', parsed, i);
      const patch: CodeBlockFieldPatch = {
        target: 'column',
        tableId: base.tableId,
        columnId: column.id,
        field,
        baseValue: null,
        nextValue: field === 'logicalName' ? (next.logicalName ?? null) : next[field],
      };
      patch.baseValue = readValue(base.metadata, patch)!;
      if (patch.baseValue !== patch.nextValue) patches.push(patch);
    }
  }
  const conflicts: BlockFieldConflict[] = [];
  for (const patch of patches) {
    const value = readValue(currentMetadata, patch)!;
    if (classifyField(patch.baseValue, patch.nextValue, value) === 'conflict')
      conflicts.push({
        target: patch.target,
        columnId: patch.target === 'column' ? patch.columnId : undefined,
        field: patch.field,
        baseValue: patch.baseValue,
        localValue: patch.nextValue,
        currentValue: value,
      });
  }
  if (conflicts.length) return { ...failure('unsupported', 'conflict', parsed), conflicts };
  if (
    patches.some((patch) => patch.target === 'table') &&
    tableNameCollision(
      {
        label: String(
          patches.find((p) => p.target === 'table' && p.field === 'label')?.nextValue ??
            current.data.label,
        ),
        logicalTableName: patches.some(
          (p) => p.target === 'table' && p.field === 'logicalTableName',
        )
          ? (patches.find((p) => p.target === 'table' && p.field === 'logicalTableName')!
              .nextValue as string | null)
          : current.data.logicalTableName,
      },
      currentSnapshot.nodes.filter((node) => node.id !== base.tableId).map((node) => node.data),
    )
  )
    return failure('invalid', 'duplicate-name', parsed);
  const finalNames = new Map<string, string>();
  for (const column of current.data.columns) {
    const patch = patches.find(
      (p) => p.target === 'column' && p.columnId === column.id && p.field === 'name',
    );
    const name = String(patch?.nextValue ?? column.name).toLowerCase();
    if (finalNames.has(name))
      return failure(
        'invalid',
        'duplicate-name',
        parsed,
        base.metadata.columnIds.indexOf(column.id),
      );
    finalNames.set(name, column.id);
  }
  return {
    kind: CODE_BLOCK_COMMIT_KIND,
    commitId,
    tableId: base.tableId,
    dictionaryFingerprint,
    patches,
  };
}

/** 같은 필드의 세 값을 엄격한 동등 비교로 분류한다. */
export function classifyField<T>(
  base: T,
  local: T,
  current: T,
): 'unchanged' | 'local-only' | 'remote-only' | 'same-change' | 'conflict' {
  if (local === base) return current === base ? 'unchanged' : 'remote-only';
  if (current === base) return 'local-only';
  return local === current ? 'same-change' : 'conflict';
}

/** 로컬 텍스트를 유지하는 원자적인 원격 재기준 결과. */
export type RemoteBlockMergeResult =
  | { status: 'merged'; base: BlockCommitBase; edited: string }
  | { status: 'conflict'; conflicts: BlockFieldConflict[]; edited: string }
  | { status: 'entity-removed'; edited: string }
  | BlockCommitFailure;

/**
 * 원문을 덮어쓰지 않고 원격 값을 sidecar에 반영한다. 같은 변경은 비교 기준도 전진시킨다.
 * 삭제·구조 변경·동일 필드 충돌은 자동으로 재생성하지 않는다.
 */
export function mergeRemoteIntoLocalEdit({
  base,
  edited,
  authoritativeBlock,
  dictionary,
}: {
  base: BlockCommitBase;
  edited: string;
  authoritativeBlock: TableBlock | null | undefined;
  dictionary?: DslDictionary;
}): RemoteBlockMergeResult {
  if (
    !authoritativeBlock ||
    authoritativeBlock.tableId !== base.tableId ||
    base.metadata.columnIds.some((id) => !authoritativeBlock.metadata.columnIds.includes(id))
  )
    return { status: 'entity-removed', edited };
  if (
    JSON.stringify(base.metadata.columnIds) !==
    JSON.stringify(authoritativeBlock.metadata.columnIds)
  )
    return failure('unsupported', 'structure-changed');
  const snapshot: ProjectionSnapshot = {
    revision: 0,
    dictionary: { terms: [], domains: [] },
    edges: [],
    nodes: [
      {
        id: base.tableId,
        data: {
          label: base.metadata.tablePhysicalName,
          logicalTableName: base.metadata.tableLogicalName,
          tableTermId: base.metadata.tableTermId,
          columns: base.metadata.columns,
        },
      },
    ],
  };
  const commit = computeBlockCommit({
    base,
    edited,
    currentSnapshot: snapshot,
    dictionaryFingerprint: base.dictionaryFingerprint ?? '',
    commitId: '',
    dictionary,
  });
  if (!('kind' in commit)) return commit;
  const bound = bindBlockIds(base, edited, dictionary);
  if (bound.status !== 'bound') return bound;
  const before = { ...(base.textFieldBaselines ?? tokenValues(bound.original, base.metadata)) };
  const after = tokenValues(bound.parsed, base.metadata);
  const conflicts: BlockFieldConflict[] = [];
  const metadata = structuredClone(base.metadata);
  for (const patch of commit.patches) {
    const currentValue = readValue(authoritativeBlock.metadata, patch)!;
    const classification = classifyField(patch.baseValue, patch.nextValue, currentValue);
    if (classification === 'conflict')
      conflicts.push({
        target: patch.target,
        columnId: patch.target === 'column' ? patch.columnId : undefined,
        field: patch.field,
        baseValue: patch.baseValue,
        localValue: patch.nextValue,
        currentValue,
      });
    if (classification === 'same-change') {
      const key = fieldKey(
        patch.target,
        patch.target === 'column' ? patch.columnId : patch.tableId,
        patch.field,
      );
      before[key] = after[key];
    }
  }
  if (conflicts.length) return { status: 'conflict', conflicts, edited };
  metadata.tablePhysicalName = authoritativeBlock.metadata.tablePhysicalName;
  metadata.tableLogicalName = authoritativeBlock.metadata.tableLogicalName;
  metadata.tableTermId = authoritativeBlock.metadata.tableTermId;
  metadata.columns = structuredClone(authoritativeBlock.metadata.columns);
  metadata.relations = structuredClone(authoritativeBlock.metadata.relations);
  metadata.unrepresentedRelationIds = [...authoritativeBlock.metadata.unrepresentedRelationIds];
  return { status: 'merged', base: { ...base, metadata, textFieldBaselines: before }, edited };
}

/** 자기 커밋의 실제 값이 확인된 패치만 반환한다. 같은 배치의 다른 변경은 그대로 처리한다. */
export function ownCommitEchoPatchIndexes(
  commitIds: Iterable<string>,
  authoritativeBlock: TableBlock,
  commit: CodeBlockCommit,
): number[] {
  if (![...commitIds].includes(commit.commitId) || authoritativeBlock.tableId !== commit.tableId)
    return [];
  return commit.patches.flatMap((patch, index) =>
    readValue(authoritativeBlock.metadata, patch) === patch.nextValue ? [index] : [],
  );
}

/** 원래 FK·도메인 토큰으로 자기 패치만 적용한 예상 표시를 만든다. 외부 표시 변경도 감지한다. */
function expectedEchoText(base: TableBlock, metadata: BlockMetadata): string | undefined {
  const parsed = parseDslBlock(base.text, emptyDictionary(), { unknownTermSeverity: 'warning' });
  if (!parsed.syntax) return undefined;
  const columns = new Map(
    metadata.columnIds.map((id, index) => [id, parsed.syntax!.columns[index]]),
  );
  const domains = new Map(
    metadata.columns.flatMap((col) => {
      const label = columns.get(col.id)?.domainName;
      return col.domainId != null && label ? [[col.domainId, { logicalName: label }] as const] : [];
    }),
  );
  const lines = formatDslTableLines(
    {
      data: {
        label: metadata.tablePhysicalName,
        logicalTableName: metadata.tableLogicalName,
        columns: metadata.columns,
      },
    },
    { findTermById: () => undefined, findDomainById: (id) => domains.get(id) },
    (id) => {
      const raw = columns.get(id);
      if (!raw?.fkTable || !raw.fkColumn) return undefined;
      const relation = metadata.relations.find(
        (item) => item.emitted && item.targetColumnId === id,
      );
      if (relation?.edge.source === metadata.tableId) {
        const source = metadata.columns.find((col) => col.id === relation.sourceColumnId);
        if (source)
          return {
            parentTableLogical: metadata.tableLogicalName || metadata.tablePhysicalName,
            parentColLogical: source.logicalName || source.name,
          };
      }
      return { parentTableLogical: raw.fkTable, parentColLogical: raw.fkColumn };
    },
  );
  return lines.map(normalizeBlockDisplayName).join('\n') + '\n';
}

/**
 * 커밋 ID와 실제 값을 대조한다. 전체 echo 확인에는 편집 전 블록도 필요하다.
 * 기준이 없으면 외부 변경을 놓치지 않도록 false를 반환하고 배치를 버리지 않는다.
 */
export function isOwnCommitEcho(
  commitIds: Iterable<string>,
  authoritativeBlock: TableBlock,
  commit: CodeBlockCommit,
  baseBlock?: TableBlock,
): boolean {
  if (
    ![...commitIds].includes(commit.commitId) ||
    authoritativeBlock.tableId !== commit.tableId ||
    !baseBlock
  )
    return false;
  const expected = structuredClone(baseBlock.metadata);
  for (const patch of commit.patches) {
    if (readValue(authoritativeBlock.metadata, patch) !== patch.nextValue) return false;
    if (patch.target === 'table') {
      if (patch.field === 'label') expected.tablePhysicalName = String(patch.nextValue);
      else
        expected.tableLogicalName = patch.nextValue === null ? undefined : String(patch.nextValue);
    } else {
      const column = expected.columns.find((col) => col.id === patch.columnId);
      if (!column) return false;
      Object.assign(column, { [patch.field]: patch.nextValue });
    }
  }
  return (
    JSON.stringify(expected) === JSON.stringify(authoritativeBlock.metadata) &&
    expectedEchoText(baseBlock, expected) === authoritativeBlock.text
  );
}
