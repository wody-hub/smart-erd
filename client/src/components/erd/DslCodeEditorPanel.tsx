import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useDslParse } from '@/hooks/useDslParse';
import { useApplyToErd } from '@/hooks/useApplyToErd';
import { useCodeEditorRefresh } from '@/hooks/useCodeEditorRefresh';
import { useErdDictionary } from './ErdDictionaryContext';
import CodeEditorFooter from './CodeEditorFooter';
import DslDiagnosticGuideDialog from './DslDiagnosticGuideDialog';
import {
  DSL_LANGUAGE_ID,
  registerDslLanguage,
  createDslCompletionProvider,
  type DslParsedTableRef,
} from '@/lib/monaco-dsl-language';
import type { DslDictionary } from '@/lib/dsl-parser';
import { generateDsl } from '@/lib/dsl-generator';
import type { TableNode, ERDEdge } from '@/types/erd';

/** DslCodeEditorPanel 컴포넌트의 props */
interface DslCodeEditorPanelProps {
  /** 편집 가능 여부 (VIEWER일 때 false) */
  canEdit?: boolean;
}

/**
 * 논리명 DSL 코드 에디터 패널.
 *
 * 논리명으로 테이블/컬럼을 선언하면 용어 사전(Term)과 도메인 사전(Domain)을
 * 자동 조회하여 물리명 + 물리타입이 적용된 ERD를 생성한다.
 *
 * @param props.canEdit 편집 가능 여부
 */
export default function DslCodeEditorPanel({ canEdit = true }: DslCodeEditorPanelProps) {
  const { t } = useTranslation();

  const {
    terms,
    domains,
    termByNameMap,
    domainByNameMap,
    domainMap,
    findTermById,
    findDomainById,
  } = useErdDictionary();

  /** 사전 데이터 객체 (SSOT — Ref 대입만 하므로 참조 동일성 불필요) */
  const dictionary: DslDictionary = {
    termByName: termByNameMap,
    domainByName: domainByNameMap,
    domainById: domainMap,
  };

  const { dslText, parseResult, parsing, handleDslChange } = useDslParse({ dictionary });

  const { handleApply, executeApply, confirmOpen, setConfirmOpen, canApply } = useApplyToErd({
    canEdit,
    parseResult: parseResult?.result ?? null,
    parsing,
  });

  /** 사전 데이터 로딩 완료 여부 (초기화 시 사전 없이 생성하면 빈 결과) */
  const hasDictionary = terms.length > 0 || domains.length > 0;

  /** ERD → DSL 생성 함수 (useCodeEditorRefresh에 전달) */
  const generate = useCallback(
    (nodes: TableNode[], edges: ERDEdge[]) =>
      generateDsl(nodes, edges, { findTermById, findDomainById }),
    [findTermById, findDomainById],
  );

  const { executeRefresh, handleRefresh, hasNodes, refreshConfirmOpen, setRefreshConfirmOpen } =
    useCodeEditorRefresh({
      generate,
      onGenerated: handleDslChange,
      currentText: dslText,
      ready: hasDictionary,
    });

  /** Monaco 인스턴스 ref */
  const monacoRef = useRef<typeof Monaco | null>(null);
  /** 에디터 인스턴스 ref */
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  /** CompletionProvider disposable ref */
  const completionDisposableRef = useRef<Monaco.IDisposable | null>(null);
  /** parsedTables ref (CompletionProvider 재생성 없이 최신값 참조) */
  const parsedTablesRef = useRef<DslParsedTableRef[]>([]);
  /** Monaco mount 완료 여부 */
  const [monacoReady, setMonacoReady] = useState(false);

  /** beforeMount — 언어 등록 (1회) */
  const handleBeforeMount: BeforeMount = (monaco) => {
    registerDslLanguage(monaco);
  };

  /** onMount — editorRef/monacoRef 저장 (CompletionProvider 등록은 useEffect에 위임) */
  const handleOnMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMonacoReady(true);
  };

  /**
   * 진단 항목 위치로 에디터 포커스를 이동한다.
   *
   * @param diagnostic 선택된 진단 정보
   */
  const handleMoveToDiagnostic = useCallback(
    (diagnostic: { line: number; startColumn: number }) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const model = editor.getModel();
      if (!model) {
        return;
      }

      const safeLine = Math.min(Math.max(diagnostic.line, 1), model.getLineCount());
      const safeColumn = Math.min(
        Math.max(diagnostic.startColumn, 1),
        Math.max(1, model.getLineMaxColumn(safeLine)),
      );

      editor.focus();
      editor.setPosition({ lineNumber: safeLine, column: safeColumn });
      editor.revealLineInCenter(safeLine);
    },
    [],
  );

  /** 다크 모드 감지 (반응형) */
  const isDark = useDarkMode();

  /** 에러 건수 */
  const errorCount = parseResult?.diagnostics.filter((d) => d.severity === 'error').length ?? 0;
  /** 경고 건수 */
  const warningCount = parseResult?.diagnostics.filter((d) => d.severity === 'warning').length ?? 0;

  // parseResult 변경 시 parsedTables ref 갱신
  useEffect(() => {
    if (parseResult) {
      parsedTablesRef.current = parseResult.result.tables.map((table) => ({
        logicalName: table.logicalTableName ?? table.name,
        columns: table.columns.map((col) => col.logicalName ?? col.name),
      }));
    } else {
      parsedTablesRef.current = [];
    }
  }, [parseResult]);

  // Monaco mount + terms/domains 변경 시 CompletionProvider 등록/재생성
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) {
      return;
    }

    completionDisposableRef.current?.dispose();
    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider(
      DSL_LANGUAGE_ID,
      createDslCompletionProvider(monaco, terms, domains, parsedTablesRef),
    );

    return () => completionDisposableRef.current?.dispose();
  }, [terms, domains, monacoReady]);

  // diagnostics 변경 시 Monaco 에러 마커 갱신
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
  }, [parseResult, t]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-end">
          <DslDiagnosticGuideDialog
            diagnostics={parseResult?.diagnostics ?? []}
            parsing={parsing}
            hasInput={dslText.trim().length > 0}
            onMoveToDiagnostic={handleMoveToDiagnostic}
          />
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={DSL_LANGUAGE_ID}
          value={dslText}
          onChange={handleDslChange}
          beforeMount={handleBeforeMount}
          onMount={handleOnMount}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'on',
            tabSize: 2,
            renderLineHighlight: 'gutter',
            quickSuggestions: false,
            wordBasedSuggestions: 'off',
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnCommitCharacter: false,
          }}
          theme={isDark ? 'vs-dark' : 'vs'}
        />
      </div>

      {/* 파싱 결과 프리뷰 + Apply/Refresh 버튼 */}
      <CodeEditorFooter
        onApply={handleApply}
        canApply={canApply}
        executeApply={executeApply}
        confirmOpen={confirmOpen}
        setConfirmOpen={setConfirmOpen}
        onRefresh={handleRefresh}
        executeRefresh={executeRefresh}
        hasNodes={hasNodes}
        refreshConfirmOpen={refreshConfirmOpen}
        setRefreshConfirmOpen={setRefreshConfirmOpen}
      >
        <div className="flex items-center gap-2 text-xs min-h-[20px] flex-wrap">
          {parsing && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('erd.ddlImport.parsing')}
            </span>
          )}

          {!parsing && parseResult && (
            <>
              {parseResult.result.tables.length > 0 && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('erd.ddlImport.preview', {
                    tables: parseResult.result.tables.length,
                    relations: parseResult.result.relations.length,
                  })}
                </span>
              )}

              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" />
                  {t('erd.dsl.errorCount', { count: errorCount })}
                </span>
              )}

              {warningCount > 0 && (
                <span className="flex items-center gap-1 text-erd-warning">
                  <AlertTriangle className="h-3 w-3" />
                  {t('erd.dsl.warningCount', { count: warningCount })}
                </span>
              )}

              {parseResult.result.tables.length === 0 && errorCount === 0 && dslText.trim() && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  {t('erd.dsl.noTables')}
                </span>
              )}
            </>
          )}
        </div>
      </CodeEditorFooter>
    </div>
  );
}
