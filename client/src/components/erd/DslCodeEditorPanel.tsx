import { startTransition, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
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
import { useDslPhysicalNameHints } from '@/hooks/useDslPhysicalNameHints';
import { useErdDictionary } from './ErdDictionaryContext';
import CodeEditorFooter from './CodeEditorFooter';
import DslDiagnosticGuideDialog from './DslDiagnosticGuideDialog';
import DslAssistPopup from './DslAssistPopup';
import QuickTermDialog from './QuickTermDialog';
import QuickDomainDialog from './QuickDomainDialog';
import { DSL_LANGUAGE_ID, registerDslLanguage } from '@/lib/monaco-dsl-language';
import type { DslDictionary } from '@/lib/dsl-parser';
import { generateDsl } from '@/lib/dsl-generator';
import { buildParsedSchemaHash } from '@/lib/code-sync-schema-hash';
import { buildRevisionHash } from '@/lib/code-sync-revision';
import {
  type DiagramDslDraftRecord,
  loadDiagramDslDraftRecord,
  saveDiagramDslDraftRecord,
} from '@/lib/diagram-code-draft';
import {
  CODE_DRAFT_PERSIST_IDLE_MS,
  CODE_PREVIEW_GRAPH_IDLE_MS,
} from '@/constants/code-sync';
import { applyQuickTermToDslLine } from '@/lib/dsl-line-edit';
import {
  buildPreviewGraphFromDslParsedSchema,
  buildPreviewLayoutSourceEntries,
  type DslPreviewGraph,
  type DslPreviewCanvasState,
} from '@/lib/dsl-preview-graph';
import {
  buildDslPhysicalNameHints,
  buildErdPhysicalNameSourceEntries,
} from '@/lib/dsl-physical-name-hints';
import { getSyncStatusMeta } from '@/lib/sync-status-meta';
import { cn } from '@/lib/utils';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { TableNode, ERDEdge } from '@/types/erd';

/** DslCodeEditorPanel 컴포넌트의 props */
interface DslCodeEditorPanelProps {
  /** 편집 가능 여부 (VIEWER일 때 false) */
  canEdit?: boolean;
  /** 코드 -> ERD 자동동기화 활성 여부 */
  enableCodeToErdAutoSync?: boolean;
  /** ERD -> 코드 자동생성 활성 여부 */
  enableErdToCodeAutoSync?: boolean;
  /** 코드 에디터 테이블 락 발행 여부 */
  enableTableLock?: boolean;
  /** DSL preview 상태 변경 핸들러 */
  onPreviewStateChange?: (previewState: DslPreviewCanvasState | null) => void;
  /** 코드 draft 저장 활성 여부 */
  persistDraft?: boolean;
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
export default function DslCodeEditorPanel({
  canEdit = true,
  enableCodeToErdAutoSync = true,
  enableErdToCodeAutoSync = true,
  enableTableLock = true,
  onPreviewStateChange,
  persistDraft = false,
}: DslCodeEditorPanelProps) {
  const { t } = useTranslation();
  const { teamId, projectId, diagramId } = useParams<{
    teamId: string;
    projectId: string;
    diagramId: string;
  }>();
  const draftScope = useMemo(
    () => ({ teamId, projectId, diagramId }),
    [diagramId, projectId, teamId],
  );
  const remoteEditLocks = useRemoteEditLocks();
  const hasRemoteEditLocks = remoteEditLocks.hasTableLocks;
  const [draftHydrated, setDraftHydrated] = useState(!persistDraft);
  const [previewGraph, setPreviewGraph] = useState<DslPreviewGraph | null>(null);
  const draftBaselineRevisionRef = useRef<string | null>(null);
  const pendingDraftPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftRecordRef = useRef<DiagramDslDraftRecord | null>(null);
  const lastPersistedDraftRecordRef = useRef<string | null>(null);
  const previewGraphBuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewGraphBuildSeqRef = useRef(0);

  /**
   * 현재 draft 레코드를 즉시 localStorage에 반영한다.
   *
   * @param nextRecord 저장할 draft 레코드
   * @returns 없음
   */
  const persistDraftRecordImmediately = useCallback(
    (nextRecord: DiagramDslDraftRecord | null) => {
      if (!persistDraft || !nextRecord) {
        return;
      }

      if (pendingDraftPersistTimerRef.current) {
        clearTimeout(pendingDraftPersistTimerRef.current);
        pendingDraftPersistTimerRef.current = null;
      }

      const serializedRecord = JSON.stringify(nextRecord);
      if (serializedRecord === lastPersistedDraftRecordRef.current) {
        pendingDraftRecordRef.current = null;
        return;
      }

      saveDiagramDslDraftRecord(draftScope, nextRecord);
      lastPersistedDraftRecordRef.current = serializedRecord;
      pendingDraftRecordRef.current = null;
    },
    [draftScope, persistDraft],
  );

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
  const erdPhysicalNameSourceEntries = useCanvasStore(
    useShallow((state) => buildErdPhysicalNameSourceEntries(state.nodes as TableNode[])),
  );
  const previewLayoutSourceEntries = useCanvasStore(
    useShallow((state) => buildPreviewLayoutSourceEntries(state.nodes as TableNode[])),
  );

  /** 사전 데이터 객체 (SSOT — Ref 대입만 하므로 참조 동일성 불필요) */
  const dictionary: DslDictionary = useMemo(
    () => ({
      termByName: termByNameMap,
      domainByName: domainByNameMap,
      domainById: domainMap,
      wordMatchIndex,
    }),
    [domainByNameMap, domainMap, termByNameMap, wordMatchIndex],
  );

  const { dslText, parseResult, parsing, handleDslChange, reparseDsl } = useDslParse({
    dictionary,
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

  /**
   * 현재 persisted ERD 상태의 리비전 해시를 계산한다.
   *
   * @returns 현재 store 기준 persisted ERD 리비전 해시
   */
  const buildCurrentPersistedRevisionHash = useCallback(() => {
    const { nodes, edges } = useCanvasStore.getState();
    return buildRevisionHash(
      (nodes as TableNode[]).map((node) => ({
        id: node.id,
        type: node.type ?? 'table',
        parentId: node.parentId ?? null,
        data: node.data,
      })),
      (edges as ERDEdge[]).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        type: edge.type ?? 'default',
        data: edge.data,
      })),
    );
  }, []);

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
    hasBlockingStructureLocks: remoteEditLocks.hasBlockingStructureLocks,
    beforeManualApply: useCallback(() => {
      if (!persistDraft) {
        return true;
      }

      const currentRevision = buildCurrentPersistedRevisionHash();
      const baselineRevision = draftBaselineRevisionRef.current ?? currentRevision;
      draftBaselineRevisionRef.current = baselineRevision;

      if (currentRevision !== baselineRevision) {
        toast.error(t('diagram.workMode.codeDraftConflict'));
        return false;
      }

      return true;
    }, [buildCurrentPersistedRevisionHash, persistDraft, t]),
    onManualApplySuccess: useCallback(() => {
      if (!persistDraft || !draftHydrated) {
        return;
      }

      const nextBaselineRevision = buildCurrentPersistedRevisionHash();
      draftBaselineRevisionRef.current = nextBaselineRevision;
      persistDraftRecordImmediately({
        text: dslText,
        baselineRevision: nextBaselineRevision,
      });
    }, [
      buildCurrentPersistedRevisionHash,
      draftHydrated,
      dslText,
      persistDraft,
      persistDraftRecordImmediately,
    ]),
  });

  /** 에러 건수 */
  const errorCount = parseResult?.diagnostics.filter((d) => d.severity === 'error').length ?? 0;
  /** 경고 건수 */
  const warningCount = parseResult?.diagnostics.filter((d) => d.severity === 'warning').length ?? 0;

  /** 에디터 인스턴스 ref (커서 가드용으로 sync 훅보다 앞에 선언) */
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  /** Monaco 인스턴스 ref */
  const monacoRef = useRef<typeof Monaco | null>(null);
  /** Monaco mount 완료 여부 */
  const [monacoReady, setMonacoReady] = useState(false);

  // ERD→Code 동기화 시 커서/스크롤 보존 가드
  const { syncCodeChange, isSyncing, shouldIgnoreChange } = useEditorCursorGuard(
    editorRef,
    handleDslChange,
  );
  const parsedSchemaHash = useMemo(
    () => (parseResult?.result ? buildParsedSchemaHash(parseResult.result) : null),
    [parseResult?.result],
  );
  const previewState = useMemo<DslPreviewCanvasState>(
    () => ({
      graph: previewGraph,
      parsing,
      hasBlockingErrors: errorCount > 0,
      hasContent: dslText.trim().length > 0,
    }),
    [dslText, errorCount, parsing, previewGraph],
  );

  const { handleUserCodeChange, handleGeneratedCodeChange, clearQueueTimeoutHold, syncStatus } =
    useBidirectionalCodeSync({
      enableCodeToErdSync: canEdit && enableCodeToErdAutoSync,
      enableErdToCodeSync: canEdit && enableErdToCodeAutoSync,
      ready: hasDictionary,
      codeText: dslText,
      parsing,
      hasBlockingErrors: errorCount > 0,
      hasParsedTables: parseResult != null && errorCount === 0,
      hasRemoteEditLocks,
      parsedSchemaHash,
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
      skipInitialRefresh: persistDraft,
      beforeExecuteRefresh: persistDraft
        ? () => {
            draftBaselineRevisionRef.current = buildCurrentPersistedRevisionHash();
          }
        : undefined,
    });

  const syncStatusMeta = getSyncStatusMeta(t, syncStatus);
  const physicalNameHints = useMemo(
    () =>
      buildDslPhysicalNameHints(
        parseResult?.physicalNameHints ?? [],
        erdPhysicalNameSourceEntries,
      ),
    [erdPhysicalNameSourceEntries, parseResult?.physicalNameHints],
  );

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

  // 자동완성 훅
  const { buildAssistItems } = useDslEditorCompletion({
    terms,
    domains,
    parseResult,
  });

  // 진단 마커 동기화 훅
  useDslDiagnosticMarkers({ monacoRef, editorRef, parseResult });
  useDslPhysicalNameHints({
    editorReady: monacoReady,
    editorRef,
    monacoRef,
    physicalNameHints,
  });

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

  useEffect(() => {
    setDraftHydrated(!persistDraft);
    draftBaselineRevisionRef.current = null;
    pendingDraftRecordRef.current = null;
    lastPersistedDraftRecordRef.current = null;
    previewGraphBuildSeqRef.current += 1;
    if (pendingDraftPersistTimerRef.current) {
      clearTimeout(pendingDraftPersistTimerRef.current);
      pendingDraftPersistTimerRef.current = null;
    }
    if (previewGraphBuildTimerRef.current) {
      clearTimeout(previewGraphBuildTimerRef.current);
      previewGraphBuildTimerRef.current = null;
    }
  }, [diagramId, persistDraft, projectId, teamId]);

  useEffect(() => {
    if (!persistDraft || !draftHydrated) {
      return;
    }

    pendingDraftRecordRef.current = {
      text: dslText,
      baselineRevision: draftBaselineRevisionRef.current,
    };

    if (pendingDraftPersistTimerRef.current) {
      clearTimeout(pendingDraftPersistTimerRef.current);
    }

    pendingDraftPersistTimerRef.current = setTimeout(() => {
      persistDraftRecordImmediately(pendingDraftRecordRef.current);
    }, CODE_DRAFT_PERSIST_IDLE_MS);

    return () => {
      if (pendingDraftPersistTimerRef.current) {
        clearTimeout(pendingDraftPersistTimerRef.current);
        pendingDraftPersistTimerRef.current = null;
      }
    };
  }, [draftHydrated, dslText, persistDraft, persistDraftRecordImmediately]);

  useEffect(() => {
    if (!persistDraft || draftHydrated || !hasDictionary) {
      return;
    }

    const storedDraft = loadDiagramDslDraftRecord(draftScope);
    const currentBaselineRevision = buildCurrentPersistedRevisionHash();

    if (storedDraft != null) {
      draftBaselineRevisionRef.current = storedDraft.baselineRevision ?? currentBaselineRevision;
      lastPersistedDraftRecordRef.current = JSON.stringify({
        text: storedDraft.text,
        baselineRevision: draftBaselineRevisionRef.current,
      });
      syncCodeChange(storedDraft.text);
    } else {
      draftBaselineRevisionRef.current = currentBaselineRevision;
      executeRefresh();
    }
    setDraftHydrated(true);
  }, [
    buildCurrentPersistedRevisionHash,
    draftHydrated,
    draftScope,
    executeRefresh,
    hasDictionary,
    persistDraft,
    syncCodeChange,
  ]);

  useEffect(() => {
    if (!persistDraft) {
      return;
    }

    const flushPendingDraft = () => {
      persistDraftRecordImmediately(pendingDraftRecordRef.current);
    };

    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('pagehide', flushPendingDraft);
    }

    return () => {
      if (typeof globalThis.removeEventListener === 'function') {
        globalThis.removeEventListener('pagehide', flushPendingDraft);
      }
      flushPendingDraft();
    };
  }, [persistDraft, persistDraftRecordImmediately]);

  useEffect(() => {
    if (!onPreviewStateChange) {
      previewGraphBuildSeqRef.current += 1;
      if (previewGraphBuildTimerRef.current) {
        clearTimeout(previewGraphBuildTimerRef.current);
        previewGraphBuildTimerRef.current = null;
      }
      setPreviewGraph(null);
      return;
    }

    if (!parseResult?.result || errorCount > 0 || dslText.trim().length === 0) {
      previewGraphBuildSeqRef.current += 1;
      if (previewGraphBuildTimerRef.current) {
        clearTimeout(previewGraphBuildTimerRef.current);
        previewGraphBuildTimerRef.current = null;
      }
      setPreviewGraph(null);
      return;
    }

    const buildSeq = previewGraphBuildSeqRef.current + 1;
    previewGraphBuildSeqRef.current = buildSeq;
    previewGraphBuildTimerRef.current = setTimeout(() => {
      const nextGraph = buildPreviewGraphFromDslParsedSchema(
        parseResult.result,
        previewLayoutSourceEntries,
      );
      if (previewGraphBuildSeqRef.current !== buildSeq) {
        return;
      }

      startTransition(() => {
        setPreviewGraph(nextGraph);
      });
    }, CODE_PREVIEW_GRAPH_IDLE_MS);

    return () => {
      if (previewGraphBuildTimerRef.current) {
        clearTimeout(previewGraphBuildTimerRef.current);
        previewGraphBuildTimerRef.current = null;
      }
    };
  }, [dslText, errorCount, onPreviewStateChange, parseResult?.result, previewLayoutSourceEntries]);

  useEffect(() => {
    if (!onPreviewStateChange) {
      return;
    }
    onPreviewStateChange(previewState);
  }, [onPreviewStateChange, previewState]);

  useEffect(
    () => () => {
      onPreviewStateChange?.(null);
    },
    [onPreviewStateChange],
  );

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
      if (shouldIgnoreChange(value)) {
        return;
      }
      handleUserCodeChange(value);
    },
    [handleUserCodeChange, shouldIgnoreChange],
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
    enabled: canEdit && enableTableLock,
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
    reparseDsl();
  }, [dslText, reparseDsl, terms, domains]);

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
            autoClosingQuotes: 'always',
            autoSurround: 'quotes',
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
          const logicalName = updates.logicalName?.trim();
          const domainLogicalName =
            updates.domainId != null ? findDomainById(updates.domainId)?.logicalName : undefined;

          if (editor && monaco && lineNumber != null && logicalName) {
            const model = editor.getModel();
            if (model && lineNumber >= 1 && lineNumber <= model.getLineCount()) {
              const originalLine = model.getLineContent(lineNumber);
              const nextLine = applyQuickTermToDslLine(
                originalLine,
                logicalName,
                domainLogicalName,
              );

              if (nextLine !== originalLine) {
                editor.executeEdits('dsl-quick-term-sync', [
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
