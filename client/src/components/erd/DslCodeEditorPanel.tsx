import { startTransition, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type * as Y from 'yjs';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useDslParse } from '@/hooks/useDslParse';
import { useApplyToErd } from '@/hooks/useApplyToErd';
import { useBidirectionalCodeSync } from '@/hooks/useBidirectionalCodeSync';
import { useCodeEditorRefresh } from '@/hooks/useCodeEditorRefresh';
import { useCodeEditorTableLock } from '@/hooks/useCodeEditorTableLock';
import { useCodeEditorTableNavigation } from '@/hooks/useCodeEditorTableNavigation';
import { useCodeEditorTableReveal } from '@/hooks/useCodeEditorTableReveal';
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
  CODE_MODE_SHARED_DRAFT_TEXT_ORIGIN,
  clearCodeModeSharedDraft,
  getCodeModeSharedDraftText,
  readCodeModeSharedDraftBaselineRevision,
  readCodeModeSharedDraftConfirmedBlank,
  readCodeModeSharedDraftIntentionalBlank,
  writeCodeModeSharedDraftTextSnapshot,
} from '@/lib/code-mode-shared-draft';
import {
  clearDiagramDslDraftRecord,
  type DiagramPreviewPositionRecord,
  type DiagramDslDraftRecord,
  loadDiagramDslDraftRecord,
  saveDiagramDslDraftRecord,
} from '@/lib/diagram-code-draft';
import {
  CODE_SHARED_DRAFT_BOOTSTRAP_WAIT_MS,
  CODE_DRAFT_PERSIST_IDLE_MS,
  CODE_PREVIEW_GRAPH_IDLE_MS,
  CODE_SHARED_DRAFT_SYNC_IDLE_MS,
} from '@/constants/code-sync';
import type {
  CodeEditorNavigableTable,
  CodeEditorTableFocusRequest,
  CodeEditorTableRevealRequest,
} from '@/lib/code-editor-table-navigation';
import { buildCodeEditorNavigableTables } from '@/lib/code-editor-table-navigation';
import { applyQuickTermToDslLine } from '@/lib/dsl-line-edit';
import {
  buildPreviewGraphFromDslParsedSchema,
  buildPreviewEdgePresentationEntries,
  buildPreviewLayoutSourceEntries,
  refreshPreviewGraphFromPersistedSources,
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
  /** code 모드 preview 위치 override */
  previewPositionOverrides?: DiagramPreviewPositionRecord;
  /** code 모드 preview 위치 override 변경 핸들러 */
  onPreviewPositionOverridesChange?: (next: DiagramPreviewPositionRecord) => void;
  /** 코드 에디터에서 테이블 포커스 요청 핸들러 */
  onNavigateToTable?: (request: CodeEditorTableFocusRequest) => void;
  /** ERD에서 요청한 코드 reveal 대상 */
  tableRevealRequest?: CodeEditorTableRevealRequest | null;
  /** remote Y.Doc snapshot/bootstrap 완료 전 draft hydrate를 보류할지 여부 */
  delayDraftHydration?: boolean;
  /** 현재 persisted 다이어그램에 저장된 내용 존재 여부 */
  persistedDiagramHasContent?: boolean;
  /** code 모드 shared draft snapshot 서버 저장 예약 요청 */
  onScheduleCodeModeSnapshotPersist?: () => void;
  /** code 모드 shared draft snapshot 저장 상태 즉시 정리 */
  onResetCodeModeSnapshotPersistState?: () => void;
  /** code 모드 draft 서버 저장 상태 */
  codeModeDraftPersistStatus?: 'inactive' | 'dirty' | 'saving' | 'saved' | 'error' | 'stale';
  /** code 모드 draft 서버 저장 완료 시각 */
  codeModeDraftPersistedAt?: number | null;
  /** code 모드 published 다이어그램 최종 저장 요청 */
  onPersistPublishedDiagram?: () => Promise<boolean>;
}

/**
 * preview 노드를 DSL generator 입력용 table 노드로 정규화한다.
 *
 * preview graph는 React Flow 상에서 `previewTable` 타입을 쓰지만,
 * DSL 생성기는 persisted ERD와 같은 `table` 타입 노드를 기대한다.
 *
 * @param nodes preview 노드 목록
 * @returns DSL generator 에 전달 가능한 table 노드 목록
 */
function normalizePreviewNodesForDslGeneration(nodes: DslPreviewGraph['nodes']): TableNode[] {
  return nodes.map((node) => ({
    ...node,
    type: 'table',
  }));
}

/**
 * persisted 다이어그램이 존재할 때 hydrate 대상으로 사용할 로컬 draft를 정제한다.
 *
 * 과거 버그로 저장된 빈 문자열 draft는 실제 persisted ERD/코드를 덮어쓰지 않도록
 * 부트스트랩 단계에서 무시한다.
 *
 * @param draft 저장된 로컬 draft 레코드
 * @param persistedDiagramHasContent persisted 다이어그램 내용 존재 여부
 * @returns hydrate에 사용할 draft. 무시 대상이면 null
 */
function sanitizeHydrationDraftRecord(
  draft: DiagramDslDraftRecord | null,
  persistedDiagramHasContent: boolean,
): DiagramDslDraftRecord | null {
  if (!draft) {
    return null;
  }

  if (!persistedDiagramHasContent) {
    return draft;
  }

  const hasText = draft.text.trim().length > 0;
  const hasPreviewPositions = Object.keys(draft.previewPositions).length > 0;
  return hasText || hasPreviewPositions || (draft.isIntentionalBlank && draft.isConfirmedBlank)
    ? draft
    : null;
}

/**
 * 논리명 DSL 코드 에디터 패널.
 *
 * 논리명으로 테이블/컬럼을 선언하면 용어 사전(Term)과 도메인 사전(Domain)을
 * 자동 조회하여 물리명 + 물리타입이 적용된 ERD를 생성한다.
 *
 * @param props.canEdit 편집 가능 여부
 * @param props.previewPositionOverrides code 모드 preview 위치 override
 * @param props.onPreviewPositionOverridesChange code 모드 preview 위치 override 변경 핸들러
 * @returns 논리명 DSL 에디터 패널 JSX
 */
export default function DslCodeEditorPanel({
  canEdit = true,
  enableCodeToErdAutoSync = true,
  enableErdToCodeAutoSync = true,
  enableTableLock = true,
  onPreviewStateChange,
  persistDraft = false,
  previewPositionOverrides = {},
  onPreviewPositionOverridesChange,
  onNavigateToTable,
  tableRevealRequest,
  delayDraftHydration = false,
  persistedDiagramHasContent = false,
  onScheduleCodeModeSnapshotPersist,
  onResetCodeModeSnapshotPersistState,
  codeModeDraftPersistStatus = 'inactive',
  codeModeDraftPersistedAt = null,
  onPersistPublishedDiagram,
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
  const ydoc = useCanvasStore((state) => state.ydoc);
  const [draftHydrated, setDraftHydrated] = useState(!persistDraft);
  const [draftFallbackHydrationReady, setDraftFallbackHydrationReady] = useState(
    !persistDraft || !delayDraftHydration,
  );
  const [previewGraph, setPreviewGraph] = useState<DslPreviewGraph | null>(null);
  const [sharedDraftBootstrapText, setSharedDraftBootstrapText] = useState('');
  const [sharedDraftBootstrapIntentionalBlank, setSharedDraftBootstrapIntentionalBlank] =
    useState(false);
  const [sharedDraftBootstrapConfirmedBlank, setSharedDraftBootstrapConfirmedBlank] =
    useState(false);
  const draftBaselineRevisionRef = useRef<string | null>(null);
  const confirmedBlankDraftRef = useRef(false);
  const pendingDraftPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftRecordRef = useRef<DiagramDslDraftRecord | null>(null);
  const lastPersistedDraftRecordRef = useRef<string | null>(null);
  const pendingHydratedTextRef = useRef<string | null>(null);
  const generatedFallbackTextRef = useRef<string | null>(null);
  const draftHydrationSourceRef = useRef<'shared' | 'local' | 'generated' | null>(null);
  const finalizeRequestedRef = useRef(false);
  const finalizeExecutionArmedRef = useRef(false);
  const previewGraphBuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewGraphBuildSeqRef = useRef(0);
  const sharedDraftTextSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dslTextValueRef = useRef('');
  /** 에디터 인스턴스 ref */
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  /** Monaco 인스턴스 ref */
  const monacoRef = useRef<typeof Monaco | null>(null);
  /** Monaco mount 완료 여부 */
  const [monacoReady, setMonacoReady] = useState(false);
  /** code 모드 최종 저장 시 apply 선행 필요 여부 */
  const [requiresApplyBeforeFinalize, setRequiresApplyBeforeFinalize] = useState(false);
  /** code 모드 최종 저장 시 published save가 남아 있는지 여부 */
  const [requiresPublishedSave, setRequiresPublishedSave] = useState(false);
  /** code 모드 최종 저장 진행 여부 */
  const [finalizing, setFinalizing] = useState(false);

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
    isDictionaryReady,
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
  const previewEdgePresentationEntries = useCanvasStore(
    useShallow((state) =>
      buildPreviewEdgePresentationEntries(
        state.nodes as TableNode[],
        state.edges as ERDEdge[],
      )),
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
  dslTextValueRef.current = dslText;

  /**
   * 에디터 모델 기준 현재 DSL 문자열을 읽는다.
   *
   * React state가 아직 동기화되지 않은 직전 입력도 포함하기 위해
   * Monaco 모델 값을 우선 사용한다.
   *
   * @returns 현재 DSL 문자열
   */
  const readCurrentDslText = useCallback(() => {
    return editorRef.current?.getModel()?.getValue() ?? dslTextValueRef.current;
  }, []);

  /**
   * code 모드 draft를 최종 저장 필요 상태로 표시한다.
   *
   * @returns 없음
   */
  const markFinalizationDirty = useCallback(() => {
    if (!persistDraft) {
      return;
    }
    setRequiresApplyBeforeFinalize(true);
    setRequiresPublishedSave(true);
  }, [persistDraft]);

  /**
   * code 모드 draft를 published 기준 최신 상태로 맞춘다.
   *
   * @returns 없음
   */
  const markFinalizationSynced = useCallback(() => {
    if (!persistDraft) {
      return;
    }
    setRequiresApplyBeforeFinalize(false);
    setRequiresPublishedSave(false);
  }, [persistDraft]);

  /**
   * 현재 텍스트가 persisted ERD에서 생성한 bootstrap fallback 그대로인지 판단한다.
   *
   * 이 경우에는 shared draft가 아직 bootstrap되지 않은 상태에서 로컬 fallback을
   * 다시 Y.Doc shared draft로 덮어쓰면 안 된다.
   *
   * @returns generated fallback write를 건너뛰어야 하면 true
   */
  const shouldSkipGeneratedFallbackSharedDraftWrite = useCallback(() => {
    if (draftHydrationSourceRef.current !== 'generated') {
      return false;
    }

    const generatedFallbackText = generatedFallbackTextRef.current;
    if (!generatedFallbackText) {
      return false;
    }

    return readCurrentDslText() === generatedFallbackText;
  }, [readCurrentDslText]);

  /**
   * code 모드 shared draft text/baseline을 즉시 Y.Doc에 반영한다.
   *
   * debounce 대기 중 페이지 이탈/모드 전환/언마운트가 발생해도
   * 최신 초안이 세션 간 복원 경로에 남도록 사용한다.
   *
   * @returns 없음
   */
  const flushSharedDraftTextImmediately = useCallback(() => {
    if (!persistDraft || !draftHydrated || !ydoc) {
      return;
    }

    if (shouldSkipGeneratedFallbackSharedDraftWrite()) {
      return;
    }

    if (sharedDraftTextSyncTimerRef.current) {
      clearTimeout(sharedDraftTextSyncTimerRef.current);
      sharedDraftTextSyncTimerRef.current = null;
    }

    writeCodeModeSharedDraftTextSnapshot(
      ydoc,
      readCurrentDslText(),
      draftBaselineRevisionRef.current,
      readCurrentDslText().trim().length === 0,
      readCurrentDslText().trim().length === 0 && confirmedBlankDraftRef.current,
      CODE_MODE_SHARED_DRAFT_TEXT_ORIGIN,
    );
    onScheduleCodeModeSnapshotPersist?.();
  }, [
    draftHydrated,
    onScheduleCodeModeSnapshotPersist,
    persistDraft,
    readCurrentDslText,
    shouldSkipGeneratedFallbackSharedDraftWrite,
    ydoc,
  ]);

  /** 사전 데이터 로딩 완료 여부 */
  const hasDictionary = isDictionaryReady;

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

  /**
   * ERD 적용 직전에 사용할 canonical DSL 문자열을 계산한다.
   *
   * 현재 파싱 결과를 기준으로만 재생성하므로, 의미를 바꾸지 않고
   * 공백/정렬만 정리한 DSL 텍스트를 반환한다.
   *
   * @returns 적용 직전 사용할 formatted DSL. 포맷 불가 시 null
   */
  const getFormattedDslTextForApply = useCallback((): string | null => {
    if (!parseResult?.result || errorCount > 0) {
      return null;
    }

    const graphForFormat =
      previewGraph ??
      buildPreviewGraphFromDslParsedSchema(
        parseResult.result,
        previewLayoutSourceEntries,
        previewEdgePresentationEntries,
      );

    return generateDsl(
      normalizePreviewNodesForDslGeneration(graphForFormat.nodes),
      graphForFormat.edges,
      {
        findTermById,
        findDomainById,
      },
    );
  }, [
    errorCount,
    findDomainById,
    findTermById,
    parseResult?.result,
    previewEdgePresentationEntries,
    previewGraph,
    previewLayoutSourceEntries,
  ]);

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
    beforeExecuteManualApply: useCallback(() => {
      if (finalizeRequestedRef.current) {
        finalizeExecutionArmedRef.current = true;
      }
      const formattedDsl = getFormattedDslTextForApply();
      if (formattedDsl && formattedDsl !== dslText) {
        handleDslChange(formattedDsl);
      }
    }, [dslText, getFormattedDslTextForApply, handleDslChange]),
    onManualApplySuccess: useCallback(() => {
      const previewPositionChanges = previewGraph
        ? useCanvasStore
            .getState()
            .applyPreviewPositionChangesToPersisted(previewGraph.nodes, previewPositionOverrides)
        : [];

      const syncedPreviewNodeIds = new Set(
        previewPositionChanges,
      );
      const remainingPreviewPositions = Object.fromEntries(
        Object.entries(previewPositionOverrides).filter(
          ([previewNodeId]) => !syncedPreviewNodeIds.has(previewNodeId),
        ),
      );
      if (syncedPreviewNodeIds.size > 0) {
        onPreviewPositionOverridesChange?.(remainingPreviewPositions);
      }

      setRequiresApplyBeforeFinalize(false);
      setRequiresPublishedSave(true);

      if (!persistDraft || !draftHydrated) {
        return;
      }

      const nextBaselineRevision = buildCurrentPersistedRevisionHash();
      draftBaselineRevisionRef.current = nextBaselineRevision;
      if (ydoc) {
        writeCodeModeSharedDraftTextSnapshot(
          ydoc,
          dslText,
          nextBaselineRevision,
          dslText.trim().length === 0,
          dslText.trim().length === 0 && confirmedBlankDraftRef.current,
          'code-mode-shared-draft',
        );
      }
      persistDraftRecordImmediately({
        text: dslText,
        baselineRevision: nextBaselineRevision,
        previewPositions: remainingPreviewPositions,
        isIntentionalBlank: dslText.trim().length === 0,
        isConfirmedBlank: dslText.trim().length === 0 && confirmedBlankDraftRef.current,
      });
    }, [
      buildCurrentPersistedRevisionHash,
      draftHydrated,
      dslText,
      onPreviewPositionOverridesChange,
      previewGraph,
      persistDraft,
      persistDraftRecordImmediately,
      previewPositionOverrides,
      setRequiresApplyBeforeFinalize,
      setRequiresPublishedSave,
      ydoc,
    ]),
  });

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
      allowPersistedFallback: !draftHydrated || dslText.trim().length > 0,
    }),
    [draftHydrated, dslText, errorCount, parsing, previewGraph],
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

  /**
   * code 모드에서 현재 draft를 published ERD 기준으로 다시 맞춘다.
   *
   * @returns 없음
   */
  const resetFinalizationState = useCallback(() => {
    if (!persistDraft) {
      return;
    }
    finalizeRequestedRef.current = false;
    finalizeExecutionArmedRef.current = false;
    setFinalizing(false);
    markFinalizationSynced();
  }, [markFinalizationSynced, persistDraft]);

  /**
   * Refresh 버튼 클릭 핸들러.
   *
   * @returns 없음
   */
  const handleRefreshWithFinalizeReset = useCallback(() => {
    handleRefresh();
  }, [handleRefresh]);

  /**
   * 실제 refresh 실행 직후 code 모드 최종 저장 상태를 초기화한다.
   *
   * @returns 없음
   */
  const executeRefreshWithFinalizeReset = useCallback(() => {
    executeRefresh();
    resetFinalizationState();
  }, [executeRefresh, resetFinalizationState]);

  /**
   * code 모드 draft를 최종 저장한다.
   *
   * 변경분이 아직 apply되지 않았다면 먼저 Apply를 실행하고,
   * Apply가 끝나면 published 다이어그램 저장까지 이어서 수행한다.
   *
   * @returns 없음
   */
  const handleFinalize = useCallback(async () => {
    if (!persistDraft || !onPersistPublishedDiagram || finalizing) {
      return;
    }

    if (requiresApplyBeforeFinalize) {
      finalizeRequestedRef.current = true;
      finalizeExecutionArmedRef.current = false;
      handleApplyWithSyncReset();
      return;
    }

    if (!requiresPublishedSave) {
      return;
    }

    finalizeRequestedRef.current = false;
    finalizeExecutionArmedRef.current = false;
    setFinalizing(true);
    const persisted = await onPersistPublishedDiagram();
    if (!persisted) {
      setFinalizing(false);
      return;
    }

    if (persistDraft) {
      clearDiagramDslDraftRecord(draftScope);
      pendingDraftRecordRef.current = null;
      lastPersistedDraftRecordRef.current = null;
      if (ydoc) {
        clearCodeModeSharedDraft(ydoc, CODE_MODE_SHARED_DRAFT_TEXT_ORIGIN);
      }
      onResetCodeModeSnapshotPersistState?.();
    }

    resetFinalizationState();
  }, [
    draftScope,
    finalizing,
    handleApplyWithSyncReset,
    onPersistPublishedDiagram,
    onResetCodeModeSnapshotPersistState,
    persistDraft,
    requiresApplyBeforeFinalize,
    requiresPublishedSave,
    resetFinalizationState,
    ydoc,
  ]);

  const canFinalize = useMemo(() => {
    if (!persistDraft || !onPersistPublishedDiagram || finalizing) {
      return false;
    }
    if (!requiresApplyBeforeFinalize && !requiresPublishedSave) {
      return false;
    }
    if (requiresApplyBeforeFinalize) {
      return canApply;
    }
    return true;
  }, [
    canApply,
    finalizing,
    onPersistPublishedDiagram,
    persistDraft,
    requiresApplyBeforeFinalize,
    requiresPublishedSave,
  ]);
  const hasPendingDraftChanges = persistDraft && (requiresApplyBeforeFinalize || requiresPublishedSave);

  useEffect(() => {
    if (confirmOpen) {
      return;
    }
    if (!finalizeRequestedRef.current || finalizeExecutionArmedRef.current) {
      return;
    }
    finalizeRequestedRef.current = false;
  }, [confirmOpen]);

  useEffect(() => {
    if (!persistDraft || !finalizeRequestedRef.current || requiresApplyBeforeFinalize) {
      return;
    }
    if (!finalizeExecutionArmedRef.current || !requiresPublishedSave || finalizing) {
      return;
    }

    void handleFinalize();
  }, [
    finalizing,
    handleFinalize,
    persistDraft,
    requiresApplyBeforeFinalize,
    requiresPublishedSave,
  ]);

  const syncStatusMeta = getSyncStatusMeta(t, syncStatus);
  const draftPersistStatusMeta = useMemo(() => {
    switch (codeModeDraftPersistStatus) {
      case 'dirty':
        return {
          className: 'text-muted-foreground',
          label: t('erd.codeEditor.draftStatusDirty'),
          Icon: AlertTriangle,
          spin: false,
        };
      case 'saving':
        return {
          className: 'text-muted-foreground',
          label: t('erd.codeEditor.draftStatusSaving'),
          Icon: Loader2,
          spin: true,
        };
      case 'saved':
        return {
          className: 'text-success',
          label: t('erd.codeEditor.draftStatusSaved'),
          Icon: CheckCircle2,
          spin: false,
          title:
            codeModeDraftPersistedAt != null
              ? new Date(codeModeDraftPersistedAt).toLocaleTimeString()
              : undefined,
        };
      case 'error':
        return {
          className: 'text-destructive',
          label: t('erd.codeEditor.draftStatusError'),
          Icon: XCircle,
          spin: false,
        };
      case 'stale':
        return {
          className: 'text-erd-warning',
          label: t('erd.codeEditor.draftStatusStale'),
          Icon: AlertTriangle,
          spin: false,
        };
      case 'inactive':
      default:
        return null;
    }
  }, [codeModeDraftPersistStatus, codeModeDraftPersistedAt, t]);
  const finalizeStatusMeta = useMemo(() => {
    if (!persistDraft) {
      return null;
    }
    if (finalizing) {
      return {
        className: 'text-muted-foreground',
        label: t('erd.codeEditor.finalizeSavingButton'),
        Icon: Loader2,
        spin: true,
      };
    }
    if (requiresApplyBeforeFinalize) {
      return {
        className: 'text-erd-warning',
        label: t('erd.codeEditor.finalizeApplyRequired'),
        Icon: AlertTriangle,
        spin: false,
      };
    }
    if (requiresPublishedSave) {
      return {
        className: 'text-muted-foreground',
        label: t('erd.codeEditor.finalizePending'),
        Icon: AlertTriangle,
        spin: false,
      };
    }
    return {
      className: 'text-success',
      label: t('erd.codeEditor.finalizeSaved'),
      Icon: CheckCircle2,
      spin: false,
    };
  }, [finalizing, persistDraft, requiresApplyBeforeFinalize, requiresPublishedSave, t]);
  const physicalNameHints = useMemo(
    () =>
      buildDslPhysicalNameHints(
        parseResult?.physicalNameHints ?? [],
        erdPhysicalNameSourceEntries,
      ),
    [erdPhysicalNameSourceEntries, parseResult?.physicalNameHints],
  );
  const navigableTables = useMemo<CodeEditorNavigableTable[]>(
    () =>
      buildCodeEditorNavigableTables(
        parseResult?.result.tables ?? [],
        parseResult?.result.tableRanges ?? [],
      ),
    [parseResult?.result.tables, parseResult?.result.tableRanges],
  );

  /**
   * 현재 DSL 파싱 결과를 canonical DSL 문자열로 다시 생성한다.
   *
   * persisted ERD 기준 refresh와 달리, 현재 코드 parse 결과를 기준으로 정렬한다.
   *
   * @returns 없음
   */
  const handleFormatDsl = useCallback(() => {
    const nextDsl = getFormattedDslTextForApply();

    if (!nextDsl || nextDsl === dslText) {
      return;
    }

    markFinalizationDirty();
    syncCodeChange(nextDsl);
  }, [dslText, getFormattedDslTextForApply, markFinalizationDirty, syncCodeChange]);

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
    setDraftFallbackHydrationReady(!persistDraft || !delayDraftHydration);
    draftBaselineRevisionRef.current = null;
    confirmedBlankDraftRef.current = false;
    finalizeRequestedRef.current = false;
    finalizeExecutionArmedRef.current = false;
    pendingDraftRecordRef.current = null;
    lastPersistedDraftRecordRef.current = null;
    setSharedDraftBootstrapIntentionalBlank(false);
    setSharedDraftBootstrapConfirmedBlank(false);
    generatedFallbackTextRef.current = null;
    draftHydrationSourceRef.current = null;
    setRequiresApplyBeforeFinalize(false);
    setRequiresPublishedSave(false);
    setFinalizing(false);
    onPreviewPositionOverridesChange?.({});
    previewGraphBuildSeqRef.current += 1;
    if (pendingDraftPersistTimerRef.current) {
      clearTimeout(pendingDraftPersistTimerRef.current);
      pendingDraftPersistTimerRef.current = null;
    }
    if (previewGraphBuildTimerRef.current) {
      clearTimeout(previewGraphBuildTimerRef.current);
      previewGraphBuildTimerRef.current = null;
    }
    if (sharedDraftTextSyncTimerRef.current) {
      clearTimeout(sharedDraftTextSyncTimerRef.current);
      sharedDraftTextSyncTimerRef.current = null;
    }
  }, [
    delayDraftHydration,
    diagramId,
    onPreviewPositionOverridesChange,
    persistDraft,
    projectId,
    teamId,
  ]);

  useEffect(() => {
    if (!persistDraft || draftHydrated || !delayDraftHydration) {
      setDraftFallbackHydrationReady(true);
      return;
    }

    setDraftFallbackHydrationReady(false);
    const timer = setTimeout(() => {
      setDraftFallbackHydrationReady(true);
    }, CODE_SHARED_DRAFT_BOOTSTRAP_WAIT_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [delayDraftHydration, draftHydrated, persistDraft]);

  useEffect(() => {
    if (pendingHydratedTextRef.current != null && dslText === pendingHydratedTextRef.current) {
      pendingHydratedTextRef.current = null;
    }
  }, [dslText]);

  useEffect(() => {
    if (!persistDraft || !draftHydrated || !hasPendingDraftChanges) {
      return;
    }

    if (pendingHydratedTextRef.current != null && dslText !== pendingHydratedTextRef.current) {
      return;
    }

    pendingDraftRecordRef.current = {
      text: dslText,
      baselineRevision: draftBaselineRevisionRef.current,
      previewPositions: previewPositionOverrides,
      isIntentionalBlank: dslText.trim().length === 0,
      isConfirmedBlank: dslText.trim().length === 0 && confirmedBlankDraftRef.current,
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
  }, [
    draftHydrated,
    dslText,
    hasPendingDraftChanges,
    persistDraft,
    persistDraftRecordImmediately,
    previewPositionOverrides,
  ]);

  useEffect(() => {
    if (!persistDraft || !draftHydrated) {
      return;
    }

    if (Object.keys(previewPositionOverrides).length === 0) {
      return;
    }

    setRequiresApplyBeforeFinalize(true);
    setRequiresPublishedSave(true);
  }, [draftHydrated, persistDraft, previewPositionOverrides]);

  useEffect(() => {
    if (!persistDraft || draftHydrated) {
      return;
    }

    const hasSharedDraftBootstrapState =
      (sharedDraftBootstrapIntentionalBlank && sharedDraftBootstrapConfirmedBlank) ||
      sharedDraftBootstrapText.trim().length > 0;
    const storedDraft = sanitizeHydrationDraftRecord(
      loadDiagramDslDraftRecord(draftScope),
      persistedDiagramHasContent,
    );
    const canHydrateFromFallbackSources =
      hasSharedDraftBootstrapState ||
      storedDraft != null ||
      hasNodes ||
      !persistedDiagramHasContent;
    if (!canHydrateFromFallbackSources) {
      return;
    }

    if (!hasSharedDraftBootstrapState && delayDraftHydration && !draftFallbackHydrationReady) {
      return;
    }

    const currentBaselineRevision = buildCurrentPersistedRevisionHash();
    const sharedDraftBaselineRevision = ydoc
      ? readCodeModeSharedDraftBaselineRevision(ydoc)
      : null;

    if (hasSharedDraftBootstrapState) {
      draftBaselineRevisionRef.current = sharedDraftBaselineRevision ?? currentBaselineRevision;
      confirmedBlankDraftRef.current =
        sharedDraftBootstrapText.trim().length === 0 && sharedDraftBootstrapConfirmedBlank;
      pendingHydratedTextRef.current = sharedDraftBootstrapText;
      generatedFallbackTextRef.current = null;
      draftHydrationSourceRef.current = 'shared';
      lastPersistedDraftRecordRef.current = JSON.stringify({
        text: sharedDraftBootstrapText,
        baselineRevision: draftBaselineRevisionRef.current,
        previewPositions: {},
        isIntentionalBlank: sharedDraftBootstrapIntentionalBlank,
        isConfirmedBlank: sharedDraftBootstrapConfirmedBlank,
      });
      setRequiresApplyBeforeFinalize(true);
      setRequiresPublishedSave(true);
      onPreviewPositionOverridesChange?.({});
      syncCodeChange(sharedDraftBootstrapText);
    } else if (storedDraft != null) {
      draftBaselineRevisionRef.current = storedDraft.baselineRevision ?? currentBaselineRevision;
      confirmedBlankDraftRef.current =
        storedDraft.text.trim().length === 0 && storedDraft.isConfirmedBlank;
      pendingHydratedTextRef.current = storedDraft.text;
      generatedFallbackTextRef.current = null;
      draftHydrationSourceRef.current = 'local';
      lastPersistedDraftRecordRef.current = JSON.stringify({
        text: storedDraft.text,
        baselineRevision: draftBaselineRevisionRef.current,
        previewPositions: storedDraft.previewPositions,
        isIntentionalBlank: storedDraft.isIntentionalBlank,
        isConfirmedBlank: storedDraft.isConfirmedBlank,
      });
      setRequiresApplyBeforeFinalize(true);
      setRequiresPublishedSave(true);
      onPreviewPositionOverridesChange?.(storedDraft.previewPositions);
      syncCodeChange(storedDraft.text);
    } else {
      if (persistedDiagramHasContent && !hasNodes) {
        return;
      }
      const generatedDsl = generateFromErd();
      draftBaselineRevisionRef.current = currentBaselineRevision;
      confirmedBlankDraftRef.current = false;
      pendingHydratedTextRef.current = generatedDsl;
      generatedFallbackTextRef.current = generatedDsl;
      draftHydrationSourceRef.current = 'generated';
      setRequiresApplyBeforeFinalize(false);
      setRequiresPublishedSave(false);
      onPreviewPositionOverridesChange?.({});
      syncCodeChange(generatedDsl);
    }
    setDraftHydrated(true);
  }, [
    buildCurrentPersistedRevisionHash,
    draftHydrated,
    draftScope,
    draftFallbackHydrationReady,
    generateFromErd,
    hasNodes,
    hasDictionary,
    onPreviewPositionOverridesChange,
    persistedDiagramHasContent,
    persistDraft,
    sharedDraftBootstrapConfirmedBlank,
    sharedDraftBootstrapIntentionalBlank,
    sharedDraftBootstrapText,
    syncCodeChange,
    ydoc,
    delayDraftHydration,
  ]);

  useEffect(() => {
    if (!persistDraft || !ydoc) {
      setSharedDraftBootstrapText('');
      setSharedDraftBootstrapIntentionalBlank(false);
      setSharedDraftBootstrapConfirmedBlank(false);
      return;
    }

    const yText = getCodeModeSharedDraftText(ydoc);
    const draftMap = ydoc.getMap('codeModeSharedDraft');
    const syncBootstrapText = () => {
      setSharedDraftBootstrapText(yText.toString());
      setSharedDraftBootstrapIntentionalBlank(readCodeModeSharedDraftIntentionalBlank(ydoc));
      setSharedDraftBootstrapConfirmedBlank(readCodeModeSharedDraftConfirmedBlank(ydoc));
    };

    syncBootstrapText();
    yText.observe(syncBootstrapText);
    draftMap.observe(syncBootstrapText);
    return () => {
      yText.unobserve(syncBootstrapText);
      draftMap.unobserve(syncBootstrapText);
    };
  }, [persistDraft, ydoc]);

  useEffect(() => {
    if (
      !persistDraft ||
      !draftHydrated ||
      !ydoc ||
      (
        !(sharedDraftBootstrapIntentionalBlank && sharedDraftBootstrapConfirmedBlank) &&
        sharedDraftBootstrapText.trim().length === 0
      ) ||
      draftHydrationSourceRef.current !== 'generated'
    ) {
      return;
    }

    const currentText = readCurrentDslText();
    const generatedFallbackText = generatedFallbackTextRef.current;
    if (
      !generatedFallbackText ||
      currentText !== generatedFallbackText ||
      currentText === sharedDraftBootstrapText
    ) {
      return;
    }

    draftBaselineRevisionRef.current =
      readCodeModeSharedDraftBaselineRevision(ydoc) ?? draftBaselineRevisionRef.current;
    confirmedBlankDraftRef.current =
      sharedDraftBootstrapText.trim().length === 0 && sharedDraftBootstrapConfirmedBlank;
    pendingHydratedTextRef.current = sharedDraftBootstrapText;
    generatedFallbackTextRef.current = null;
    draftHydrationSourceRef.current = 'shared';
    lastPersistedDraftRecordRef.current = JSON.stringify({
      text: sharedDraftBootstrapText,
      baselineRevision: draftBaselineRevisionRef.current,
      previewPositions: {},
      isIntentionalBlank: sharedDraftBootstrapIntentionalBlank,
      isConfirmedBlank: sharedDraftBootstrapConfirmedBlank,
    });
    setRequiresApplyBeforeFinalize(true);
    setRequiresPublishedSave(true);
    onPreviewPositionOverridesChange?.({});
    syncCodeChange(sharedDraftBootstrapText);
  }, [
    draftHydrated,
    onPreviewPositionOverridesChange,
    persistDraft,
    readCurrentDslText,
    sharedDraftBootstrapConfirmedBlank,
    sharedDraftBootstrapIntentionalBlank,
    sharedDraftBootstrapText,
    setRequiresApplyBeforeFinalize,
    setRequiresPublishedSave,
    syncCodeChange,
    ydoc,
  ]);

  useEffect(() => {
    if (!persistDraft || !ydoc || !draftHydrated) {
      return;
    }

    const yText = getCodeModeSharedDraftText(ydoc);
    const handleSharedDraftText = (event: Y.YTextEvent) => {
      if (event.transaction.origin === CODE_MODE_SHARED_DRAFT_TEXT_ORIGIN) {
        return;
      }
      const nextText = yText.toString();
      if (
        nextText === dslTextValueRef.current ||
        editorRef.current?.getModel()?.getValue() === nextText
      ) {
        return;
      }
      confirmedBlankDraftRef.current =
        nextText.trim().length === 0 && readCodeModeSharedDraftConfirmedBlank(ydoc);
      setRequiresApplyBeforeFinalize(true);
      setRequiresPublishedSave(true);
      syncCodeChange(nextText);
    };

    yText.observe(handleSharedDraftText);
    return () => {
      yText.unobserve(handleSharedDraftText);
    };
  }, [draftHydrated, persistDraft, syncCodeChange, ydoc]);

  useEffect(() => {
    if (!persistDraft) {
      return;
    }

    const flushPendingDraft = () => {
      if (!draftHydrated || !hasPendingDraftChanges) {
        return;
      }
      const currentText = readCurrentDslText();
      if (
        pendingHydratedTextRef.current != null &&
        currentText !== pendingHydratedTextRef.current
      ) {
        return;
      }

      pendingDraftRecordRef.current = {
        text: currentText,
        baselineRevision: draftBaselineRevisionRef.current,
        previewPositions: previewPositionOverrides,
        isIntentionalBlank: currentText.trim().length === 0,
        isConfirmedBlank: currentText.trim().length === 0 && confirmedBlankDraftRef.current,
      };
      persistDraftRecordImmediately(pendingDraftRecordRef.current);
      flushSharedDraftTextImmediately();
    };

    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('pagehide', flushPendingDraft);
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingDraft();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (typeof globalThis.removeEventListener === 'function') {
        globalThis.removeEventListener('pagehide', flushPendingDraft);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      flushPendingDraft();
    };
  }, [
    draftHydrated,
    flushSharedDraftTextImmediately,
    hasPendingDraftChanges,
    persistDraft,
    persistDraftRecordImmediately,
    previewPositionOverrides,
    readCurrentDslText,
  ]);

  useEffect(() => {
    if (!persistDraft || !draftHydrated || !ydoc || !hasPendingDraftChanges) {
      return;
    }

    if (sharedDraftTextSyncTimerRef.current) {
      clearTimeout(sharedDraftTextSyncTimerRef.current);
    }

    sharedDraftTextSyncTimerRef.current = setTimeout(() => {
      flushSharedDraftTextImmediately();
    }, CODE_SHARED_DRAFT_SYNC_IDLE_MS);

    return () => {
      if (sharedDraftTextSyncTimerRef.current) {
        clearTimeout(sharedDraftTextSyncTimerRef.current);
        sharedDraftTextSyncTimerRef.current = null;
      }
    };
  }, [
    draftHydrated,
    dslText,
    flushSharedDraftTextImmediately,
    hasPendingDraftChanges,
    persistDraft,
    ydoc,
  ]);

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

    if (dslText.trim().length === 0) {
      previewGraphBuildSeqRef.current += 1;
      if (previewGraphBuildTimerRef.current) {
        clearTimeout(previewGraphBuildTimerRef.current);
        previewGraphBuildTimerRef.current = null;
      }
      setPreviewGraph(null);
      return;
    }

    if (errorCount > 0) {
      previewGraphBuildSeqRef.current += 1;
      if (previewGraphBuildTimerRef.current) {
        clearTimeout(previewGraphBuildTimerRef.current);
        previewGraphBuildTimerRef.current = null;
      }
      return;
    }

    if (!parseResult?.result) {
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
        previewEdgePresentationEntries,
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
  }, [
    dslText,
    errorCount,
    onPreviewStateChange,
    parseResult?.result,
    previewEdgePresentationEntries,
    previewLayoutSourceEntries,
  ]);

  useEffect(() => {
    if (!onPreviewStateChange || !previewGraph) {
      return;
    }

    setPreviewGraph((currentGraph) => {
      if (!currentGraph) {
        return currentGraph;
      }

      return refreshPreviewGraphFromPersistedSources(
        currentGraph,
        previewLayoutSourceEntries,
        previewEdgePresentationEntries,
      );
    });
  }, [
    onPreviewStateChange,
    previewEdgePresentationEntries,
    previewGraph,
    previewLayoutSourceEntries,
  ]);

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
    getCurrentText: () => dslTextValueRef.current,
    buildAssistItems,
    onSyncInsertedText: handleUserCodeChange,
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
      confirmedBlankDraftRef.current = (value ?? '').trim().length === 0;
      markFinalizationDirty();
      handleUserCodeChange(value);
    },
    [handleUserCodeChange, markFinalizationDirty, shouldIgnoreChange],
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
  useCodeEditorTableNavigation({
    enabled: !!onNavigateToTable,
    editorReady: monacoReady,
    editorRef,
    monacoRef,
    tables: navigableTables,
    onNavigate: (table) => {
      onNavigateToTable?.({
        ...table,
        requestId: Date.now(),
      });
    },
    });

  useCodeEditorTableReveal({
    enabled: !!tableRevealRequest,
    editorReady: monacoReady,
    editorRef,
    tables: navigableTables,
    request: tableRevealRequest,
  });

  useEffect(() => {
    if (!tableRevealRequest || !monacoReady) {
      return;
    }
    if (dslText.trim().length > 0 || navigableTables.length > 0 || !hasNodes) {
      return;
    }
    executeRefresh();
  }, [dslText, executeRefresh, hasNodes, monacoReady, navigableTables.length, tableRevealRequest]);

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
        onRefresh={handleRefreshWithFinalizeReset}
        onFormat={handleFormatDsl}
        canFormat={Boolean(parseResult?.result && errorCount === 0 && dslText.trim().length > 0)}
        executeRefresh={executeRefreshWithFinalizeReset}
        hasNodes={hasNodes}
        refreshConfirmOpen={refreshConfirmOpen}
        setRefreshConfirmOpen={setRefreshConfirmOpen}
        onFinalize={persistDraft ? handleFinalize : undefined}
        canFinalize={canFinalize}
        finalizing={finalizing}
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

          {draftPersistStatusMeta && (
            <span
              className={cn('flex items-center gap-1', draftPersistStatusMeta.className)}
              title={draftPersistStatusMeta.title}
            >
              <draftPersistStatusMeta.Icon
                className={cn('h-3 w-3', draftPersistStatusMeta.spin && 'animate-spin')}
              />
              {draftPersistStatusMeta.label}
            </span>
          )}

          {finalizeStatusMeta && (
            <span className={cn('flex items-center gap-1', finalizeStatusMeta.className)}>
              <finalizeStatusMeta.Icon
                className={cn('h-3 w-3', finalizeStatusMeta.spin && 'animate-spin')}
              />
              {finalizeStatusMeta.label}
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
