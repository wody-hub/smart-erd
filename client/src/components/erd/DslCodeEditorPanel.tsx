import { memo, startTransition, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, type LucideIcon } from 'lucide-react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { toast } from 'sonner';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useDslParse } from '@/hooks/useDslParse';
import { useApplyToErd } from '@/hooks/useApplyToErd';
import { useBidirectionalCodeSync } from '@/hooks/useBidirectionalCodeSync';
import { useCodeEditorRefresh } from '@/hooks/useCodeEditorRefresh';
import { useDiagramPreviewPositionActions } from '@/collaboration/channel/diagram/use-diagram-preview-position-actions';
import { useDiagramErdStructureSnapshot } from '@/collaboration/channel/diagram/use-diagram-erd-read-snapshot';
import '@/lib/monaco-setup';
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
import type { DslDictionary, DslParseResult } from '@/lib/dsl-parser';
import { generateDsl } from '@/lib/dsl-generator';
import {
  buildParsedSchemaHash,
  buildPersistedDiagramSchemaHash,
} from '@/lib/code-sync-schema-hash';
import {
  buildSharedSchemaDraftSnapshotFromLegacyCodeModeDraft,
  buildParseResultFromSharedSchemaDraft,
  clearSharedSchemaDraft,
  getSharedSchemaDraftMap,
  hasSharedSchemaDraftContent,
  readSharedSchemaDraftSnapshot,
  SHARED_SCHEMA_DRAFT_ORIGIN,
  shouldClearSharedSchemaDraftAfterPersistedApply,
  writeSharedSchemaDraftSnapshot,
  type SharedSchemaDraftSnapshot,
} from '@/lib/shared-schema-draft';
import {
  clearCodeModeSharedDraft,
  getCodeModeSharedDraftMap,
  readCodeModeSharedDraftSnapshot,
  writeCodeModeSharedDraftTextSnapshot,
  type CodeModeSharedDraftSnapshot,
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
import { buildDslCopyTextWithPhysicalNames } from '@/lib/dsl-copy-with-physical-names';
import {
  getCodeEditorRefreshConfirmReason,
  getCodeEditorFinalizeBlockReason,
  isCodeEditorApplyBlocked,
  isCodeEditorFinalizeBlocked,
} from '@/lib/code-editor-draft-policy';
import {
  getCodeEditorRefreshConfirmCopy,
  getCodeEditorStatusMeta,
  type SyncStatusMeta,
} from '@/lib/sync-status-meta';
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
  /** shared schema draft 저장 활성 여부 */
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
  /** code 모드 shared schema draft snapshot 서버 저장 예약 요청 */
  onScheduleCodeModeSnapshotPersist?: () => void;
  /** code 모드 shared schema draft snapshot 저장 상태 즉시 정리 */
  onResetCodeModeSnapshotPersistState?: () => void;
  /** snapshot persist 직전 editor draft flush 등록 */
  registerBeforeCodeModeSnapshotPersist?: (callback: (() => void) | null) => void;
  /** code 모드 shared schema draft 서버 저장 상태 */
  codeModeDraftPersistStatus?: 'inactive' | 'dirty' | 'saving' | 'saved' | 'error' | 'stale';
  /** code 모드 shared schema draft 서버 저장 완료 시각 */
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
 * legacy code-mode shared draft가 hydrate 대상으로 의미 있는지 판정한다.
 *
 * semantic shared schema draft가 아직 최신 입력을 따라오지 못한 경우에도
 * raw text fallback은 세션 복구의 마지막 안전망이므로 빈 초안이 아니면 복원 대상으로 본다.
 *
 * @param snapshot legacy code-mode shared draft snapshot
 * @returns hydrate 대상으로 사용할 수 있으면 true
 */
function hasLegacyCodeModeSharedDraftContent(
  snapshot: CodeModeSharedDraftSnapshot | null,
): boolean {
  if (!snapshot) {
    return false;
  }

  return (
    snapshot.text.trim().length > 0 ||
    (snapshot.isIntentionalBlank && snapshot.isConfirmedBlank) ||
    snapshot.graph != null
  );
}

/**
 * legacy raw draft가 semantic shared schema draft보다 최신인지 판정한다.
 *
 * 종료 직전 raw text flush는 parse 완료를 기다리지 않고 기록되므로,
 * updatedAt이 더 최신이면 semantic draft보다 raw draft를 우선 복구해야 한다.
 *
 * @param legacy legacy code-mode shared draft snapshot
 * @param shared shared schema draft snapshot
 * @returns legacy draft가 더 최신이면 true
 */
function isLegacyCodeModeSharedDraftNewer(
  legacy: CodeModeSharedDraftSnapshot | null,
  shared: SharedSchemaDraftSnapshot | null,
): boolean {
  if (!legacy) {
    return false;
  }

  return (legacy.updatedAt ?? 0) > (shared?.updatedAt ?? 0);
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
  registerBeforeCodeModeSnapshotPersist,
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
  const editorScopeKey = useMemo(
    () => `${teamId ?? 'unknown'}:${projectId ?? 'unknown'}:${diagramId ?? 'unknown'}`,
    [diagramId, projectId, teamId],
  );
  const editorModelPath = useMemo(
    () =>
      `smart-erd://dsl/${teamId ?? 'unknown'}/${projectId ?? 'unknown'}/${diagramId ?? 'unknown'}`,
    [diagramId, projectId, teamId],
  );
  const remoteEditLocks = useRemoteEditLocks();
  const hasRemoteEditLocks = remoteEditLocks.hasTableLocks;
  const ydoc = useCanvasStore((state) => state.ydoc);
  const diagramErdStructureSnapshot = useDiagramErdStructureSnapshot();
  const diagramPreviewPositionActions = useDiagramPreviewPositionActions();
  const [draftHydrated, setDraftHydrated] = useState(!persistDraft);
  const [draftFallbackHydrationReady, setDraftFallbackHydrationReady] = useState(
    !persistDraft || !delayDraftHydration,
  );
  const [previewGraph, setPreviewGraph] = useState<DslPreviewGraph | null>(null);
  const [sharedSchemaDraftBootstrap, setSharedSchemaDraftBootstrap] =
    useState<SharedSchemaDraftSnapshot | null>(null);
  const [codeModeSharedDraftBootstrap, setCodeModeSharedDraftBootstrap] =
    useState<CodeModeSharedDraftSnapshot | null>(null);
  const draftBaselineRevisionRef = useRef<string | null>(null);
  const confirmedBlankDraftRef = useRef(false);
  const pendingDraftPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftRecordRef = useRef<DiagramDslDraftRecord | null>(null);
  const lastPersistedDraftRecordRef = useRef<string | null>(null);
  const pendingHydratedTextRef = useRef<string | null>(null);
  const generatedFallbackTextRef = useRef<string | null>(null);
  const draftHydrationSourceRef = useRef<'shared' | 'local' | 'generated' | null>(null);
  const userStartedLocalEditRef = useRef(false);
  const finalizeRequestedRef = useRef(false);
  const finalizeExecutionArmedRef = useRef(false);
  const previewGraphBuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewGraphBuildSeqRef = useRef(0);
  const sharedSchemaDraftSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousEditorScopeKeyRef = useRef(editorScopeKey);
  const dslTextScopeKeyRef = useRef(editorScopeKey);
  const dslTextValueRef = useRef('');
  const flushPendingDraftImmediatelyRef = useRef<() => void>(() => {});
  /** 에디터 인스턴스 ref */
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  /** Monaco 인스턴스 ref */
  const monacoRef = useRef<typeof Monaco | null>(null);
  /** Monaco flush content change listener */
  const editorFlushChangeDisposableRef = useRef<Monaco.IDisposable | null>(null);
  /** 최신 편집 가능 여부 */
  const canEditRef = useRef(canEdit);
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
  const erdPhysicalNameSourceEntries = useMemo(
    () => buildErdPhysicalNameSourceEntries(diagramErdStructureSnapshot.currentNodes),
    [diagramErdStructureSnapshot.currentNodes],
  );
  const previewLayoutSourceEntries = useMemo(
    () => buildPreviewLayoutSourceEntries(diagramErdStructureSnapshot.currentNodes),
    [diagramErdStructureSnapshot.currentNodes],
  );
  const previewEdgePresentationEntries = useMemo(
    () =>
      buildPreviewEdgePresentationEntries(
        diagramErdStructureSnapshot.currentNodes,
        diagramErdStructureSnapshot.currentEdges,
      ),
    [diagramErdStructureSnapshot.currentEdges, diagramErdStructureSnapshot.currentNodes],
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

  const { dslText, parsedText, parseResult, parsing, handleDslChange, reparseDsl } = useDslParse({
    dictionary,
  });
  dslTextValueRef.current = dslText;
  const handleScopedDslChange = useCallback(
    (value: string | undefined) => {
      dslTextScopeKeyRef.current = editorScopeKey;
      handleDslChange(value);
    },
    [editorScopeKey, handleDslChange],
  );
  const editorInitialText = dslTextScopeKeyRef.current === editorScopeKey ? dslText : '';

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
   * 로컬 입력이 시작됐음을 표시한다.
   *
   * 늦게 도착한 hydration/bootstrap이 현재 에디터 텍스트를 덮어쓰지 않도록
   * 최초 입력 시작 신호를 보존한다.
   *
   * @returns 없음
   */
  const markLocalEditStarted = useCallback(() => {
    userStartedLocalEditRef.current = true;
    if (!persistDraft) {
      return;
    }
    // Hydration 직후 사용자가 곧바로 입력을 시작하면, 아직 pending hydrate echo가
    // 정리되기 전이라도 사용자 draft를 우선해야 한다. 그렇지 않으면 close/pagehide
    // flush가 generated fallback 대기 상태로 조기 반환해 shared draft를 잃는다.
    pendingHydratedTextRef.current = null;
    generatedFallbackTextRef.current = null;
    draftHydrationSourceRef.current = null;
  }, [persistDraft]);

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
  const hasPendingDraftChanges =
    persistDraft && (requiresApplyBeforeFinalize || requiresPublishedSave);

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
   * code 모드 shared schema draft를 즉시 Y.Doc에 반영한다.
   *
   * debounce 대기 중 페이지 이탈/모드 전환/언마운트가 발생해도
   * 최신 schema draft가 세션 간 복원 경로에 남도록 사용한다.
   *
   * @returns 없음
   */
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
    const { nodes, edges } = diagramErdStructureSnapshot.readCurrentStructure();
    return generate(nodes, edges);
  }, [diagramErdStructureSnapshot, generate]);

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
    return diagramErdStructureSnapshot.readCurrentRevisionHash();
  }, [diagramErdStructureSnapshot]);
  /**
   * 현재 persisted ERD가 표현하는 semantic schema hash를 계산한다.
   *
   * 노드/엣지 ID, handle side, 위치 정보는 제외하고
   * parse 결과와 직접 비교 가능한 table/column/relation 의미 정보만 사용한다.
   *
   * @returns persisted semantic schema hash
   */
  const buildCurrentPersistedSchemaHash = useCallback(() => {
    const { nodes, edges } = diagramErdStructureSnapshot.readCurrentStructure();
    return buildPersistedDiagramSchemaHash(nodes, edges);
  }, [diagramErdStructureSnapshot]);
  const parsedSchemaHash = useMemo(
    () => (parseResult?.result ? buildParsedSchemaHash(parseResult.result) : null),
    [parseResult?.result],
  );

  /**
   * 사용자가 이미 로컬 편집을 시작한 경우 늦게 도착한 hydration/bootstrap 덮어쓰기를 막는다.
   *
   * code 모드에서는 사용자의 현재 텍스트가 우선이며, hydrate는 최초 pristine 상태에서만 허용한다.
   *
   * @returns 로컬 편집이 시작되어 hydration을 건너뛰어야 하면 true
   */
  const shouldSkipLateDraftHydration = useCallback(() => {
    if (!persistDraft || !userStartedLocalEditRef.current) {
      return false;
    }

    if (draftBaselineRevisionRef.current == null) {
      draftBaselineRevisionRef.current = buildCurrentPersistedRevisionHash();
    }

    pendingHydratedTextRef.current = null;
    generatedFallbackTextRef.current = null;
    draftHydrationSourceRef.current = null;
    setDraftHydrated(true);
    return true;
  }, [buildCurrentPersistedRevisionHash, persistDraft]);

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
        const persistedSchemaHash = buildCurrentPersistedSchemaHash();
        if (parsedSchemaHash && persistedSchemaHash === parsedSchemaHash) {
          draftBaselineRevisionRef.current = currentRevision;
          return true;
        }
        toast.error(t('diagram.workMode.sharedDraftConflict'));
        return false;
      }

      return true;
    }, [
      buildCurrentPersistedRevisionHash,
      buildCurrentPersistedSchemaHash,
      parsedSchemaHash,
      persistDraft,
      t,
    ]),
    beforeExecuteManualApply: useCallback(() => {
      if (finalizeRequestedRef.current) {
        finalizeExecutionArmedRef.current = true;
      }
      const formattedDsl = getFormattedDslTextForApply();
      if (formattedDsl && formattedDsl !== dslText) {
        handleScopedDslChange(formattedDsl);
      }
    }, [dslText, getFormattedDslTextForApply, handleScopedDslChange]),
    onManualApplySuccess: useCallback(() => {
      const previewPositionChanges = previewGraph
        ? diagramPreviewPositionActions.syncPreviewPositionOverridesToPersisted(
            previewGraph.nodes,
            previewPositionOverrides,
            diagramErdStructureSnapshot.currentNodes,
          )
        : [];

      const syncedPreviewNodeIds = new Set(previewPositionChanges);
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
      reconcileSharedDraftAfterPersistedApply(nextBaselineRevision, parsedSchemaHash);
      persistDraftRecordImmediately({
        text: dslText,
        baselineRevision: nextBaselineRevision,
        previewPositions: remainingPreviewPositions,
        isIntentionalBlank: dslText.trim().length === 0,
        isConfirmedBlank: dslText.trim().length === 0 && confirmedBlankDraftRef.current,
      });
    }, [
      buildCurrentPersistedRevisionHash,
      diagramErdStructureSnapshot.currentNodes,
      diagramPreviewPositionActions,
      draftHydrated,
      dslText,
      onPreviewPositionOverridesChange,
      parsedSchemaHash,
      previewGraph,
      persistDraft,
      persistDraftRecordImmediately,
      previewPositionOverrides,
      reconcileSharedDraftAfterPersistedApply,
      setRequiresApplyBeforeFinalize,
      setRequiresPublishedSave,
    ]),
  });

  // ERD→Code 동기화 시 커서/스크롤 보존 가드
  const { syncCodeChange, isSyncing, shouldIgnoreChange } = useEditorCursorGuard(
    editorRef,
    handleScopedDslChange,
  );
  const handleUserCodeChangeRef = useRef<(value: string | undefined) => void>(() => {});
  const shouldIgnoreChangeRef = useRef(shouldIgnoreChange);
  const markLocalEditStartedRef = useRef(markLocalEditStarted);
  const markFinalizationDirtyRef = useRef(markFinalizationDirty);

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

  /**
   * 현재 로컬 코드 입력을 shared schema draft snapshot으로 정규화한다.
   *
   * parse 성공 상태만 schema draft에 반영하고, 오류가 있으면 마지막 정상 draft를 유지한다.
   * 사용자가 코드를 명시적으로 비우고 blank가 확인된 경우에만 empty schema draft를 만든다.
   *
   * @returns 저장할 shared schema draft snapshot. 반영 대상이 없으면 null
   */
  const buildCurrentSharedSchemaDraftSnapshot = useCallback((): Omit<
    SharedSchemaDraftSnapshot,
    'updatedAt'
  > | null => {
    const currentText = readCurrentDslText();
    const isIntentionalBlank = currentText.trim().length === 0;
    const isConfirmedBlank = isIntentionalBlank && confirmedBlankDraftRef.current;

    if (isConfirmedBlank) {
      return {
        mode: 'dsl',
        baselineRevision: draftBaselineRevisionRef.current,
        schemaHash: null,
        tables: [],
        relations: [],
        positions: previewPositionOverrides,
        isIntentionalBlank: true,
        isConfirmedBlank: true,
      };
    }

    if (parsedText !== currentText) {
      return null;
    }

    if (!parseResult?.result || errorCount > 0 || !parsedSchemaHash) {
      return null;
    }

    return {
      mode: 'dsl',
      baselineRevision: draftBaselineRevisionRef.current,
      schemaHash: parsedSchemaHash,
      tables: parseResult.result.tables,
      relations: parseResult.result.relations,
      positions: previewPositionOverrides,
      isIntentionalBlank: false,
      isConfirmedBlank: false,
    };
  }, [
    errorCount,
    parsedText,
    parseResult?.result,
    parsedSchemaHash,
    previewPositionOverrides,
    readCurrentDslText,
  ]);

  const flushSharedSchemaDraftImmediately = useCallback(() => {
    if (!persistDraft || !draftHydrated || !ydoc) {
      return;
    }

    if (shouldSkipGeneratedFallbackSharedDraftWrite()) {
      return;
    }

    if (sharedSchemaDraftSyncTimerRef.current) {
      clearTimeout(sharedSchemaDraftSyncTimerRef.current);
      sharedSchemaDraftSyncTimerRef.current = null;
    }

    const nextSnapshot = buildCurrentSharedSchemaDraftSnapshot();
    if (!nextSnapshot) {
      return;
    }

    writeSharedSchemaDraftSnapshot(ydoc, nextSnapshot, SHARED_SCHEMA_DRAFT_ORIGIN);
    onScheduleCodeModeSnapshotPersist?.();
  }, [
    buildCurrentSharedSchemaDraftSnapshot,
    draftHydrated,
    onScheduleCodeModeSnapshotPersist,
    persistDraft,
    shouldSkipGeneratedFallbackSharedDraftWrite,
    ydoc,
  ]);

  /**
   * shared schema draft snapshot을 로컬 코드 문자열로 재생성한다.
   *
   * @param snapshot shared schema draft snapshot
   * @returns local editor hydrate에 사용할 DSL 문자열
   */
  function generateDslFromSharedSchemaDraft(snapshot: SharedSchemaDraftSnapshot): string {
    if (snapshot.isIntentionalBlank && snapshot.isConfirmedBlank) {
      return '';
    }

    const graphForGenerate = buildPreviewGraphFromDslParsedSchema(
      buildParseResultFromSharedSchemaDraft(snapshot),
      [],
      [],
      snapshot.positions,
    );

    return generateDsl(
      normalizePreviewNodesForDslGeneration(graphForGenerate.nodes),
      graphForGenerate.edges,
      {
        findTermById,
        findDomainById,
      },
    );
  }

  /**
   * persisted 반영 이후 shared schema draft와 legacy code draft를 정리한다.
   *
   * 적용 결과와 현재 공유 초안의 schema hash가 같으면 초안을 완전히 비운다.
   * 다르면 다른 사용자의 후속 초안을 보호하기 위해 baseline만 최신 persisted 기준으로 갱신한다.
   *
   * @param nextBaselineRevision 적용 직후 최신 persisted baseline revision
   * @param appliedSchemaHash 방금 persisted로 반영한 schema hash
   * @returns 없음
   */
  function reconcileSharedDraftAfterPersistedApply(
    nextBaselineRevision: string | null,
    appliedSchemaHash: string | null,
  ): void {
    if (!ydoc) {
      return;
    }

    const currentSharedSchemaDraft = readSharedSchemaDraftSnapshot(ydoc);
    const shouldClearSharedSchemaDraft = shouldClearSharedSchemaDraftAfterPersistedApply(
      currentSharedSchemaDraft,
      appliedSchemaHash,
    );

    if (shouldClearSharedSchemaDraft) {
      clearSharedSchemaDraft(ydoc, SHARED_SCHEMA_DRAFT_ORIGIN);
      clearCodeModeSharedDraft(ydoc, SHARED_SCHEMA_DRAFT_ORIGIN);
      onPreviewPositionOverridesChange?.({});
      return;
    }

    if (!hasSharedSchemaDraftContent(currentSharedSchemaDraft)) {
      clearSharedSchemaDraft(ydoc, SHARED_SCHEMA_DRAFT_ORIGIN);
      clearCodeModeSharedDraft(ydoc, SHARED_SCHEMA_DRAFT_ORIGIN);
      onPreviewPositionOverridesChange?.({});
      return;
    }

    writeSharedSchemaDraftSnapshot(
      ydoc,
      {
        mode: currentSharedSchemaDraft.mode,
        baselineRevision: nextBaselineRevision,
        schemaHash: currentSharedSchemaDraft.schemaHash,
        tables: currentSharedSchemaDraft.tables,
        relations: currentSharedSchemaDraft.relations,
        positions: currentSharedSchemaDraft.positions,
        isIntentionalBlank: currentSharedSchemaDraft.isIntentionalBlank,
        isConfirmedBlank: currentSharedSchemaDraft.isConfirmedBlank,
      },
      SHARED_SCHEMA_DRAFT_ORIGIN,
    );
  }

  const {
    handleUserCodeChange,
    handleGeneratedCodeChange,
    clearQueueTimeoutHold,
    syncStatus,
    draftState,
  } = useBidirectionalCodeSync({
    enableCodeToErdSync: canEdit && enableCodeToErdAutoSync,
    blockCodeToErdAutoSync: codeModeDraftPersistStatus === 'stale',
    enableErdToCodeSync: canEdit && enableErdToCodeAutoSync,
    ready: hasDictionary,
    codeText: dslText,
    parsing,
    hasBlockingErrors: errorCount > 0,
    hasParsedTables: parseResult != null && errorCount === 0,
    hasRemoteEditLocks,
    parsedSchemaHash,
    onCodeTextChange: handleScopedDslChange,
    onSyncCodeTextChange: syncCodeChange,
    generateCodeFromErd: generateFromErd,
    currentErdRevisionHash: diagramErdStructureSnapshot.currentRevisionHash,
    applyParsedToErd,
  });

  const isPersistedDraftStale = codeModeDraftPersistStatus === 'stale';

  useEffect(() => {
    canEditRef.current = canEdit;
    handleUserCodeChangeRef.current = handleUserCodeChange;
    shouldIgnoreChangeRef.current = shouldIgnoreChange;
    markLocalEditStartedRef.current = markLocalEditStarted;
    markFinalizationDirtyRef.current = markFinalizationDirty;
  }, [canEdit, handleUserCodeChange, markFinalizationDirty, markLocalEditStarted, shouldIgnoreChange]);

  const handleApplyWithSyncReset = useCallback(() => {
    if (isCodeEditorApplyBlocked(draftState, isPersistedDraftStale)) {
      return;
    }
    clearQueueTimeoutHold();
    handleApply();
  }, [clearQueueTimeoutHold, draftState, handleApply, isPersistedDraftStale]);

  const executeApplyWithSyncReset = useCallback(() => {
    if (isCodeEditorApplyBlocked(draftState, isPersistedDraftStale)) {
      return;
    }
    clearQueueTimeoutHold();
    executeApply();
  }, [clearQueueTimeoutHold, draftState, executeApply, isPersistedDraftStale]);

  const refreshConfirmReason = getCodeEditorRefreshConfirmReason({
    draftState,
    hasPendingFinalizeChanges: hasPendingDraftChanges,
    isPersistedDraftStale,
  });
  const { executeRefresh, handleRefresh, hasNodes, refreshConfirmOpen, setRefreshConfirmOpen } =
    useCodeEditorRefresh({
      generateFromErd,
      onGenerated: handleGeneratedCodeChange,
      hasNodes: diagramErdStructureSnapshot.hasNodes,
      refreshConfirmReason,
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
   * Monaco model flush 변경을 즉시 구독한다.
   *
   * 외부 setValue / 초기 bootstrap 직후 프로그램적 flush가 React effect보다 먼저 발생해도
   * 로컬 draft dirty 승격을 놓치지 않도록 onMount 시점에 바로 listener를 건다.
   *
   * @param editor Monaco editor 인스턴스
   * @returns 없음
   */
  const attachEditorFlushChangeListener = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor) => {
      editorFlushChangeDisposableRef.current?.dispose();
      editorFlushChangeDisposableRef.current = null;

      const model = editor.getModel();
      if (!model) {
        return;
      }

      editorFlushChangeDisposableRef.current = editor.onDidChangeModelContent((event) => {
        if (!event.isFlush) {
          return;
        }
        if (!canEditRef.current) {
          return;
        }

        const nextValue = model.getValue();
        if (nextValue === dslTextValueRef.current) {
          return;
        }
        if (shouldIgnoreChangeRef.current(nextValue)) {
          return;
        }

        markLocalEditStartedRef.current();
        confirmedBlankDraftRef.current = nextValue.trim().length === 0;
        markFinalizationDirtyRef.current();
        handleUserCodeChangeRef.current(nextValue);
      });
    },
    [],
  );

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

    flushPendingDraftImmediatelyRef.current();

    if (isCodeEditorFinalizeBlocked(draftState, isPersistedDraftStale)) {
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
      reconcileSharedDraftAfterPersistedApply(
        buildCurrentPersistedRevisionHash(),
        parsedSchemaHash,
      );
      onResetCodeModeSnapshotPersistState?.();
    }

    resetFinalizationState();
  }, [
    buildCurrentPersistedRevisionHash,
    draftScope,
    finalizing,
    handleApplyWithSyncReset,
    onPersistPublishedDiagram,
    onResetCodeModeSnapshotPersistState,
    parsedSchemaHash,
    persistDraft,
    reconcileSharedDraftAfterPersistedApply,
    draftState,
    isPersistedDraftStale,
    requiresApplyBeforeFinalize,
    requiresPublishedSave,
    resetFinalizationState,
  ]);

  const canFinalize = useMemo(() => {
    if (!persistDraft || !onPersistPublishedDiagram || finalizing) {
      return false;
    }
    if (isCodeEditorFinalizeBlocked(draftState, isPersistedDraftStale)) {
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
    draftState,
    finalizing,
    isPersistedDraftStale,
    onPersistPublishedDiagram,
    persistDraft,
    requiresApplyBeforeFinalize,
    requiresPublishedSave,
  ]);
  const finalizeButtonLabel = useMemo(() => {
    if (requiresApplyBeforeFinalize) {
      return t('erd.codeEditor.finalizeApplyAndSaveButton');
    }
    return t('erd.codeEditor.finalizeSaveButton');
  }, [requiresApplyBeforeFinalize, t]);
  const canApplyWithDraftState = useMemo(
    () => canApply && !isCodeEditorApplyBlocked(draftState, isPersistedDraftStale),
    [canApply, draftState, isPersistedDraftStale],
  );

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

  const syncStatusMeta = getCodeEditorStatusMeta(t, syncStatus, draftState);
  const refreshConfirmCopy = getCodeEditorRefreshConfirmCopy(t, refreshConfirmReason);
  const draftPersistStatusMeta = useMemo<StatusIndicatorMeta | null>(() => {
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
  const previousDraftPersistStatusRef = useRef(codeModeDraftPersistStatus);
  useEffect(() => {
    const previousStatus = previousDraftPersistStatusRef.current;
    previousDraftPersistStatusRef.current = codeModeDraftPersistStatus;
    if (codeModeDraftPersistStatus !== 'stale' || previousStatus === 'stale') {
      return;
    }
    toast.warning(t('erd.codeEditor.draftStatusStale'), {
      action: {
        label: t('erd.codeEditor.draftStatusReloadAction'),
        onClick: () => {
          window.location.reload();
        },
      },
    });
  }, [codeModeDraftPersistStatus, t]);
  const codeFinalizeBlockReason = useMemo(
    () => getCodeEditorFinalizeBlockReason({ draftState, isPersistedDraftStale }),
    [draftState, isPersistedDraftStale],
  );
  const codeStatusMeta = useMemo<StatusIndicatorMeta | null>(() => {
    if (!persistDraft) {
      return syncStatusMeta;
    }

    if (isPersistedDraftStale) {
      return draftPersistStatusMeta;
    }

    if (finalizing) {
      return {
        className: 'text-muted-foreground',
        label: t('erd.codeEditor.finalizeSavingButton'),
        Icon: Loader2,
        spin: true,
      };
    }

    switch (codeFinalizeBlockReason) {
      case 'remote-pending':
        return {
          className: 'text-erd-warning',
          label: t('erd.codeEditor.finalizeRemotePending'),
          Icon: AlertTriangle,
          spin: false,
        };
      case 'invalid-draft':
        return {
          className: 'text-destructive',
          label: t('erd.codeEditor.finalizeInvalidDraft'),
          Icon: XCircle,
          spin: false,
        };
      case 'stale-draft':
        return draftPersistStatusMeta;
      default:
        break;
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

    if (
      codeModeDraftPersistStatus === 'dirty' ||
      codeModeDraftPersistStatus === 'saving' ||
      codeModeDraftPersistStatus === 'error'
    ) {
      return draftPersistStatusMeta;
    }

    return {
      className: 'text-success',
      label: t('erd.codeEditor.finalizeSaved'),
      Icon: CheckCircle2,
      spin: false,
    };
  }, [
    codeFinalizeBlockReason,
    codeModeDraftPersistStatus,
    draftPersistStatusMeta,
    finalizing,
    isPersistedDraftStale,
    persistDraft,
    requiresApplyBeforeFinalize,
    requiresPublishedSave,
    syncStatusMeta,
    t,
  ]);
  const physicalNameHints = useMemo(
    () =>
      buildDslPhysicalNameHints(parseResult?.physicalNameHints ?? [], erdPhysicalNameSourceEntries),
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

  /**
   * 현재 DSL 선택 영역을 물리명 포함 문자열로 복사한다.
   *
   * 기본 Monaco 복사는 injected text를 포함하지 않으므로, 현재 화면에 표시 중인
   * 물리명 힌트를 복사용 문자열에 다시 삽입한 뒤 클립보드에 쓴다.
   *
   * @returns 없음
   */
  const handleCopyWithPhysicalNames = useCallback(async () => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    const currentDslText = model?.getValue() ?? dslTextValueRef.current;
    const selections = editor?.getSelections()?.map((selection) => ({
      startLineNumber: selection.startLineNumber,
      startColumn: selection.startColumn,
      endLineNumber: selection.endLineNumber,
      endColumn: selection.endColumn,
    }));

    try {
      const copiedText = buildDslCopyTextWithPhysicalNames(
        currentDslText,
        physicalNameHints,
        selections,
      );
      await navigator.clipboard.writeText(copiedText);
      toast.success(t('erd.codeEditor.copyWithPhysicalNamesCopied'));
    } catch {
      toast.error(t('erd.codeEditor.copyWithPhysicalNamesFailed'));
    }
  }, [physicalNameHints, t]);

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
    if (previousEditorScopeKeyRef.current === editorScopeKey) {
      return;
    }
    previousEditorScopeKeyRef.current = editorScopeKey;
    handleScopedDslChange('');
  }, [editorScopeKey, handleScopedDslChange]);

  useEffect(() => {
    setDraftHydrated(!persistDraft);
    setDraftFallbackHydrationReady(!persistDraft || !delayDraftHydration);
    draftBaselineRevisionRef.current = null;
    confirmedBlankDraftRef.current = false;
    finalizeRequestedRef.current = false;
    finalizeExecutionArmedRef.current = false;
    pendingDraftRecordRef.current = null;
    lastPersistedDraftRecordRef.current = null;
    setCodeModeSharedDraftBootstrap(null);
    generatedFallbackTextRef.current = null;
    draftHydrationSourceRef.current = null;
    userStartedLocalEditRef.current = false;
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
    if (sharedSchemaDraftSyncTimerRef.current) {
      clearTimeout(sharedSchemaDraftSyncTimerRef.current);
      sharedSchemaDraftSyncTimerRef.current = null;
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

    const hasSharedDraftBootstrapState = hasSharedSchemaDraftContent(sharedSchemaDraftBootstrap);
    const legacySharedDraft = codeModeSharedDraftBootstrap;
    const hasLegacySharedDraftState = hasLegacyCodeModeSharedDraftContent(legacySharedDraft);
    const migratedLegacySharedDraft =
      hasDictionary && legacySharedDraft
        ? buildSharedSchemaDraftSnapshotFromLegacyCodeModeDraft(legacySharedDraft, dictionary)
        : null;
    const shouldPreferLegacySharedDraft =
      hasLegacySharedDraftState &&
      (!hasSharedDraftBootstrapState ||
        isLegacyCodeModeSharedDraftNewer(legacySharedDraft, sharedSchemaDraftBootstrap));
    const storedDraft = sanitizeHydrationDraftRecord(
      loadDiagramDslDraftRecord(draftScope),
      persistedDiagramHasContent,
    );
    const canHydrateFromFallbackSources =
      hasSharedDraftBootstrapState ||
      hasLegacySharedDraftState ||
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
    const sharedSchemaDraftBootstrapText = sharedSchemaDraftBootstrap
      ? generateDslFromSharedSchemaDraft(sharedSchemaDraftBootstrap)
      : '';

    if (shouldSkipLateDraftHydration()) {
      return;
    }

    if (shouldPreferLegacySharedDraft && legacySharedDraft) {
      draftBaselineRevisionRef.current =
        legacySharedDraft.baselineRevision ?? currentBaselineRevision;
      confirmedBlankDraftRef.current =
        legacySharedDraft.text.trim().length === 0 && legacySharedDraft.isConfirmedBlank;
      pendingHydratedTextRef.current = legacySharedDraft.text;
      generatedFallbackTextRef.current = null;
      draftHydrationSourceRef.current = 'shared';
      lastPersistedDraftRecordRef.current = JSON.stringify({
        text: legacySharedDraft.text,
        baselineRevision: draftBaselineRevisionRef.current,
        previewPositions: migratedLegacySharedDraft?.positions ?? {},
        isIntentionalBlank: legacySharedDraft.isIntentionalBlank,
        isConfirmedBlank: legacySharedDraft.isConfirmedBlank,
      });
      setRequiresApplyBeforeFinalize(true);
      setRequiresPublishedSave(true);
      onPreviewPositionOverridesChange?.(migratedLegacySharedDraft?.positions ?? {});
      syncCodeChange(legacySharedDraft.text);
    } else if (hasSharedDraftBootstrapState) {
      draftBaselineRevisionRef.current =
        sharedSchemaDraftBootstrap?.baselineRevision ?? currentBaselineRevision;
      confirmedBlankDraftRef.current =
        sharedSchemaDraftBootstrap?.isIntentionalBlank === true &&
        sharedSchemaDraftBootstrap.isConfirmedBlank === true;
      pendingHydratedTextRef.current = sharedSchemaDraftBootstrapText;
      generatedFallbackTextRef.current = null;
      draftHydrationSourceRef.current = 'shared';
      lastPersistedDraftRecordRef.current = JSON.stringify({
        text: sharedSchemaDraftBootstrapText,
        baselineRevision: draftBaselineRevisionRef.current,
        previewPositions: sharedSchemaDraftBootstrap?.positions ?? {},
        isIntentionalBlank: sharedSchemaDraftBootstrap?.isIntentionalBlank === true,
        isConfirmedBlank: sharedSchemaDraftBootstrap?.isConfirmedBlank === true,
      });
      setRequiresApplyBeforeFinalize(true);
      setRequiresPublishedSave(true);
      onPreviewPositionOverridesChange?.(sharedSchemaDraftBootstrap?.positions ?? {});
      syncCodeChange(sharedSchemaDraftBootstrapText);
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
    codeModeSharedDraftBootstrap,
    dictionary,
    sharedSchemaDraftBootstrap,
    syncCodeChange,
    delayDraftHydration,
  ]);

  useEffect(() => {
    if (!persistDraft || !ydoc) {
      setSharedSchemaDraftBootstrap(null);
      return;
    }

    const draftMap = getSharedSchemaDraftMap(ydoc);
    const syncSharedSchemaDraft = () => {
      const nextSnapshot = readSharedSchemaDraftSnapshot(ydoc);
      setSharedSchemaDraftBootstrap(
        hasSharedSchemaDraftContent(nextSnapshot) ? nextSnapshot : null,
      );
    };

    syncSharedSchemaDraft();
    draftMap.observe(syncSharedSchemaDraft);
    return () => {
      draftMap.unobserve(syncSharedSchemaDraft);
    };
  }, [persistDraft, ydoc]);

  useEffect(() => {
    if (!persistDraft || !ydoc) {
      setCodeModeSharedDraftBootstrap(null);
      return;
    }

    const draftMap = getCodeModeSharedDraftMap(ydoc);
    const syncCodeModeSharedDraft = () => {
      const nextSnapshot = readCodeModeSharedDraftSnapshot(ydoc);
      setCodeModeSharedDraftBootstrap(
        hasLegacyCodeModeSharedDraftContent(nextSnapshot) ? nextSnapshot : null,
      );
    };

    syncCodeModeSharedDraft();
    draftMap.observe(syncCodeModeSharedDraft);
    return () => {
      draftMap.unobserve(syncCodeModeSharedDraft);
    };
  }, [persistDraft, ydoc]);

  useEffect(() => {
    if (!persistDraft || !ydoc || !hasDictionary || !codeModeSharedDraftBootstrap) {
      return;
    }

    const legacySharedDraft = codeModeSharedDraftBootstrap;
    const currentSharedSchemaDraft = readSharedSchemaDraftSnapshot(ydoc);
    const migratedSnapshot = buildSharedSchemaDraftSnapshotFromLegacyCodeModeDraft(
      legacySharedDraft,
      dictionary,
    );
    if (!migratedSnapshot) {
      return;
    }

    const shouldPromoteLegacyDraft =
      !hasSharedSchemaDraftContent(currentSharedSchemaDraft) ||
      isLegacyCodeModeSharedDraftNewer(legacySharedDraft, currentSharedSchemaDraft);
    if (!shouldPromoteLegacyDraft) {
      return;
    }

    writeSharedSchemaDraftSnapshot(ydoc, migratedSnapshot, SHARED_SCHEMA_DRAFT_ORIGIN);
    clearCodeModeSharedDraft(ydoc, SHARED_SCHEMA_DRAFT_ORIGIN);
  }, [codeModeSharedDraftBootstrap, dictionary, hasDictionary, persistDraft, ydoc]);

  useEffect(() => {
    if (
      !persistDraft ||
      !draftHydrated ||
      !sharedSchemaDraftBootstrap ||
      draftHydrationSourceRef.current !== 'generated' ||
      userStartedLocalEditRef.current
    ) {
      return;
    }

    const sharedSchemaDraftBootstrapText = generateDslFromSharedSchemaDraft(
      sharedSchemaDraftBootstrap,
    );
    const currentText = readCurrentDslText();
    const generatedFallbackText = generatedFallbackTextRef.current;
    if (
      !generatedFallbackText ||
      currentText !== generatedFallbackText ||
      currentText === sharedSchemaDraftBootstrapText
    ) {
      return;
    }

    draftBaselineRevisionRef.current =
      sharedSchemaDraftBootstrap.baselineRevision ?? draftBaselineRevisionRef.current;
    confirmedBlankDraftRef.current =
      sharedSchemaDraftBootstrap.isIntentionalBlank && sharedSchemaDraftBootstrap.isConfirmedBlank;
    pendingHydratedTextRef.current = sharedSchemaDraftBootstrapText;
    generatedFallbackTextRef.current = null;
    draftHydrationSourceRef.current = 'shared';
    lastPersistedDraftRecordRef.current = JSON.stringify({
      text: sharedSchemaDraftBootstrapText,
      baselineRevision: draftBaselineRevisionRef.current,
      previewPositions: sharedSchemaDraftBootstrap.positions,
      isIntentionalBlank: sharedSchemaDraftBootstrap.isIntentionalBlank,
      isConfirmedBlank: sharedSchemaDraftBootstrap.isConfirmedBlank,
    });
    setRequiresApplyBeforeFinalize(true);
    setRequiresPublishedSave(true);
    onPreviewPositionOverridesChange?.(sharedSchemaDraftBootstrap.positions);
    syncCodeChange(sharedSchemaDraftBootstrapText);
  }, [
    draftHydrated,
    onPreviewPositionOverridesChange,
    persistDraft,
    readCurrentDslText,
    sharedSchemaDraftBootstrap,
    setRequiresApplyBeforeFinalize,
    setRequiresPublishedSave,
    syncCodeChange,
  ]);

  useEffect(() => {
    if (
      !persistDraft ||
      !draftHydrated ||
      !codeModeSharedDraftBootstrap ||
      draftHydrationSourceRef.current !== 'generated' ||
      userStartedLocalEditRef.current
    ) {
      return;
    }

    if (
      sharedSchemaDraftBootstrap &&
      !isLegacyCodeModeSharedDraftNewer(codeModeSharedDraftBootstrap, sharedSchemaDraftBootstrap)
    ) {
      return;
    }

    const currentText = readCurrentDslText();
    const generatedFallbackText = generatedFallbackTextRef.current;
    if (
      !generatedFallbackText ||
      currentText !== generatedFallbackText ||
      currentText === codeModeSharedDraftBootstrap.text
    ) {
      return;
    }

    const migratedLegacySharedDraft =
      hasDictionary && hasLegacyCodeModeSharedDraftContent(codeModeSharedDraftBootstrap)
        ? buildSharedSchemaDraftSnapshotFromLegacyCodeModeDraft(
            codeModeSharedDraftBootstrap,
            dictionary,
          )
        : null;

    draftBaselineRevisionRef.current =
      codeModeSharedDraftBootstrap.baselineRevision ?? draftBaselineRevisionRef.current;
    confirmedBlankDraftRef.current =
      codeModeSharedDraftBootstrap.text.trim().length === 0 &&
      codeModeSharedDraftBootstrap.isConfirmedBlank;
    pendingHydratedTextRef.current = codeModeSharedDraftBootstrap.text;
    generatedFallbackTextRef.current = null;
    draftHydrationSourceRef.current = 'shared';
    lastPersistedDraftRecordRef.current = JSON.stringify({
      text: codeModeSharedDraftBootstrap.text,
      baselineRevision: draftBaselineRevisionRef.current,
      previewPositions: migratedLegacySharedDraft?.positions ?? {},
      isIntentionalBlank: codeModeSharedDraftBootstrap.isIntentionalBlank,
      isConfirmedBlank: codeModeSharedDraftBootstrap.isConfirmedBlank,
    });
    setRequiresApplyBeforeFinalize(true);
    setRequiresPublishedSave(true);
    onPreviewPositionOverridesChange?.(migratedLegacySharedDraft?.positions ?? {});
    syncCodeChange(codeModeSharedDraftBootstrap.text);
  }, [
    codeModeSharedDraftBootstrap,
    dictionary,
    draftHydrated,
    hasDictionary,
    onPreviewPositionOverridesChange,
    persistDraft,
    readCurrentDslText,
    sharedSchemaDraftBootstrap,
    syncCodeChange,
  ]);

  const flushPendingDraftImmediately = useCallback(() => {
    if (!draftHydrated || !hasPendingDraftChanges) {
      return;
    }
    const currentText = readCurrentDslText();
    if (pendingHydratedTextRef.current != null && currentText !== pendingHydratedTextRef.current) {
      return;
    }

    pendingDraftRecordRef.current = {
      text: currentText,
      baselineRevision: draftBaselineRevisionRef.current,
      previewPositions: previewPositionOverrides,
      isIntentionalBlank: currentText.trim().length === 0,
      isConfirmedBlank: currentText.trim().length === 0 && confirmedBlankDraftRef.current,
    };
    if (persistDraft && ydoc) {
      writeCodeModeSharedDraftTextSnapshot(
        ydoc,
        currentText,
        draftBaselineRevisionRef.current,
        currentText.trim().length === 0,
        currentText.trim().length === 0 && confirmedBlankDraftRef.current,
        SHARED_SCHEMA_DRAFT_ORIGIN,
      );
    }
    persistDraftRecordImmediately(pendingDraftRecordRef.current);
    flushSharedSchemaDraftImmediately();
  }, [
    draftHydrated,
    flushSharedSchemaDraftImmediately,
    hasPendingDraftChanges,
    persistDraft,
    persistDraftRecordImmediately,
    previewPositionOverrides,
    readCurrentDslText,
    ydoc,
  ]);
  flushPendingDraftImmediatelyRef.current = flushPendingDraftImmediately;

  useEffect(() => {
    if (!persistDraft) {
      return;
    }

    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('pagehide', flushPendingDraftImmediately);
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingDraftImmediately();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (typeof globalThis.removeEventListener === 'function') {
        globalThis.removeEventListener('pagehide', flushPendingDraftImmediately);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      flushPendingDraftImmediately();
    };
  }, [persistDraft, flushPendingDraftImmediately]);

  useEffect(() => {
    if (!persistDraft || !registerBeforeCodeModeSnapshotPersist) {
      return;
    }
    registerBeforeCodeModeSnapshotPersist(flushPendingDraftImmediately);
    return () => {
      registerBeforeCodeModeSnapshotPersist(null);
    };
  }, [flushPendingDraftImmediately, persistDraft, registerBeforeCodeModeSnapshotPersist]);

  useEffect(() => {
    if (!persistDraft || !draftHydrated || !ydoc || !hasPendingDraftChanges) {
      return;
    }

    if (sharedSchemaDraftSyncTimerRef.current) {
      clearTimeout(sharedSchemaDraftSyncTimerRef.current);
    }

    sharedSchemaDraftSyncTimerRef.current = setTimeout(() => {
      flushSharedSchemaDraftImmediately();
    }, CODE_SHARED_DRAFT_SYNC_IDLE_MS);

    return () => {
      if (sharedSchemaDraftSyncTimerRef.current) {
        clearTimeout(sharedSchemaDraftSyncTimerRef.current);
        sharedSchemaDraftSyncTimerRef.current = null;
      }
    };
  }, [
    draftHydrated,
    dslText,
    errorCount,
    flushSharedSchemaDraftImmediately,
    hasPendingDraftChanges,
    parseResult?.result,
    parsedSchemaHash,
    persistDraft,
    previewPositionOverrides,
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
      markLocalEditStarted();
      confirmedBlankDraftRef.current = (value ?? '').trim().length === 0;
      markFinalizationDirty();
      handleUserCodeChange(value);
    },
    [handleUserCodeChange, markFinalizationDirty, markLocalEditStarted, shouldIgnoreChange],
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
    attachEditorFlushChangeListener(editor);

    const modelText = editor.getModel()?.getValue() ?? '';
    const currentText =
      dslTextScopeKeyRef.current === editorScopeKey ? dslTextValueRef.current : '';
    if (modelText !== currentText) {
      const shouldPromoteModelTextAsLocalDraft =
        persistDraft &&
        modelText.trim().length > 0 &&
        (draftHydrationSourceRef.current == null || draftHydrationSourceRef.current === 'generated') &&
        pendingHydratedTextRef.current == null;

      if (shouldPromoteModelTextAsLocalDraft) {
        markLocalEditStartedRef.current();
        confirmedBlankDraftRef.current = false;
        markFinalizationDirtyRef.current();
        handleUserCodeChangeRef.current(modelText);
        return;
      }

      syncCodeChange(currentText);
    }
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !canEdit) {
      return;
    }

    const compositionStartDisposable = editor.onDidCompositionStart(() => {
      markLocalEditStarted();
    });
    const pasteDisposable = editor.onDidPaste(() => {
      markLocalEditStarted();
    });

    return () => {
      compositionStartDisposable.dispose();
      pasteDisposable.dispose();
    };
  }, [canEdit, markLocalEditStarted, monacoReady]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    attachEditorFlushChangeListener(editor);
    return () => {
      editorFlushChangeDisposableRef.current?.dispose();
      editorFlushChangeDisposableRef.current = null;
    };
  }, [attachEditorFlushChangeListener]);

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
          key={editorModelPath}
          height="100%"
          language={DSL_LANGUAGE_ID}
          defaultValue={editorInitialText}
          path={editorModelPath}
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
        canApply={canApplyWithDraftState}
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
        refreshConfirmTitle={refreshConfirmCopy.title}
        refreshConfirmDescription={refreshConfirmCopy.description}
        onFinalize={persistDraft ? handleFinalize : undefined}
        finalizeButtonLabel={persistDraft ? finalizeButtonLabel : undefined}
        canFinalize={canFinalize}
        finalizing={finalizing}
        onCopyWithPhysicalNames={handleCopyWithPhysicalNames}
        canCopyWithPhysicalNames={Boolean(
          parseResult?.result && errorCount === 0 && dslText.trim().length > 0,
        )}
      >
        <DslFooterStatus
          parsing={parsing}
          parseResult={parseResult}
          errorCount={errorCount}
          warningCount={warningCount}
          hasDslText={dslText.trim().length > 0}
          statusMeta={codeStatusMeta}
        />
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

/** code editor 상태 표시 공통 형태 */
interface StatusIndicatorMeta {
  className: string;
  label: string;
  Icon: LucideIcon;
  spin: boolean;
  title?: string;
}

/**
 * DSL 코드 에디터 하단 파싱·동기화 상태 표시 영역.
 *
 * `React.memo`로 감싸 불필요한 리렌더링을 방지한다.
 */
const DslFooterStatus = memo(function DslFooterStatus({
  parsing,
  parseResult,
  errorCount,
  warningCount,
  hasDslText,
  statusMeta,
}: {
  parsing: boolean;
  parseResult: DslParseResult | null;
  errorCount: number;
  warningCount: number;
  hasDslText: boolean;
  statusMeta: SyncStatusMeta | StatusIndicatorMeta | null;
}) {
  const { t } = useTranslation();

  return (
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

          {parseResult.result.tables.length === 0 && errorCount === 0 && hasDslText && (
            <span className="flex items-center gap-1 text-muted-foreground">
              {t('erd.dsl.noTables')}
            </span>
          )}
        </>
      )}

      {statusMeta && (
        <span
          className={cn('flex items-center gap-1', statusMeta.className)}
          aria-label={t('erd.sync.statusAria')}
          title={'title' in statusMeta ? statusMeta.title : undefined}
        >
          <statusMeta.Icon className={cn('h-3 w-3', statusMeta.spin && 'animate-spin')} />
          {statusMeta.label}
        </span>
      )}
    </div>
  );
});
