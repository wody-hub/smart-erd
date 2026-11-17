import { extractColId } from './handle-id.js';
import { formatDslTableLines, resolveTableLogicalName, type DslFkRef } from './dsl-generator.js';
import type { DslGeneratorDictionary } from './dsl-generator.js';
import type {
  BlockRange,
  DslProjection,
  ProjectionSnapshot,
  TableBlock,
  TextPatch,
  TextPatchBatch,
  BlockRelationMetadata,
} from './dsl-block-contracts.js';

export type * from './dsl-block-contracts.js';

/** 문자열 ID를 UTF-16 코드 단위 순서로 비교한다. */
function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 반복 생성에서 공유할 순수 스냅샷 인덱스를 만든다. */
function buildContext(snapshot: ProjectionSnapshot) {
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const columns = new Map(
    snapshot.nodes.map((node) => [node.id, new Map(node.data.columns.map((col) => [col.id, col]))]),
  );
  const incoming = new Map<string, ProjectionSnapshot['edges']>();
  for (const edge of snapshot.edges) {
    const list = incoming.get(edge.target) ?? [];
    list.push(edge);
    incoming.set(edge.target, list);
  }
  const terms = new Map(snapshot.dictionary.terms.map((term) => [term.id, term]));
  const domains = new Map(snapshot.dictionary.domains.map((domain) => [domain.id, domain]));
  const dictionary: DslGeneratorDictionary = {
    findTermById: (id) => terms.get(id),
    findDomainById: (id) => domains.get(id),
  };
  return { nodes, columns, incoming, terms, dictionary };
}

/** 공용 인덱스를 사용해 단일 블록과 텍스트 밖 원본 정보를 생성한다. */
function generateIndexedBlock(
  tableId: string,
  context: ReturnType<typeof buildContext>,
): TableBlock {
  const node = context.nodes.get(tableId);
  if (!node) throw new Error(`Unknown projection table: ${tableId}`);
  const refs = new Map<string, DslFkRef>();
  const selected = new Map<string, BlockRelationMetadata>();
  const relations: BlockRelationMetadata[] = [];
  const parents = new Set<string>();
  for (const edge of context.incoming.get(tableId) ?? []) {
    parents.add(edge.source);
    const sourceColumnId = edge.sourceHandle
      ? extractColId(edge.sourceHandle, edge.source)
      : undefined;
    const targetColumnId = edge.targetHandle
      ? extractColId(edge.targetHandle, edge.target)
      : undefined;
    const relation: BlockRelationMetadata = {
      edge: structuredClone(edge),
      sourceColumnId,
      targetColumnId,
      emitted: false,
    };
    relations.push(relation);
    const parent = context.nodes.get(edge.source);
    const sourceCol =
      sourceColumnId === undefined
        ? undefined
        : context.columns.get(edge.source)?.get(sourceColumnId);
    const targetCol =
      targetColumnId === undefined
        ? undefined
        : context.columns.get(edge.target)?.get(targetColumnId);
    if (!parent || !sourceCol || !targetCol) continue;
    const previous = selected.get(targetCol.id);
    if (previous) previous.emitted = false;
    relation.emitted = true;
    selected.set(targetCol.id, relation);
    refs.set(targetCol.id, {
      parentTableLogical: resolveTableLogicalName(parent),
      parentColLogical: sourceCol.logicalName || sourceCol.name,
    });
  }
  const lines = formatDslTableLines(node, context.dictionary, (id) => refs.get(id));
  const text = lines.join('\n') + '\n';
  let offset = lines[0].length + 1;
  const columnRanges = node.data.columns.map((column, index) => {
    const length = lines[index + 1].length;
    const range = {
      columnId: column.id,
      logicalName: column.logicalName || column.name,
      start: offset,
      end: offset + length,
      startLine: index + 2,
      endLine: index + 2,
      startColumn: 1,
      endColumn: length + 1,
    };
    offset += length + 1;
    return range;
  });
  const termIds = new Set<number>();
  const domainIds = new Set<number>();
  if (node.data.tableTermId != null) termIds.add(node.data.tableTermId);
  for (const column of node.data.columns) {
    if (column.termId != null) termIds.add(column.termId);
    if (column.domainId != null) domainIds.add(column.domainId);
  }
  for (const termId of termIds) {
    const domainId = context.terms.get(termId)?.domainId;
    if (domainId != null) domainIds.add(domainId);
  }
  return {
    tableId,
    text,
    tableRange: {
      start: 0,
      end: text.length,
      startLine: 1,
      endLine: lines.length + 1,
      startColumn: 1,
      endColumn: 1,
    },
    columnRanges,
    dependencies: {
      tableIds: [...parents].sort(compareId),
      termIds: [...termIds].sort((a, b) => a - b),
      domainIds: [...domainIds].sort((a, b) => a - b),
    },
    metadata: {
      tableId,
      tablePhysicalName: node.data.label,
      tableLogicalName: node.data.logicalTableName,
      tableTermId: node.data.tableTermId,
      columnIds: node.data.columns.map((column) => column.id),
      columns: structuredClone(node.data.columns),
      relations,
      unrepresentedRelationIds: relations
        .filter((relation) => !relation.emitted)
        .map((relation) => relation.edge.id),
    },
  };
}

/**
 * ID로 부모를 조회하고 기존 DSL 포맷으로 한 테이블을 생성한다.
 * 날짜 헤더 없이 LF를 사용하며 컬럼·FK 우선순위는 입력 순서를 따른다.
 * @param tableId 대상 테이블 ID
 * @param snapshot 일관된 일반 데이터 스냅샷
 * @returns 블록 내부 기준 범위와 손실 없는 sidecar
 */
export function generateTableBlock(tableId: string, snapshot: ProjectionSnapshot): TableBlock {
  return generateIndexedBlock(tableId, buildContext(snapshot));
}

/** 기존 블록의 범위를 전체 투영 좌표로 이동한다. */
function moveRange(range: BlockRange, block: TableBlock, offset: number, line: number): BlockRange {
  return {
    ...range,
    start: range.start - block.tableRange.start + offset,
    end: range.end - block.tableRange.start + offset,
    startLine: range.startLine - block.tableRange.startLine + line,
    endLine: range.endLine - block.tableRange.startLine + line,
  };
}

/** 정렬된 블록을 결합하고 범위를 새 텍스트에 맞춰 재계산한다. */
function assemble(revision: ProjectionSnapshot['revision'], input: TableBlock[]): DslProjection {
  let offset = 0;
  let line = 1;
  const blocks = input.map((block, index) => {
    if (index > 0) {
      offset++;
      line++;
    }
    const moved = {
      ...block,
      tableRange: moveRange(block.tableRange, block, offset, line),
      columnRanges: block.columnRanges.map((range) => ({
        ...range,
        ...moveRange(range, block, offset, line),
      })),
    };
    offset += block.text.length;
    line += block.tableRange.endLine - block.tableRange.startLine;
    return moved;
  });
  return { revision, text: blocks.map((block) => block.text).join('\n'), blocks };
}

/** 전체 스냅샷을 로캘 비의존 tableId 순서로 투영한다. */
export function generateProjection(snapshot: ProjectionSnapshot): DslProjection {
  const context = buildContext(snapshot);
  return assemble(
    snapshot.revision,
    [...context.nodes.keys()].sort(compareId).map((id) => generateIndexedBlock(id, context)),
  );
}

/** 공통 접두·접미를 제외한 최소 연속 치환을 계산한다. */
function contiguousPatch(previous: string, next: string, offset: number): TextPatch | undefined {
  if (previous === next) return undefined;
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++;
  let end = previous.length;
  let nextEnd = next.length;
  while (end > start && nextEnd > start && previous[end - 1] === next[nextEnd - 1]) {
    end--;
    nextEnd--;
  }
  return { start: offset + start, end: offset + end, text: next.slice(start, nextEnd) };
}

/**
 * 정렬된 블록을 병합 순회하여 이전 텍스트 기준 패치를 만든다.
 * 변경 블록은 최소 연속 diff, 삽입·삭제 블록은 구분 LF까지 소유한다.
 * @param prev 이전 투영
 * @param next 다음 투영
 * @returns 뒤에서부터 적용할 비중첩 패치 묶음
 */
export function diffProjection(prev: DslProjection, next: DslProjection): TextPatchBatch {
  const patches: TextPatch[] = [];
  let i = 0;
  let j = 0;
  let offset = 0;
  while (i < prev.blocks.length || j < next.blocks.length) {
    const oldBlock = prev.blocks[i];
    const newBlock = next.blocks[j];
    const order = !oldBlock ? 1 : !newBlock ? -1 : compareId(oldBlock.tableId, newBlock.tableId);
    if (order === 0 && oldBlock.text === newBlock.text && (i === 0) === (j === 0)) {
      offset += oldBlock.text.length + (i > 0 ? 1 : 0);
      i++;
      j++;
      continue;
    }
    const previous = order <= 0 ? (i > 0 ? '\n' : '') + oldBlock.text : '';
    const following = order >= 0 ? (j > 0 ? '\n' : '') + newBlock.text : '';
    const patch = contiguousPatch(previous, following, offset);
    if (patch) {
      const last = patches[patches.length - 1];
      // 인접 패치를 합쳐 불필요한 구분자 패치와 같은 위치 삽입을 없앤다.
      if (last && last.end === patch.start) {
        last.end = patch.end;
        last.text += patch.text;
      } else patches.push(patch);
    }
    offset += previous.length;
    if (order <= 0) i++;
    if (order >= 0) j++;
  }
  return { baseRevision: prev.revision, nextRevision: next.revision, patches };
}

/** 용어·도메인 사용 테이블의 역참조 인덱스. */
export interface DictionaryTableIndex {
  termToTables: Map<number, Set<string>>;
  domainToTables: Map<number, Set<string>>;
}

/** 역참조 인덱스에 항목 하나를 추가한다. */
function addUsage(
  index: Map<number, Set<string>>,
  id: number | null | undefined,
  tableId: string,
): void {
  if (id == null) return;
  const users = index.get(id) ?? new Set<string>();
  users.add(tableId);
  index.set(id, users);
}

/** 테이블 용어·컬럼 용어·명시 및 용어 상속 도메인의 사용 인덱스를 만든다. */
export function buildDictionaryTableIndex(snapshot: ProjectionSnapshot): DictionaryTableIndex {
  const termToTables = new Map<number, Set<string>>();
  const domainToTables = new Map<number, Set<string>>();
  const terms = new Map(snapshot.dictionary.terms.map((term) => [term.id, term]));
  for (const node of snapshot.nodes) {
    addUsage(termToTables, node.data.tableTermId, node.id);
    addUsage(
      domainToTables,
      node.data.tableTermId == null ? undefined : terms.get(node.data.tableTermId)?.domainId,
      node.id,
    );
    for (const col of node.data.columns) {
      addUsage(termToTables, col.termId, node.id);
      addUsage(domainToTables, col.domainId, node.id);
      addUsage(
        domainToTables,
        col.termId == null ? undefined : terms.get(col.termId)?.domainId,
        node.id,
      );
    }
  }
  return { termToTables, domainToTables };
}

/** 일반 데이터의 객체 키 순서와 무관한 비교 문자열을 만든다. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      '{' +
      Object.keys(record)
        .sort(compareId)
        .filter((key) => record[key] !== undefined)
        .map((key) => JSON.stringify(key) + ':' + canonical(record[key]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value) ?? 'undefined';
}

/** ID가 같은 항목 중 추가·삭제·내용 변경된 ID를 반환한다. */
function changedIds<T extends { id: string | number }>(
  prev: T[],
  next: T[],
  view: (value: T) => unknown = (value) => value,
): Set<T['id']> {
  const before = new Map(prev.map((value) => [value.id, view(value)]));
  const after = new Map(next.map((value) => [value.id, view(value)]));
  const changed = new Set<T['id']>();
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const oldValue = before.get(id);
    const newValue = after.get(id);
    if (oldValue !== newValue && canonical(oldValue) !== canonical(newValue))
      changed.add(id as T['id']);
  }
  return changed;
}

/** 자식 테이블별 FK 순서를 추적하여 텍스트와 sidecar의 관계 순서를 유지한다. */
function fkOrderGroups(snapshot: ProjectionSnapshot): { id: string; edgeIds: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const edge of snapshot.edges) {
    const id = edge.target;
    const ids = groups.get(id) ?? [];
    ids.push(edge.id);
    groups.set(id, ids);
  }
  return [...groups].map(([id, edgeIds]) => ({ id, edgeIds }));
}

/**
 * 이전·다음 노드, 관계 양끝, 사전 사용자를 합집합한 뒤 FK 양방향 이웃으로 확장한다.
 * 삭제 전 endpoint와 새 endpoint를 모두 사용하며 위치·선택은 입력 계약에서 제외한다.
 */
export function affectedTableIds(prev: ProjectionSnapshot, next: ProjectionSnapshot): Set<string> {
  const affected = changedIds(prev.nodes, next.nodes, (node) => node.data);
  const edgeIds = changedIds(prev.edges, next.edges);
  const orderChanged =
    prev.edges === next.edges
      ? new Set<string>()
      : changedIds(fkOrderGroups(prev), fkOrderGroups(next));
  for (const edge of [...prev.edges, ...next.edges]) {
    if (edgeIds.has(edge.id) || orderChanged.has(edge.target)) {
      affected.add(edge.source);
      affected.add(edge.target);
    }
  }
  const termIds = changedIds(prev.dictionary.terms, next.dictionary.terms);
  const domainIds = changedIds(prev.dictionary.domains, next.dictionary.domains);
  if (termIds.size || domainIds.size) {
    for (const snapshot of [prev, next]) {
      const index = buildDictionaryTableIndex(snapshot);
      for (const id of termIds)
        for (const tableId of index.termToTables.get(id) ?? []) affected.add(tableId);
      for (const id of domainIds)
        for (const tableId of index.domainToTables.get(id) ?? []) affected.add(tableId);
    }
  }
  const seeds = new Set(affected);
  for (const edge of [...prev.edges, ...next.edges]) {
    if (seeds.has(edge.source) || seeds.has(edge.target)) {
      affected.add(edge.source);
      affected.add(edge.target);
    }
  }
  return new Set([...affected].sort(compareId));
}

/**
 * 영향 블록만 재생성하고 나머지 블록의 텍스트·sidecar를 재사용한다.
 * 인덱스·의존성 비교·전체 범위 갱신은 전체 입력 크기에 비례한다.
 */
export function updateProjection(
  previous: DslProjection,
  prevSnapshot: ProjectionSnapshot,
  nextSnapshot: ProjectionSnapshot,
): DslProjection {
  if (previous.revision !== prevSnapshot.revision) throw new Error('Projection revision mismatch');
  const affected = affectedTableIds(prevSnapshot, nextSnapshot);
  const blocks = new Map(previous.blocks.map((block) => [block.tableId, block]));
  const context = buildContext(nextSnapshot);
  return assemble(
    nextSnapshot.revision,
    [...context.nodes.keys()].sort(compareId).map((id) => {
      const old = blocks.get(id);
      return old && !affected.has(id) ? old : generateIndexedBlock(id, context);
    }),
  );
}
