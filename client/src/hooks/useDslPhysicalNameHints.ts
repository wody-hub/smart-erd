import { useEffect, useRef, type RefObject } from 'react';
import type * as Monaco from 'monaco-editor';
import type { DslPhysicalNameHint } from '@/lib/dsl-parser';

/** 물리명 힌트 decoration CSS 클래스명 */
const DSL_PHYSICAL_NAME_HINT_CLASS_NAME = 'dsl-physical-name-hint';

/** DSL 물리명 view hint 훅 옵션 */
interface UseDslPhysicalNameHintsOptions {
  /** Monaco editor 준비 여부 */
  editorReady: boolean;
  /** Monaco editor ref */
  editorRef: RefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  /** Monaco namespace ref */
  monacoRef: RefObject<typeof Monaco | null>;
  /** 현재 파싱 결과 기준 물리명 힌트 목록 */
  physicalNameHints: DslPhysicalNameHint[];
}

/**
 * 물리명 힌트 1건을 Monaco injected-text decoration으로 변환한다.
 *
 * @param monaco Monaco 네임스페이스
 * @param hint DSL 물리명 힌트
 * @returns Monaco decoration
 */
function toPhysicalNameDecoration(
  monaco: typeof Monaco,
  hint: DslPhysicalNameHint,
): Monaco.editor.IModelDeltaDecoration {
  return {
    range: new monaco.Range(hint.line, hint.column, hint.line, hint.column),
    options: {
      showIfCollapsed: true,
      hoverMessage: {
        value: `물리명: ${hint.physicalName}`,
      },
      after: {
        content: ` (${hint.physicalName})`,
        inlineClassName: DSL_PHYSICAL_NAME_HINT_CLASS_NAME,
        cursorStops: monaco.editor.InjectedTextCursorStops.None,
      },
    },
  };
}

/**
 * DSL 코드창에 물리명을 Monaco injected-text decoration으로 표시한다.
 *
 * 실제 DSL 텍스트는 변경하지 않고, 테이블/컬럼 논리명 뒤에만 view-only 힌트를 붙인다.
 *
 * @param options 훅 옵션
 * @returns 없음
 */
export function useDslPhysicalNameHints({
  editorReady,
  editorRef,
  monacoRef,
  physicalNameHints,
}: UseDslPhysicalNameHintsOptions): void {
  const decorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    if (!editorReady) {
      return;
    }

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) {
      return;
    }

    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection();
    }

    decorationsRef.current.set(
      physicalNameHints.map((hint) => toPhysicalNameDecoration(monaco, hint)),
    );

    return () => {
      if (decorationsRef.current) {
        decorationsRef.current.clear();
        decorationsRef.current = null;
      }
    };
  }, [editorReady, editorRef, monacoRef, physicalNameHints]);
}
