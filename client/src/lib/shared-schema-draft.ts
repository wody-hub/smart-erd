import * as Y from 'yjs';
import type { ParsedRelation, ParsedTable, DdlParseResult } from './ddl-parser.js';
import type { DiagramPreviewPositionRecord } from './diagram-code-draft.js';
import { buildParsedSchemaHash } from './code-sync-schema-hash.js';
import { parseDsl, type DslDictionary } from './dsl-parser.js';
import type { CodeModeSharedDraftSnapshot } from './code-mode-shared-draft.js';

/** code 모드 shared schema draft Y.Map 키 */
const SHARED_SCHEMA_DRAFT_KEY = 'sharedSchemaDraft';
/** shared schema draft write origin */
export const SHARED_SCHEMA_DRAFT_ORIGIN = 'shared-schema-draft';
/** shared schema draft mode 키 */
const SHARED_SCHEMA_DRAFT_MODE_KEY = 'mode';
/** shared schema draft tables 키 */
const SHARED_SCHEMA_DRAFT_TABLES_KEY = 'tables';
/** shared schema draft relations 키 */
const SHARED_SCHEMA_DRAFT_RELATIONS_KEY = 'relations';
/** shared schema draft positions 키 */
const SHARED_SCHEMA_DRAFT_POSITIONS_KEY = 'positions';
/** shared schema draft baseline revision 키 */
const SHARED_SCHEMA_DRAFT_BASELINE_KEY = 'baselineRevision';
/** shared schema draft schema hash 키 */
const SHARED_SCHEMA_DRAFT_SCHEMA_HASH_KEY = 'schemaHash';
/** shared schema draft updatedAt 키 */
const SHARED_SCHEMA_DRAFT_UPDATED_AT_KEY = 'updatedAt';
/** shared schema draft intentional blank 키 */
const SHARED_SCHEMA_DRAFT_INTENTIONAL_BLANK_KEY = 'isIntentionalBlank';
/** shared schema draft confirmed blank 키 */
const SHARED_SCHEMA_DRAFT_CONFIRMED_BLANK_KEY = 'isConfirmedBlank';

/** code 모드 shared schema draft snapshot */
export interface SharedSchemaDraftSnapshot {
  /** draft 모드 */
  mode: 'dsl';
  /** draft 생성 시점의 persisted baseline revision */
  baselineRevision: string | null;
  /** draft schema hash */
  schemaHash: string | null;
  /** shared schema draft 테이블 목록 */
  tables: ParsedTable[];
  /** shared schema draft 관계 목록 */
  relations: ParsedRelation[];
  /** 신규 draft 테이블 위치 정보 */
  positions: DiagramPreviewPositionRecord;
  /** 사용자가 의도적으로 빈 코드를 저장했는지 여부 */
  isIntentionalBlank: boolean;
  /** intentional blank가 실제 사용자 입력으로 확인된 상태인지 여부 */
  isConfirmedBlank: boolean;
  /** 마지막 갱신 시각 (epoch ms) */
  updatedAt: number | null;
}

/**
 * legacy shared code draft graph에서 위치 정보만 추출한다.
 *
 * @param snapshot legacy code-mode shared draft snapshot
 * @returns preview 위치 레코드
 */
function extractLegacyDraftPositions(
  snapshot: CodeModeSharedDraftSnapshot,
): DiagramPreviewPositionRecord {
  const normalized: DiagramPreviewPositionRecord = {};

  for (const node of snapshot.graph?.nodes ?? []) {
    const x = node?.position?.x;
    const y = node?.position?.y;
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
      continue;
    }
    normalized[node.id] = { x, y };
  }

  return normalized;
}

/**
 * Y.Doc에서 shared schema draft 루트 Y.Map을 반환한다.
 *
 * @param doc 대상 Y.Doc
 * @returns shared schema draft Y.Map
 */
export function getSharedSchemaDraftMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(SHARED_SCHEMA_DRAFT_KEY) as Y.Map<unknown>;
}

/**
 * raw JSON 문자열을 배열로 역직렬화한다.
 *
 * @param raw raw JSON 문자열
 * @returns 배열 또는 빈 배열
 */
function parseArrayJson<T>(raw: unknown): T[] {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * preview 위치 저장값을 정규화한다.
 *
 * @param value 외부 입력 값
 * @returns 유효한 preview 위치 레코드
 */
function normalizePreviewPositions(value: unknown): DiagramPreviewPositionRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: DiagramPreviewPositionRecord = {};
  for (const [nodeId, position] of Object.entries(value)) {
    if (!position || typeof position !== 'object') {
      continue;
    }
    const x = (position as { x?: unknown }).x;
    const y = (position as { y?: unknown }).y;
    if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
      continue;
    }
    normalized[nodeId] = { x, y };
  }
  return normalized;
}

/**
 * raw positions JSON 문자열을 역직렬화한다.
 *
 * @param raw raw JSON 문자열
 * @returns preview 위치 레코드
 */
function parsePositionsJson(raw: unknown): DiagramPreviewPositionRecord {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return {};
  }

  try {
    return normalizePreviewPositions(JSON.parse(raw));
  } catch {
    return {};
  }
}

/**
 * shared schema draft snapshot 전체를 읽는다.
 *
 * @param doc 대상 Y.Doc
 * @returns shared schema draft snapshot
 */
export function readSharedSchemaDraftSnapshot(doc: Y.Doc): SharedSchemaDraftSnapshot {
  const draftMap = getSharedSchemaDraftMap(doc);
  const updatedAt = draftMap.get(SHARED_SCHEMA_DRAFT_UPDATED_AT_KEY);
  const mode = draftMap.get(SHARED_SCHEMA_DRAFT_MODE_KEY);
  const baselineRevision = draftMap.get(SHARED_SCHEMA_DRAFT_BASELINE_KEY);
  const schemaHash = draftMap.get(SHARED_SCHEMA_DRAFT_SCHEMA_HASH_KEY);

  return {
    mode: mode === 'dsl' ? 'dsl' : 'dsl',
    baselineRevision: typeof baselineRevision === 'string' ? baselineRevision : null,
    schemaHash: typeof schemaHash === 'string' ? schemaHash : null,
    tables: parseArrayJson<ParsedTable>(draftMap.get(SHARED_SCHEMA_DRAFT_TABLES_KEY)),
    relations: parseArrayJson<ParsedRelation>(draftMap.get(SHARED_SCHEMA_DRAFT_RELATIONS_KEY)),
    positions: parsePositionsJson(draftMap.get(SHARED_SCHEMA_DRAFT_POSITIONS_KEY)),
    isIntentionalBlank: draftMap.get(SHARED_SCHEMA_DRAFT_INTENTIONAL_BLANK_KEY) === true,
    isConfirmedBlank: draftMap.get(SHARED_SCHEMA_DRAFT_CONFIRMED_BLANK_KEY) === true,
    updatedAt: typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : null,
  };
}

/**
 * shared schema draft snapshot이 의미 있는 구조 또는 확정 blank 상태를 가지는지 판정한다.
 *
 * @param snapshot shared schema draft snapshot
 * @returns 복원/렌더 대상으로 볼 수 있으면 true
 */
export function hasSharedSchemaDraftContent(snapshot: SharedSchemaDraftSnapshot | null): boolean {
  if (!snapshot) {
    return false;
  }

  return (
    snapshot.tables.length > 0 ||
    snapshot.relations.length > 0 ||
    (snapshot.isIntentionalBlank && snapshot.isConfirmedBlank)
  );
}

/**
 * shared schema draft snapshot 전체를 저장한다.
 *
 * @param doc 대상 Y.Doc
 * @param snapshot 저장할 shared schema draft snapshot
 * @param origin Yjs transaction origin
 * @returns 없음
 */
export function writeSharedSchemaDraftSnapshot(
  doc: Y.Doc,
  snapshot: Omit<SharedSchemaDraftSnapshot, 'updatedAt'>,
  origin: unknown,
): void {
  const draftMap = getSharedSchemaDraftMap(doc);
  const nextTables = JSON.stringify(snapshot.tables);
  const nextRelations = JSON.stringify(snapshot.relations);
  const nextPositions = JSON.stringify(snapshot.positions);
  const current = readSharedSchemaDraftSnapshot(doc);

  if (
    current.mode === snapshot.mode &&
    current.baselineRevision === snapshot.baselineRevision &&
    current.schemaHash === snapshot.schemaHash &&
    JSON.stringify(current.tables) === nextTables &&
    JSON.stringify(current.relations) === nextRelations &&
    JSON.stringify(current.positions) === nextPositions &&
    current.isIntentionalBlank === snapshot.isIntentionalBlank &&
    current.isConfirmedBlank === snapshot.isConfirmedBlank
  ) {
    return;
  }

  doc.transact(() => {
    draftMap.set(SHARED_SCHEMA_DRAFT_MODE_KEY, snapshot.mode);
    draftMap.set(SHARED_SCHEMA_DRAFT_TABLES_KEY, nextTables);
    draftMap.set(SHARED_SCHEMA_DRAFT_RELATIONS_KEY, nextRelations);
    draftMap.set(SHARED_SCHEMA_DRAFT_POSITIONS_KEY, nextPositions);

    if (snapshot.baselineRevision) {
      draftMap.set(SHARED_SCHEMA_DRAFT_BASELINE_KEY, snapshot.baselineRevision);
    } else {
      draftMap.delete(SHARED_SCHEMA_DRAFT_BASELINE_KEY);
    }

    if (snapshot.schemaHash) {
      draftMap.set(SHARED_SCHEMA_DRAFT_SCHEMA_HASH_KEY, snapshot.schemaHash);
    } else {
      draftMap.delete(SHARED_SCHEMA_DRAFT_SCHEMA_HASH_KEY);
    }

    if (snapshot.isIntentionalBlank) {
      draftMap.set(SHARED_SCHEMA_DRAFT_INTENTIONAL_BLANK_KEY, true);
    } else {
      draftMap.delete(SHARED_SCHEMA_DRAFT_INTENTIONAL_BLANK_KEY);
    }

    if (snapshot.isConfirmedBlank) {
      draftMap.set(SHARED_SCHEMA_DRAFT_CONFIRMED_BLANK_KEY, true);
    } else {
      draftMap.delete(SHARED_SCHEMA_DRAFT_CONFIRMED_BLANK_KEY);
    }

    draftMap.set(SHARED_SCHEMA_DRAFT_UPDATED_AT_KEY, Date.now());
  }, origin);
}

/**
 * shared schema draft의 신규 draft 테이블 위치 정보를 갱신한다.
 *
 * @param doc 대상 Y.Doc
 * @param positions 저장할 preview 위치 레코드
 * @param origin Yjs transaction origin
 * @returns 없음
 */
export function writeSharedSchemaDraftPositions(
  doc: Y.Doc,
  positions: DiagramPreviewPositionRecord,
  origin: unknown,
): void {
  const draftMap = getSharedSchemaDraftMap(doc);
  const nextPositions = JSON.stringify(positions);
  if (draftMap.get(SHARED_SCHEMA_DRAFT_POSITIONS_KEY) === nextPositions) {
    return;
  }

  doc.transact(() => {
    draftMap.set(SHARED_SCHEMA_DRAFT_POSITIONS_KEY, nextPositions);
    draftMap.set(SHARED_SCHEMA_DRAFT_UPDATED_AT_KEY, Date.now());
  }, origin);
}

/**
 * shared schema draft 전체를 비운다.
 *
 * @param doc 대상 Y.Doc
 * @param origin Yjs transaction origin
 * @returns 없음
 */
export function clearSharedSchemaDraft(doc: Y.Doc, origin: unknown): void {
  const draftMap = getSharedSchemaDraftMap(doc);
  const hasContent =
    draftMap.has(SHARED_SCHEMA_DRAFT_TABLES_KEY) ||
    draftMap.has(SHARED_SCHEMA_DRAFT_RELATIONS_KEY) ||
    draftMap.has(SHARED_SCHEMA_DRAFT_POSITIONS_KEY) ||
    draftMap.has(SHARED_SCHEMA_DRAFT_BASELINE_KEY) ||
    draftMap.has(SHARED_SCHEMA_DRAFT_SCHEMA_HASH_KEY) ||
    draftMap.has(SHARED_SCHEMA_DRAFT_INTENTIONAL_BLANK_KEY) ||
    draftMap.has(SHARED_SCHEMA_DRAFT_CONFIRMED_BLANK_KEY);

  if (!hasContent) {
    return;
  }

  doc.transact(() => {
    draftMap.delete(SHARED_SCHEMA_DRAFT_MODE_KEY);
    draftMap.delete(SHARED_SCHEMA_DRAFT_TABLES_KEY);
    draftMap.delete(SHARED_SCHEMA_DRAFT_RELATIONS_KEY);
    draftMap.delete(SHARED_SCHEMA_DRAFT_POSITIONS_KEY);
    draftMap.delete(SHARED_SCHEMA_DRAFT_BASELINE_KEY);
    draftMap.delete(SHARED_SCHEMA_DRAFT_SCHEMA_HASH_KEY);
    draftMap.delete(SHARED_SCHEMA_DRAFT_INTENTIONAL_BLANK_KEY);
    draftMap.delete(SHARED_SCHEMA_DRAFT_CONFIRMED_BLANK_KEY);
    draftMap.set(SHARED_SCHEMA_DRAFT_UPDATED_AT_KEY, Date.now());
  }, origin);
}

/**
 * shared schema draft snapshot을 preview/generator 입력용 parsed schema로 변환한다.
 *
 * @param snapshot shared schema draft snapshot
 * @returns 최소 parsed schema 결과
 */
export function buildParseResultFromSharedSchemaDraft(
  snapshot: SharedSchemaDraftSnapshot,
): DdlParseResult {
  return {
    diagnostics: [],
    errors: [],
    tableRanges: [],
    tables: snapshot.tables,
    relations: snapshot.relations,
  };
}

/**
 * legacy code-mode shared draft를 shared schema draft snapshot으로 변환한다.
 *
 * 텍스트가 파싱 가능하면 schema draft로 승격하고, confirmed blank는 빈 schema draft로
 * 보존한다. 파싱 불가능한 legacy text는 자동 승격하지 않는다.
 *
 * @param snapshot legacy code-mode shared draft snapshot
 * @param dictionary DSL 사전 데이터
 * @returns shared schema draft snapshot 또는 null
 */
export function buildSharedSchemaDraftSnapshotFromLegacyCodeModeDraft(
  snapshot: CodeModeSharedDraftSnapshot,
  dictionary: DslDictionary,
): Omit<SharedSchemaDraftSnapshot, 'updatedAt'> | null {
  const positions = extractLegacyDraftPositions(snapshot);

  if (snapshot.isIntentionalBlank && snapshot.isConfirmedBlank) {
    return {
      mode: 'dsl',
      baselineRevision: snapshot.baselineRevision,
      schemaHash: null,
      tables: [],
      relations: [],
      positions,
      isIntentionalBlank: true,
      isConfirmedBlank: true,
    };
  }

  if (snapshot.text.trim().length === 0) {
    return null;
  }

  const parseResult = parseDsl(snapshot.text, dictionary);
  if (parseResult.result.tables.length === 0 && parseResult.result.relations.length === 0) {
    return null;
  }

  return {
    mode: 'dsl',
    baselineRevision: snapshot.baselineRevision,
    schemaHash: buildParsedSchemaHash(parseResult.result),
    tables: parseResult.result.tables,
    relations: parseResult.result.relations,
    positions,
    isIntentionalBlank: false,
    isConfirmedBlank: false,
  };
}
