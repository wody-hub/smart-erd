import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useDslParse } from '@/hooks/useDslParse';
import { useApplyToErd } from '@/hooks/useApplyToErd';
import { useBidirectionalCodeSync } from '@/hooks/useBidirectionalCodeSync';
import { useCodeEditorRefresh } from '@/hooks/useCodeEditorRefresh';
import { useCodeEditorTableLock } from '@/hooks/useCodeEditorTableLock';
import { useRemoteEditLocks } from '@/hooks/useRemoteEditLocks';
import { useEditorCursorGuard } from '@/hooks/useEditorCursorGuard';
import { useDslEditorCompletion } from '@/hooks/useDslEditorCompletion';
import { useDslDiagnosticMarkers } from '@/hooks/useDslDiagnosticMarkers';
import { useAssistPopup } from '@/hooks/useAssistPopup';
import { useIdleCursorAction } from '@/hooks/useIdleCursorAction';
import { useErdDictionary } from './ErdDictionaryContext';
import CodeEditorFooter from './CodeEditorFooter';
import DslDiagnosticGuideDialog from './DslDiagnosticGuideDialog';
import DslAssistPopup from './DslAssistPopup';
import QuickTermDialog from './QuickTermDialog';
import QuickDomainDialog from './QuickDomainDialog';
import { DSL_LANGUAGE_ID, registerDslLanguage } from '@/lib/monaco-dsl-language';
import type { DslDictionary } from '@/lib/dsl-parser';
import { generateDsl } from '@/lib/dsl-generator';
import { getSyncStatusMeta } from '@/lib/sync-status-meta';
import { cn } from '@/lib/utils';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { TableNode, ERDEdge } from '@/types/erd';

/** DslCodeEditorPanel 컴포넌트의 props */
interface DslCodeEditorPanelProps {
  /** 편집 가능 여부 (VIEWER일 때 false) */
  canEdit?: boolean;
}

const DSL_TABLE_PREFIX_REGEX = /^\s*Table\b/;

/**
 * 공백이 포함된 DSL 식별자는 인용부호로 감싼다.
 *
 * @param raw 원본 논리명
 * @returns DSL 출력용 식별자
 */
function formatDslIdentifier(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return value;
  }
  if (!/\s/.test(value)) {
    return value;
  }
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  if (!value.includes('"')) {
    return `"${value}"`;
  }
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * 컬럼 DSL 한 줄에 선택한 도메인을 명시 반영한다.
 *
 * 기존 `:도메인` 또는 `::타입` 구간은 제거하고,
 * 옵션(`[PK]`, `[NN]`)은 유지한 채 `:도메인`을 재삽입한다.
 *
 * @param lineContent 원본 한 줄
 * @param domainLogicalName 도메인 논리명
 * @returns 변경된 한 줄
 */
function applyDomainToDslLine(lineContent: string, domainLogicalName: string): string {
  if (
    !domainLogicalName.trim() ||
    DSL_TABLE_PREFIX_REGEX.test(lineContent) ||
    lineContent.trim().startsWith('//')
  ) {
    return lineContent;
  }

  const indent = lineContent.match(/^\s*/)?.[0] ?? '';
  const trimmed = lineContent.trim();

  const optionsMatch = trimmed.match(/\s+(\[[^\]]*\])\s*$/);
  const optionsPart = optionsMatch ? ` ${optionsMatch[1]}` : '';
  let working = optionsMatch ? trimmed.slice(0, optionsMatch.index).trimEnd() : trimmed;

  working = working.replace(/\s+::\s*.+$/u, '').trimEnd();
  working = working.replace(/\s+:(?!:)\s*.+$/u, '').trimEnd();

  return `${indent}${working} :${formatDslIdentifier(domainLogicalName)}${optionsPart}`;
}

/**
 * 논리명 DSL 코드 에디터 패널.
 *
 * 논리명으로 테이블/컬럼을 선언하면 용어 사전(Term)과 도메인 사전(Domain)을
 * 자동 조회하여 물리명 + 물리타입이 적용된 ERD를 생성한다.
 *
 * @param props.canEdit 편집 가능 여부
 * @returns 논리명 DSL 에디터 패널 JSX
 */
export default function DslCodeEditorPanel({ canEdit = true }: DslCodeEditorPanelProps) {
  const { t } = useTranslation();
  const { teamId, projectId, diagramId } = useParams<{
    teamId: string;
    projectId: string;
    diagramId: string;
  }>();
  const { hasLocks: hasRemoteEditLocks } = useRemoteEditLocks();

  const {
    terms,
    domains,
    words,
    termByNameMap,
    domainByNameMap,
    domainMap,
    wordMatchIndex,
    findTermById,
    findDomainById,
  } = useErdDictionary();

  /** 사전 데이터 객체 (SSOT — Ref 대입만 하므로 참조 동일성 불필요) */
  const dictionary: DslDictionary = {
    termByName: termByNameMap,
    domainByName: domainByNameMap,
    domainById: domainMap,
    wordMatchIndex,
  };

  const { dslText, parseResult, parsing, handleDslChange } = useDslParse({ dictionary });

  const {
    handleApply,
    executeApply,
    applyParsedToErd,
    confirmOpen,
    setConfirmOpen,
    confirmDescription,
    canApply,
  } = useApplyToErd({
    canEdit,
    parseResult: parseResult?.result ?? null,
    parsing,
    policyScope: { teamId, projectId, diagramId },
  });

  /** 사전 데이터 로딩 완료 여부 (초기화 시 사전 없이 생성하면 빈 결과) */
  const hasDictionary = terms.length > 0 || domains.length > 0 || words.length > 0;

  /** ERD → DSL 생성 함수 (useCodeEditorRefresh에 전달) */
  const generate = useCallback(
    (nodes: TableNode[], edges: ERDEdge[]) =>
      generateDsl(nodes, edges, { findTermById, findDomainById }),
    [findTermById, findDomainById],
  );

  /** 현재 ERD 상태를 DSL 텍스트로 생성한다. */
  const generateFromErd = useCallback(() => {
    const { nodes, edges } = useCanvasStore.getState();
    return generate(nodes as TableNode[], edges as ERDEdge[]);
  }, [generate]);

  /** 에러 건수 */
  const errorCount = parseResult?.diagnostics.filter((d) => d.severity === 'error').length ?? 0;
  /** 경고 건수 */
  const warningCount = parseResult?.diagnostics.filter((d) => d.severity === 'warning').length ?? 0;

  /** 에디터 인스턴스 ref (커서 가드용으로 sync 훅보다 앞에 선언) */
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  // ERD→Code 동기화 시 커서/스크롤 보존 가드
  const { syncCodeChange, isSyncing } = useEditorCursorGuard(editorRef, handleDslChange);

  const { handleUserCodeChange, handleGeneratedCodeChange, clearQueueTimeoutHold, syncStatus } =
    useBidirectionalCodeSync({
      enabled: canEdit,
      ready: hasDictionary,
      codeText: dslText,
      parsing,
      hasBlockingErrors: errorCount > 0,
      hasParsedTables: parseResult != null && errorCount === 0,
      hasRemoteEditLocks,
      onCodeTextChange: handleDslChange,
      onSyncCodeTextChange: syncCodeChange,
      generateCodeFromErd: generateFromErd,
      applyParsedToErd,
    });

  const handleApplyWithSyncReset = useCallback(() => {
    clearQueueTimeoutHold();
    handleApply();
  }, [clearQueueTimeoutHold, handleApply]);

  const executeApplyWithSyncReset = useCallback(() => {
    clearQueueTimeoutHold();
    executeApply();
  }, [clearQueueTimeoutHold, executeApply]);

  const { executeRefresh, handleRefresh, hasNodes, refreshConfirmOpen, setRefreshConfirmOpen } =
    useCodeEditorRefresh({
      generate,
      onGenerated: handleGeneratedCodeChange,
      currentText: dslText,
      ready: hasDictionary,
    });

  const syncStatusMeta = getSyncStatusMeta(t, syncStatus);

  // --- Quick Register Dialogs ---
  /** DSL 오류 가이드에서 사용하는 빠른 용어 등록 다이얼로그 상태 */
  const [quickTermOpen, setQuickTermOpen] = useState(false);
  /** 빠른 용어 등록 초기 논리명 */
  const [quickTermInitialLogicalName, setQuickTermInitialLogicalName] = useState('');
  /** 빠른 용어 등록이 열린 DSL 행 번호 */
  const quickTermLineNumberRef = useRef<number | null>(null);
  /** DSL 오류 가이드에서 사용하는 빠른 도메인 등록 다이얼로그 상태 */
  const [quickDomainOpen, setQuickDomainOpen] = useState(false);
  /** 빠른 도메인 등록 초기 논리명 */
  const [quickDomainInitialLogicalName, setQuickDomainInitialLogicalName] = useState('');
  /** 사전 갱신 후 1회 재파싱 플래그 */
  const pendingDictionaryReparseRef = useRef(false);

  /** Monaco 인스턴스 ref */
  const monacoRef = useRef<typeof Monaco | null>(null);
  /** Monaco mount 완료 여부 */
  const [monacoReady, setMonacoReady] = useState(false);

  // 자동완성 훅
  const { buildAssistItems } = useDslEditorCompletion({
    terms,
    domains,
    parseResult,
  });

  // 진단 마커 동기화 훅
  useDslDiagnosticMarkers({ monacoRef, editorRef, parseResult });

  /** 오류 가이드/보조 팝업에서 용어 등록 요청 시 빠른 등록 다이얼로그를 연다. */
  const handleQuickRegisterTerm = useCallback((logicalName: string, lineNumber?: number | null) => {
    quickTermLineNumberRef.current =
      lineNumber ?? editorRef.current?.getPosition()?.lineNumber ?? null;
    setQuickTermInitialLogicalName(logicalName);
    setQuickTermOpen(true);
  }, []);

  /** 오류 가이드에서 도메인 등록 요청 시 빠른 등록 다이얼로그를 연다. */
  const handleQuickRegisterDomain = useCallback((logicalName: string) => {
    setQuickDomainInitialLogicalName(logicalName);
    setQuickDomainOpen(true);
  }, []);

  /** 사전 변경 이후 현재 DSL을 동일 텍스트로 재파싱하도록 예약한다. */
  const requestDictionaryReparse = useCallback(() => {
    pendingDictionaryReparseRef.current = true;
  }, []);

  // --- Assist Popup (extracted hook) ---
  const {
    assistPopup,
    assistPopupListRef,
    openAssistPopup,
    closeAssistPopup,
    promoteAssistPopup,
    setAssistPopupSelectedIndex,
    executeAssistPopupItem,
    expandAssistPopupVisibleCount,
  } = useAssistPopup({
    editorRef,
    monacoRef,
    canEdit,
    buildAssistItems,
    onRegisterTerm: handleQuickRegisterTerm,
    onRegisterDomain: handleQuickRegisterDomain,
  });

  // --- Idle Cursor Action (extracted hook) ---
  useIdleCursorAction({
    editorRef,
    canEdit,
    openAssistPopup,
    closeAssistPopup,
    isSyncing,
  });

  /**
   * Editor onChange 가드 — 내부 동기화 중이면 무시한다.
   *
   * @param value 에디터 텍스트
   */
  const guardedOnChange = useCallback(
    (value: string | undefined) => {
      if (isSyncing()) {
        return;
      }
      handleUserCodeChange(value);
    },
    [handleUserCodeChange, isSyncing],
  );

  /**
   * beforeMount — 언어 등록 (1회).
   *
   * @param monaco Monaco 네임스페이스
   */
  const handleBeforeMount: BeforeMount = (monaco) => {
    registerDslLanguage(monaco);
  };

  /**
   * onMount — editorRef/monacoRef 저장 (CompletionProvider 등록은 useEffect에 위임).
   *
   * @param editor Monaco editor 인스턴스
   * @param monaco Monaco 네임스페이스
   */
  const handleOnMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMonacoReady(true);
  };

  useCodeEditorTableLock({
    enabled: canEdit,
    editorReady: monacoReady,
    editorRef,
    tableRanges: parseResult?.result.tableRanges ?? [],
    hasParseErrors: errorCount > 0,
  });

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

  // 빠른 용어/도메인 등록 이후 사전이 갱신되면 현재 DSL을 재파싱한다.
  useEffect(() => {
    if (!pendingDictionaryReparseRef.current) {
      return;
    }
    pendingDictionaryReparseRef.current = false;

    if (!dslText.trim()) {
      return;
    }
    handleDslChange(dslText);
  }, [terms, domains, dslText, handleDslChange]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-end">
          <DslDiagnosticGuideDialog
            diagnostics={parseResult?.diagnostics ?? []}
            parsing={parsing}
            hasInput={dslText.trim().length > 0}
            onMoveToDiagnostic={handleMoveToDiagnostic}
            onQuickRegisterTerm={canEdit ? handleQuickRegisterTerm : undefined}
            onQuickRegisterDomain={canEdit ? handleQuickRegisterDomain : undefined}
          />
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0 relative">
        <Editor
          height="100%"
          language={DSL_LANGUAGE_ID}
          value={dslText}
          onChange={guardedOnChange}
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
            suggestOnTriggerCharacters: false,
            acceptSuggestionOnCommitCharacter: false,
          }}
          theme={isDark ? 'vs-dark' : 'vs'}
        />

        {assistPopup && (
          <DslAssistPopup
            popup={assistPopup}
            listRef={assistPopupListRef}
            onSelectIndex={setAssistPopupSelectedIndex}
            onExecuteItem={executeAssistPopupItem}
            onPromote={promoteAssistPopup}
            onExpand={expandAssistPopupVisibleCount}
          />
        )}
      </div>

      {/* 파싱 결과 프리뷰 + Apply/Refresh 버튼 */}
      <CodeEditorFooter
        onApply={handleApplyWithSyncReset}
        canApply={canApply}
        executeApply={executeApplyWithSyncReset}
        confirmOpen={confirmOpen}
        setConfirmOpen={setConfirmOpen}
        confirmDescription={confirmDescription}
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

          {syncStatusMeta && (
            <span
              className={cn('flex items-center gap-1', syncStatusMeta.className)}
              aria-label={t('erd.sync.statusAria')}
            >
              <syncStatusMeta.Icon
                className={cn('h-3 w-3', syncStatusMeta.spin && 'animate-spin')}
              />
              {syncStatusMeta.label}
            </span>
          )}
        </div>
      </CodeEditorFooter>

      <QuickTermDialog
        open={quickTermOpen}
        onOpenChange={setQuickTermOpen}
        initialLogicalName={quickTermInitialLogicalName}
        onApply={(updates) => {
          const editor = editorRef.current;
          const monaco = monacoRef.current;
          const lineNumber = quickTermLineNumberRef.current;
          const domainLogicalName =
            updates.domainId != null ? findDomainById(updates.domainId)?.logicalName : undefined;

          if (editor && monaco && lineNumber != null && domainLogicalName) {
            const model = editor.getModel();
            if (model && lineNumber >= 1 && lineNumber <= model.getLineCount()) {
              const originalLine = model.getLineContent(lineNumber);
              const nextLine = applyDomainToDslLine(originalLine, domainLogicalName);

              if (nextLine !== originalLine) {
                editor.executeEdits('dsl-quick-term-domain-sync', [
                  {
                    range: new monaco.Range(
                      lineNumber,
                      1,
                      lineNumber,
                      model.getLineMaxColumn(lineNumber),
                    ),
                    text: nextLine,
                    forceMoveMarkers: true,
                  },
                ]);
                editor.focus();
                return;
              }
            }
          }

          requestDictionaryReparse();
        }}
      />

      <QuickDomainDialog
        open={quickDomainOpen}
        onOpenChange={setQuickDomainOpen}
        onCreated={requestDictionaryReparse}
        initialLogicalName={quickDomainInitialLogicalName}
      />
    </div>
  );
}
