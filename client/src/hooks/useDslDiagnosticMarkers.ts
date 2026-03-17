import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type * as Monaco from 'monaco-editor';
import type { DslParseResult } from '@/lib/dsl-parser';

/** useDslDiagnosticMarkers 훅 옵션 */
interface UseDslDiagnosticMarkersOptions {
  /** Monaco 네임스페이스 ref */
  monacoRef: React.RefObject<typeof Monaco | null>;
  /** 에디터 인스턴스 ref */
  editorRef: React.RefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  /** DSL 파싱 결과 (진단 정보 포함) */
  parseResult: DslParseResult | null;
}

/**
 * DSL 파싱 진단 결과를 Monaco 에디터 마커로 동기화하는 훅.
 *
 * parseResult.diagnostics가 변경될 때마다 Monaco 에러/경고 마커를 갱신한다.
 * 언마운트 또는 모델 변경 시 기존 마커를 정리한다.
 *
 * @param options.monacoRef   Monaco 네임스페이스 ref
 * @param options.editorRef   에디터 인스턴스 ref
 * @param options.parseResult DSL 파싱 결과
 */
export function useDslDiagnosticMarkers({
  monacoRef,
  editorRef,
  parseResult,
}: UseDslDiagnosticMarkersOptions): void {
  const { t } = useTranslation();

  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    if (!parseResult || parseResult.diagnostics.length === 0) {
      monaco.editor.setModelMarkers(model, 'dsl', []);
    } else {
      const markers: Monaco.editor.IMarkerData[] = parseResult.diagnostics.map((diag) => ({
        severity:
          diag.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message: t(diag.messageKey as any, diag.messageArgs),
        startLineNumber: diag.line,
        startColumn: diag.startColumn,
        endLineNumber: diag.line,
        endColumn: diag.endColumn,
      }));

      monaco.editor.setModelMarkers(model, 'dsl', markers);
    }

    return () => {
      if (!model.isDisposed()) {
        monaco.editor.setModelMarkers(model, 'dsl', []);
      }
    };
  }, [parseResult, t, monacoRef, editorRef]);
}
