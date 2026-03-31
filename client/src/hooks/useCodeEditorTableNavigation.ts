import { useEffect, useRef, type RefObject } from 'react';
import type * as Monaco from 'monaco-editor';
import type { CodeEditorNavigableTable } from '@/lib/code-editor-table-navigation';
import { resolveCodeEditorNavigableTableByLine } from '@/lib/code-editor-table-navigation';

interface UseCodeEditorTableNavigationOptions {
  /** 기능 활성 여부 */
  enabled: boolean;
  /** 에디터 mount 완료 여부 */
  editorReady?: boolean;
  /** Monaco editor 인스턴스 ref */
  editorRef: RefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  /** Monaco 네임스페이스 ref */
  monacoRef: RefObject<typeof Monaco | null>;
  /** line gutter navigation 대상 목록 */
  tables: CodeEditorNavigableTable[];
  /** 테이블 이동 요청 핸들러 */
  onNavigate: (table: CodeEditorNavigableTable) => void;
}

/**
 * 코드 에디터 line number gutter 클릭으로 해당 테이블로 이동한다.
 *
 * @param options 훅 옵션
 * @returns 없음
 */
export function useCodeEditorTableNavigation({
  enabled,
  editorReady = true,
  editorRef,
  monacoRef,
  tables,
  onNavigate,
}: UseCodeEditorTableNavigationOptions): void {
  const enabledRef = useRef(enabled);
  const tablesRef = useRef(tables);
  const onNavigateRef = useRef(onNavigate);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    if (!editorReady) {
      return;
    }
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) {
      return;
    }

    const { MouseTargetType } = monaco.editor;
    const disposable = editor.onMouseDown((event) => {
      if (!enabledRef.current) {
        return;
      }

      const targetType = event.target.type;
      const isGutterClick =
        targetType === MouseTargetType.GUTTER_LINE_NUMBERS ||
        targetType === MouseTargetType.GUTTER_GLYPH_MARGIN ||
        targetType === MouseTargetType.GUTTER_LINE_DECORATIONS;
      const lineNumber = event.target.position?.lineNumber;

      if (!isGutterClick || !lineNumber) {
        return;
      }

      const table = resolveCodeEditorNavigableTableByLine(tablesRef.current, lineNumber);
      if (!table) {
        return;
      }

      onNavigateRef.current(table);
    });

    return () => {
      disposable.dispose();
    };
  }, [editorReady, editorRef, monacoRef]);
}
