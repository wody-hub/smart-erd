import * as Y from 'yjs';
import type { DslPreviewGraph } from './dsl-preview-graph.js';

/** code 모드 shared draft Y.Map 키 */
const CODE_MODE_SHARED_DRAFT_KEY = 'codeModeSharedDraft';
/** code 모드 shared draft text 키 */
const CODE_MODE_SHARED_DRAFT_TEXT_KEY = 'text';
/** code 모드 shared draft preview graph 키 */
const CODE_MODE_SHARED_DRAFT_GRAPH_KEY = 'previewGraph';
/** code 모드 shared draft baseline revision 키 */
const CODE_MODE_SHARED_DRAFT_BASELINE_KEY = 'baselineRevision';
/** code 모드 shared draft updatedAt 키 */
const CODE_MODE_SHARED_DRAFT_UPDATED_AT_KEY = 'updatedAt';

/** code 모드 shared draft snapshot */
export interface CodeModeSharedDraftSnapshot {
  /** code 모드 shared DSL text */
  text: string;
  /** draft 생성 시점의 persisted baseline revision */
  baselineRevision: string | null;
  /** 공유 preview graph snapshot */
  graph: DslPreviewGraph | null;
  /** 마지막 갱신 시각 (epoch ms) */
  updatedAt: number | null;
}

/**
 * Y.Doc에서 code 모드 shared draft 루트 Y.Map을 반환한다.
 *
 * @param doc 대상 Y.Doc
 * @returns code 모드 shared draft Y.Map
 */
export function getCodeModeSharedDraftMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(CODE_MODE_SHARED_DRAFT_KEY) as Y.Map<unknown>;
}

/**
 * code 모드 shared draft의 Y.Text를 반환한다.
 *
 * 없으면 생성하여 루트 map에 연결한다.
 *
 * @param doc 대상 Y.Doc
 * @returns code 모드 shared draft Y.Text
 */
export function getCodeModeSharedDraftText(doc: Y.Doc): Y.Text {
  const draftMap = getCodeModeSharedDraftMap(doc);
  const existing = draftMap.get(CODE_MODE_SHARED_DRAFT_TEXT_KEY);
  if (existing instanceof Y.Text) {
    return existing;
  }

  const text = new Y.Text();
  draftMap.set(CODE_MODE_SHARED_DRAFT_TEXT_KEY, text);
  return text;
}

/**
 * code 모드 shared draft text를 읽는다.
 *
 * @param doc 대상 Y.Doc
 * @returns 현재 shared draft text
 */
export function readCodeModeSharedDraftText(doc: Y.Doc): string {
  return getCodeModeSharedDraftText(doc).toString();
}

/**
 * code 모드 shared draft text를 통째로 교체한다.
 *
 * @param doc 대상 Y.Doc
 * @param text 저장할 text
 * @param origin Yjs transaction origin
 * @returns 없음
 */
export function replaceCodeModeSharedDraftText(
  doc: Y.Doc,
  text: string,
  origin: unknown,
): void {
  const yText = getCodeModeSharedDraftText(doc);
  const currentText = yText.toString();
  if (currentText === text) {
    return;
  }

  doc.transact(() => {
    if (yText.length > 0) {
      yText.delete(0, yText.length);
    }
    if (text.length > 0) {
      yText.insert(0, text);
    }
  }, origin);
}

/**
 * code 모드 shared draft baseline revision을 읽는다.
 *
 * @param doc 대상 Y.Doc
 * @returns baseline revision 또는 null
 */
export function readCodeModeSharedDraftBaselineRevision(doc: Y.Doc): string | null {
  const value = getCodeModeSharedDraftMap(doc).get(CODE_MODE_SHARED_DRAFT_BASELINE_KEY);
  return typeof value === 'string' ? value : null;
}

/**
 * code 모드 shared draft baseline revision을 저장한다.
 *
 * @param doc 대상 Y.Doc
 * @param baselineRevision 저장할 baseline revision
 * @param origin Yjs transaction origin
 * @returns 없음
 */
export function writeCodeModeSharedDraftBaselineRevision(
  doc: Y.Doc,
  baselineRevision: string | null,
  origin: unknown,
): void {
  const draftMap = getCodeModeSharedDraftMap(doc);
  doc.transact(() => {
    if (baselineRevision) {
      draftMap.set(CODE_MODE_SHARED_DRAFT_BASELINE_KEY, baselineRevision);
    } else {
      draftMap.delete(CODE_MODE_SHARED_DRAFT_BASELINE_KEY);
    }
    draftMap.set(CODE_MODE_SHARED_DRAFT_UPDATED_AT_KEY, Date.now());
  }, origin);
}

/**
 * raw preview graph JSON을 DslPreviewGraph로 역직렬화한다.
 *
 * @param raw 저장된 raw JSON
 * @returns preview graph 또는 null
 */
function parseCodeModeSharedDraftGraph(raw: unknown): DslPreviewGraph | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DslPreviewGraph>;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return null;
    }
    return {
      nodes: parsed.nodes as DslPreviewGraph['nodes'],
      edges: parsed.edges as DslPreviewGraph['edges'],
    };
  } catch {
    return null;
  }
}

/**
 * code 모드 shared draft preview graph snapshot을 읽는다.
 *
 * @param doc 대상 Y.Doc
 * @returns preview graph 또는 null
 */
export function readCodeModeSharedDraftGraph(doc: Y.Doc): DslPreviewGraph | null {
  const raw = getCodeModeSharedDraftMap(doc).get(CODE_MODE_SHARED_DRAFT_GRAPH_KEY);
  return parseCodeModeSharedDraftGraph(raw);
}

/**
 * code 모드 shared draft preview graph snapshot을 저장한다.
 *
 * graph가 null이면 preview graph snapshot을 제거한다.
 *
 * @param doc 대상 Y.Doc
 * @param graph 저장할 preview graph
 * @param origin Yjs transaction origin
 * @returns 없음
 */
export function writeCodeModeSharedDraftGraph(
  doc: Y.Doc,
  graph: DslPreviewGraph | null,
  origin: unknown,
): void {
  const draftMap = getCodeModeSharedDraftMap(doc);
  const nextSerialized = graph ? JSON.stringify(graph) : null;
  const currentSerialized = draftMap.get(CODE_MODE_SHARED_DRAFT_GRAPH_KEY);
  if (currentSerialized === nextSerialized) {
    return;
  }

  doc.transact(() => {
    if (nextSerialized) {
      draftMap.set(CODE_MODE_SHARED_DRAFT_GRAPH_KEY, nextSerialized);
    } else {
      draftMap.delete(CODE_MODE_SHARED_DRAFT_GRAPH_KEY);
    }
    draftMap.set(CODE_MODE_SHARED_DRAFT_UPDATED_AT_KEY, Date.now());
  }, origin);
}

/**
 * code 모드 shared draft snapshot 전체를 읽는다.
 *
 * @param doc 대상 Y.Doc
 * @returns shared draft snapshot
 */
export function readCodeModeSharedDraftSnapshot(doc: Y.Doc): CodeModeSharedDraftSnapshot {
  const draftMap = getCodeModeSharedDraftMap(doc);
  const updatedAt = draftMap.get(CODE_MODE_SHARED_DRAFT_UPDATED_AT_KEY);

  return {
    text: readCodeModeSharedDraftText(doc),
    baselineRevision: readCodeModeSharedDraftBaselineRevision(doc),
    graph: readCodeModeSharedDraftGraph(doc),
    updatedAt: typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : null,
  };
}
