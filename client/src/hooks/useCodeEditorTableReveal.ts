import { useEffect, useRef, type RefObject } from 'react';
import type * as Monaco from 'monaco-editor';
import type {
  CodeEditorNavigableTable,
  CodeEditorTableRevealRequest,
} from '@/lib/code-editor-table-navigation';
import { resolveCodeEditorNavigableTableByRequest } from '@/lib/code-editor-table-navigation';

interface UseCodeEditorTableRevealOptions {
  /** 기능 활성 여부 */
  enabled: boolean;
  /** Monaco 에디터 준비 여부 */
  editorReady: boolean;
  /** Monaco 에디터 ref */
  editorRef: RefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  /** 코드 에디터 테이블 범위 목록 */
  tables: readonly CodeEditorNavigableTable[];
  /** ERD -> 코드 reveal 요청 */
  request: CodeEditorTableRevealRequest | null | undefined;
}

/**
 * ERD 테이블 선택 요청을 받아 Monaco 에디터에서 해당 테이블 시작 줄로 이동한다.
 *
 * @param options 옵션
 * @returns 없음
 */
export function useCodeEditorTableReveal({
  enabled,
  editorReady,
  editorRef,
  tables,
  request,
}: UseCodeEditorTableRevealOptions): void {
  const lastHandledRequestIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !editorReady || !request) {
      return;
    }
    if (lastHandledRequestIdRef.current === request.requestId) {
      return;
    }

    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) {
      return;
    }

    const targetTable = resolveCodeEditorNavigableTableByRequest(tables, request);
    if (!targetTable) {
      return;
    }

    const safeLine = Math.min(Math.max(targetTable.startLine, 1), model.getLineCount());
    editor.focus();
    editor.setPosition({ lineNumber: safeLine, column: 1 });
    editor.revealLineInCenter(safeLine);
    lastHandledRequestIdRef.current = request.requestId;
  }, [editorReady, editorRef, enabled, request, tables]);
}
