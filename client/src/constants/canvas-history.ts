import type * as Y from 'yjs';

/** 캔버스 히스토리 transaction origin 상수. */
export const CANVAS_HISTORY_ORIGIN = {
  USER_TABLE: 'canvas-user-table',
  USER_COLUMN: 'canvas-user-column',
  USER_EDGE: 'canvas-user-edge',
  USER_GROUP: 'canvas-user-group',
  USER_LAYOUT: 'canvas-user-layout',
  SYSTEM_PREVIEW: 'canvas-system-preview',
  SYSTEM_FALLBACK: 'canvas-system-fallback',
  SYSTEM_CODE_SYNC: 'canvas-system-code-sync',
  SYSTEM_DDL_IMPORT: 'canvas-system-ddl-import',
} as const;

/** 노드 drag flush용 shared origin token. observer skip과 undo 추적에서 함께 사용한다. */
export const DRAG_TRANSACTION_ORIGIN = { type: 'canvas-user-drag' } as const;

/** UndoManager capture timeout (ms). */
export const UNDO_CAPTURE_TIMEOUT_MS = 500;

/** UndoManager가 추적할 로컬 편집 origin 집합을 생성한다. */
export function createTrackedCanvasHistoryOrigins(): Set<unknown> {
  return new Set<unknown>([
    CANVAS_HISTORY_ORIGIN.USER_TABLE,
    CANVAS_HISTORY_ORIGIN.USER_COLUMN,
    CANVAS_HISTORY_ORIGIN.USER_EDGE,
    CANVAS_HISTORY_ORIGIN.USER_GROUP,
    CANVAS_HISTORY_ORIGIN.USER_LAYOUT,
    DRAG_TRANSACTION_ORIGIN,
  ]);
}

/**
 * 텍스트 입력 계열 포커스 대상인지 판별한다.
 *
 * @param target 이벤트 타깃
 * @returns 텍스트 입력 계열이면 true
 */
export function isTextInputLikeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea') {
    return true;
  }
  if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
    return true;
  }
  return !!target.closest('.monaco-editor');
}

/** Yjs UndoManager 타입 별칭. */
export type CanvasUndoManager = Y.UndoManager;
