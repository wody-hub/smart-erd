import * as Y from 'yjs';
import type { PreviewDraftOverlayGraph } from './preview-draft-merge.js';

/** code 모드 shared draft Y.Map 키 */
const CODE_MODE_SHARED_DRAFT_KEY = 'codeModeSharedDraft';
/** code 모드 shared draft text write origin */
export const CODE_MODE_SHARED_DRAFT_TEXT_ORIGIN = 'code-mode-shared-draft';
/** code 모드 shared draft preview graph write origin */
export const CODE_MODE_SHARED_DRAFT_GRAPH_ORIGIN = 'code-preview-shared-draft';
/** code 모드 shared draft text 키 */
const CODE_MODE_SHARED_DRAFT_TEXT_KEY = 'text';
/** code 모드 shared draft preview graph 키 */
const CODE_MODE_SHARED_DRAFT_GRAPH_KEY = 'previewGraph';
/** code 모드 shared draft baseline revision 키 */
const CODE_MODE_SHARED_DRAFT_BASELINE_KEY = 'baselineRevision';
/** code 모드 shared draft updatedAt 키 */
const CODE_MODE_SHARED_DRAFT_UPDATED_AT_KEY = 'updatedAt';
/** code 모드 shared draft intentional blank 키 */
const CODE_MODE_SHARED_DRAFT_INTENTIONAL_BLANK_KEY = 'isIntentionalBlank';
/** code 모드 shared draft confirmed blank 키 */
const CODE_MODE_SHARED_DRAFT_CONFIRMED_BLANK_KEY = 'isConfirmedBlank';

/** code 모드 shared draft snapshot */
export interface CodeModeSharedDraftSnapshot {
  /** code 모드 shared DSL text */
  text: string;
  /** draft 생성 시점의 persisted baseline revision */
  baselineRevision: string | null;
  /** 사용자가 의도적으로 빈 코드를 저장했는지 여부 */
  isIntentionalBlank: boolean;
  /** intentional blank가 실제 사용자 입력으로 확인된 상태인지 여부 */
  isConfirmedBlank: boolean;
  /** 공유 preview overlay graph snapshot */
  graph: PreviewDraftOverlayGraph | null;
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
export function replaceCodeModeSharedDraftText(doc: Y.Doc, text: string, origin: unknown): void {
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
 * code 모드 shared draft intentional blank 여부를 읽는다.
 *
 * @param doc 대상 Y.Doc
 * @returns intentional blank 여부
 */
export function readCodeModeSharedDraftIntentionalBlank(doc: Y.Doc): boolean {
  return getCodeModeSharedDraftMap(doc).get(CODE_MODE_SHARED_DRAFT_INTENTIONAL_BLANK_KEY) === true;
}

/**
 * code 모드 shared draft confirmed blank 여부를 읽는다.
 *
 * @param doc 대상 Y.Doc
 * @returns confirmed blank 여부
 */
export function readCodeModeSharedDraftConfirmedBlank(doc: Y.Doc): boolean {
  return getCodeModeSharedDraftMap(doc).get(CODE_MODE_SHARED_DRAFT_CONFIRMED_BLANK_KEY) === true;
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
 * code 모드 shared draft text와 baseline revision을 한 번의 트랜잭션으로 저장한다.
 *
 * 텍스트와 baseline이 모두 동일하면 아무 작업도 하지 않는다.
 *
 * @param doc 대상 Y.Doc
 * @param text 저장할 DSL text
 * @param baselineRevision 저장할 baseline revision
 * @param origin Yjs transaction origin
 * @returns 없음
 */
export function writeCodeModeSharedDraftTextSnapshot(
  doc: Y.Doc,
  text: string,
  baselineRevision: string | null,
  isIntentionalBlank: boolean,
  isConfirmedBlank: boolean,
  origin: unknown,
): void {
  const draftMap = getCodeModeSharedDraftMap(doc);
  const yText = getCodeModeSharedDraftText(doc);
  const currentText = yText.toString();
  const currentBaseline = readCodeModeSharedDraftBaselineRevision(doc);
  const currentIntentionalBlank = readCodeModeSharedDraftIntentionalBlank(doc);
  const currentConfirmedBlank = readCodeModeSharedDraftConfirmedBlank(doc);
  if (
    currentText === text &&
    currentBaseline === baselineRevision &&
    currentIntentionalBlank === isIntentionalBlank &&
    currentConfirmedBlank === isConfirmedBlank
  ) {
    return;
  }

  doc.transact(() => {
    if (currentText !== text) {
      if (yText.length > 0) {
        yText.delete(0, yText.length);
      }
      if (text.length > 0) {
        yText.insert(0, text);
      }
    }

    if (baselineRevision) {
      draftMap.set(CODE_MODE_SHARED_DRAFT_BASELINE_KEY, baselineRevision);
    } else {
      draftMap.delete(CODE_MODE_SHARED_DRAFT_BASELINE_KEY);
    }

    if (isIntentionalBlank) {
      draftMap.set(CODE_MODE_SHARED_DRAFT_INTENTIONAL_BLANK_KEY, true);
    } else {
      draftMap.delete(CODE_MODE_SHARED_DRAFT_INTENTIONAL_BLANK_KEY);
    }

    if (isConfirmedBlank) {
      draftMap.set(CODE_MODE_SHARED_DRAFT_CONFIRMED_BLANK_KEY, true);
    } else {
      draftMap.delete(CODE_MODE_SHARED_DRAFT_CONFIRMED_BLANK_KEY);
    }

    draftMap.set(CODE_MODE_SHARED_DRAFT_UPDATED_AT_KEY, Date.now());
  }, origin);
}

/**
 * raw preview overlay graph JSON을 역직렬화한다.
 *
 * @param raw 저장된 raw JSON
 * @returns preview overlay graph 또는 null
 */
function parseCodeModeSharedDraftGraph(raw: unknown): PreviewDraftOverlayGraph | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PreviewDraftOverlayGraph>;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return null;
    }
    return {
      nodes: parsed.nodes as PreviewDraftOverlayGraph['nodes'],
      edges: parsed.edges as PreviewDraftOverlayGraph['edges'],
    };
  } catch {
    return null;
  }
}

/**
 * code 모드 shared draft preview overlay graph snapshot을 읽는다.
 *
 * @param doc 대상 Y.Doc
 * @returns preview overlay graph 또는 null
 */
export function readCodeModeSharedDraftGraph(doc: Y.Doc): PreviewDraftOverlayGraph | null {
  const raw = getCodeModeSharedDraftMap(doc).get(CODE_MODE_SHARED_DRAFT_GRAPH_KEY);
  return parseCodeModeSharedDraftGraph(raw);
}

/**
 * code 모드 shared draft preview overlay graph snapshot을 저장한다.
 *
 * graph가 null이면 preview graph snapshot을 제거한다.
 *
 * @param doc 대상 Y.Doc
 * @param graph 저장할 preview overlay graph
 * @param origin Yjs transaction origin
 * @returns 없음
 */
export function writeCodeModeSharedDraftGraph(
  doc: Y.Doc,
  graph: PreviewDraftOverlayGraph | null,
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
 * code 모드 shared draft 전체를 비운다.
 *
 * text, baseline revision, preview overlay graph, blank 플래그를 모두 제거하여
 * draft가 published 상태로 승격된 뒤 재부트스트랩에 다시 잡히지 않게 한다.
 *
 * @param doc 대상 Y.Doc
 * @param origin Yjs transaction origin
 * @returns 없음
 */
export function clearCodeModeSharedDraft(doc: Y.Doc, origin: unknown): void {
  const draftMap = getCodeModeSharedDraftMap(doc);
  const yText = getCodeModeSharedDraftText(doc);

  const hasText = yText.length > 0;
  const hasGraph = draftMap.has(CODE_MODE_SHARED_DRAFT_GRAPH_KEY);
  const hasBaseline = draftMap.has(CODE_MODE_SHARED_DRAFT_BASELINE_KEY);
  const hasIntentionalBlank = draftMap.has(CODE_MODE_SHARED_DRAFT_INTENTIONAL_BLANK_KEY);
  const hasConfirmedBlank = draftMap.has(CODE_MODE_SHARED_DRAFT_CONFIRMED_BLANK_KEY);

  if (!hasText && !hasGraph && !hasBaseline && !hasIntentionalBlank && !hasConfirmedBlank) {
    return;
  }

  doc.transact(() => {
    if (yText.length > 0) {
      yText.delete(0, yText.length);
    }
    draftMap.delete(CODE_MODE_SHARED_DRAFT_GRAPH_KEY);
    draftMap.delete(CODE_MODE_SHARED_DRAFT_BASELINE_KEY);
    draftMap.delete(CODE_MODE_SHARED_DRAFT_INTENTIONAL_BLANK_KEY);
    draftMap.delete(CODE_MODE_SHARED_DRAFT_CONFIRMED_BLANK_KEY);
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
    isIntentionalBlank: readCodeModeSharedDraftIntentionalBlank(doc),
    isConfirmedBlank: readCodeModeSharedDraftConfirmedBlank(doc),
    graph: readCodeModeSharedDraftGraph(doc),
    updatedAt: typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : null,
  };
}
