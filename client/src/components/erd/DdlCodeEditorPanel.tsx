import { lazy, memo, Suspense, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, CircleHelp } from 'lucide-react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Spinner from '@/components/ui/spinner';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useDdlParse } from '@/hooks/useDdlParse';
import { useApplyToErd } from '@/hooks/useApplyToErd';
import { useBidirectionalCodeSync } from '@/hooks/useBidirectionalCodeSync';
import { useCodeEditorRefresh } from '@/hooks/useCodeEditorRefresh';
import { useDiagramErdStructureSnapshot } from '@/collaboration/channel/diagram/use-diagram-erd-read-snapshot';
import '@/lib/monaco-setup';
import { useCodeEditorTableLock } from '@/hooks/useCodeEditorTableLock';
import { useCodeEditorTableNavigation } from '@/hooks/useCodeEditorTableNavigation';
import { useCodeEditorTableReveal } from '@/hooks/useCodeEditorTableReveal';
import { useRemoteEditLocks } from '@/hooks/useRemoteEditLocks';
import { useEditorCursorGuard } from '@/hooks/useEditorCursorGuard';
import { DSL_TABLE_KEYWORD, DSL_COLUMN_OPTIONS } from '@/lib/dsl-keywords';
import { buildParsedSchemaHash } from '@/lib/code-sync-schema-hash';
import type {
  CodeEditorNavigableTable,
  CodeEditorTableFocusRequest,
  CodeEditorTableRevealRequest,
} from '@/lib/code-editor-table-navigation';
import { buildCodeEditorNavigableTables } from '@/lib/code-editor-table-navigation';
import type { DiagramWorkMode } from '@/lib/diagram-work-mode';
import type { DslPreviewCanvasState } from '@/lib/dsl-preview-graph';
import type { DiagramPreviewPositionRecord } from '@/lib/diagram-code-draft';
import type { DdlParseResult } from '@/lib/ddl-parser';
import { isCodeEditorApplyBlocked } from '@/lib/code-editor-draft-policy';
import {
  getCodeEditorStatusMeta,
  type SyncStatusMeta,
} from '@/lib/sync-status-meta';
import { cn } from '@/lib/utils';
import { generateDdl } from '@/lib/ddl-generator';
import CodeEditorFooter from './CodeEditorFooter';
import type { DbmsType, TableNode, ERDEdge } from '@/types/erd';
import type { TFunction } from 'i18next';

/**
 * 진단 항목의 i18n 메시지키를 번역한다.
 *
 * messageKey가 동적 문자열이므로 t() 호출 시 타입 캐스팅이 필요하다.
 * 이 헬퍼에 캐스팅을 격리하여 나머지 코드에서 as any 사용을 방지한다.
 *
 * @param t          i18n 번역 함수
 * @param messageKey 진단 메시지 i18n 키
 * @param messageArgs 보간 인자
 * @returns 번역된 메시지 문자열
 */
function translateDiagnostic(
  t: TFunction,
  messageKey: string,
  messageArgs?: Record<string, string>,
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return t(messageKey as any, messageArgs);
}

/** DSL 패널 lazy import (Monaco 번들 분리) */
const DslCodeEditorPanel = lazy(() => import('./DslCodeEditorPanel'));

/** 코드 에디터 모드 */
type EditorMode = 'sql' | 'dsl';
const [OPT_PK, OPT_AI, OPT_NN] = DSL_COLUMN_OPTIONS;
type CodeModeDraftPersistStatus = 'inactive' | 'dirty' | 'saving' | 'saved' | 'error' | 'stale';

/** DdlCodeEditorPanel 컴포넌트의 props */
interface DdlCodeEditorPanelProps {
  /** 편집 가능 여부 (VIEWER일 때 false) */
  canEdit?: boolean;
  /** 코드 -> ERD 자동동기화 활성 여부 */
  enableCodeToErdAutoSync?: boolean;
  /** ERD -> 코드 자동생성 활성 여부 */
  enableErdToCodeAutoSync?: boolean;
  /** 코드 에디터 테이블 락 발행 여부 */
  enableTableLock?: boolean;
  /** DSL 탭만 허용 여부 */
  dslOnly?: boolean;
  /** 현재 작업 모드 */
  workMode?: DiagramWorkMode;
  /** DSL preview 상태 변경 핸들러 */
  onDslPreviewStateChange?: (previewState: DslPreviewCanvasState | null) => void;
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
  /** remote Y.Doc snapshot/bootstrap 완료 전 draft hydrate 보류 여부 */
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
  codeModeDraftPersistStatus?: CodeModeDraftPersistStatus;
  /** code 모드 shared schema draft 서버 저장 완료 시각 */
  codeModeDraftPersistedAt?: number | null;
  /** code 모드 published 다이어그램 최종 저장 요청 */
  onPersistPublishedDiagram?: () => Promise<boolean>;
}

/**
 * 코드 에디터 패널 (SQL DDL / 논리명 DSL 탭 전환).
 *
 * 좌측 사이드바 대체 패널로 SQL DDL 또는 논리명 DSL을 입력하면
 * 실시간 파싱 프리뷰를 표시하고, Apply 버튼으로 ERD에 반영한다.
 *
 * @param props.canEdit 편집 가능 여부
 * @returns 코드 에디터 패널 JSX
 */
export default function DdlCodeEditorPanel({
  canEdit = true,
  enableCodeToErdAutoSync = true,
  enableErdToCodeAutoSync = true,
  enableTableLock = true,
  dslOnly = false,
  workMode = 'sync',
  onDslPreviewStateChange,
  persistDraft = false,
  previewPositionOverrides,
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
}: DdlCodeEditorPanelProps) {
  const { t } = useTranslation();

  /** 에디터 모드 (기본값: DSL) */
  const [mode, setMode] = useState<EditorMode>('dsl');

  useEffect(() => {
    if (dslOnly && mode !== 'dsl') {
      setMode('dsl');
    }
  }, [dslOnly, mode]);

  return (
    <div className="h-full flex flex-col bg-background border-r border-border">
      {/* 모드 탭 */}
      <div className="flex items-center border-b border-border shrink-0">
        {dslOnly ? (
          <div className="flex flex-1 items-center justify-between px-3 py-1.5">
            <div className="text-xs font-medium text-foreground">{t('erd.dsl.tabLabel')}</div>
            {workMode === 'code' && (
              <span className="text-[11px] text-muted-foreground">
                {t('diagram.workMode.codeDslOnly')}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'sql'}
              className={cn(
                'flex-1 px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                mode === 'sql'
                  ? 'bg-background text-foreground border-b-2 border-primary'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setMode('sql')}
            >
              SQL DDL
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'dsl'}
              className={cn(
                'flex-1 px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                mode === 'dsl'
                  ? 'bg-background text-foreground border-b-2 border-primary'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setMode('dsl')}
            >
              {t('erd.dsl.tabLabel')}
            </button>
          </div>
        )}
        {mode === 'dsl' && (
          <div className="px-2">
            <DslSyntaxGuideDialog />
          </div>
        )}
      </div>

      {/* 모드별 에디터 */}
      <div className="flex-1 min-h-0" role="tabpanel">
        {mode === 'sql' ? (
          <SqlDdlEditor
            canEdit={canEdit}
            enableCodeToErdAutoSync={enableCodeToErdAutoSync}
            enableErdToCodeAutoSync={enableErdToCodeAutoSync}
            enableTableLock={enableTableLock}
            onNavigateToTable={onNavigateToTable}
            tableRevealRequest={tableRevealRequest}
          />
        ) : (
          <Suspense fallback={<Spinner text={t('common.loading')} />}>
            <DslCodeEditorPanel
              canEdit={canEdit}
              enableCodeToErdAutoSync={enableCodeToErdAutoSync}
              enableErdToCodeAutoSync={enableErdToCodeAutoSync}
              enableTableLock={enableTableLock}
              onPreviewStateChange={onDslPreviewStateChange}
              persistDraft={persistDraft}
              previewPositionOverrides={previewPositionOverrides}
              onPreviewPositionOverridesChange={onPreviewPositionOverridesChange}
              onNavigateToTable={onNavigateToTable}
              tableRevealRequest={tableRevealRequest}
              delayDraftHydration={delayDraftHydration}
              persistedDiagramHasContent={persistedDiagramHasContent}
              onScheduleCodeModeSnapshotPersist={onScheduleCodeModeSnapshotPersist}
              onResetCodeModeSnapshotPersistState={onResetCodeModeSnapshotPersistState}
              registerBeforeCodeModeSnapshotPersist={registerBeforeCodeModeSnapshotPersist}
              codeModeDraftPersistStatus={codeModeDraftPersistStatus}
              codeModeDraftPersistedAt={codeModeDraftPersistedAt}
              onPersistPublishedDiagram={onPersistPublishedDiagram}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

/**
 * DSL 문법 가이드 레이어 팝업.
 *
 * @returns DSL 문법 가이드 다이얼로그 JSX
 */
function DslSyntaxGuideDialog() {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label={t('erd.dsl.syntaxGuide.ariaOpen')}
        >
          <CircleHelp className="h-3.5 w-3.5" />
          {t('erd.dsl.syntaxGuide.openButton')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl p-0">
        <div className="border-b border-border px-6 py-4 pr-10">
          <DialogTitle className="text-base">{t('erd.dsl.syntaxGuide.title')}</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {t('erd.dsl.syntaxGuide.description')}
          </DialogDescription>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5 text-sm">
          <section className="space-y-2">
            <h3 className="font-semibold">{t('erd.dsl.syntaxGuide.structureTitle')}</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                {t('erd.dsl.syntaxGuide.structureRule1', {
                  tableKeyword: DSL_TABLE_KEYWORD,
                })}
              </li>
              <li>{t('erd.dsl.syntaxGuide.structureRule2')}</li>
              <li>{t('erd.dsl.syntaxGuide.structureRule3')}</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">{t('erd.dsl.syntaxGuide.columnTitle')}</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                {t('erd.dsl.syntaxGuide.columnRule1', {
                  pk: OPT_PK,
                  ai: OPT_AI,
                  nn: OPT_NN,
                })}
              </li>
              <li>{t('erd.dsl.syntaxGuide.columnRule2')}</li>
              <li>{t('erd.dsl.syntaxGuide.columnRule3')}</li>
              <li>{t('erd.dsl.syntaxGuide.columnRule4')}</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">{t('erd.dsl.syntaxGuide.examplesTitle')}</h3>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t('erd.dsl.syntaxGuide.exampleBasicLabel')}
                </p>
                <pre className="overflow-x-auto rounded-md border border-border bg-muted/60 p-3 text-xs leading-relaxed">
                  <code>
                    {t('erd.dsl.syntaxGuide.exampleBasicCode', {
                      tableKeyword: DSL_TABLE_KEYWORD,
                      pk: OPT_PK,
                      ai: OPT_AI,
                      nn: OPT_NN,
                    })}
                  </code>
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t('erd.dsl.syntaxGuide.exampleRelationLabel')}
                </p>
                <pre className="overflow-x-auto rounded-md border border-border bg-muted/60 p-3 text-xs leading-relaxed">
                  <code>
                    {t('erd.dsl.syntaxGuide.exampleRelationCode', {
                      tableKeyword: DSL_TABLE_KEYWORD,
                      pk: OPT_PK,
                      ai: OPT_AI,
                      nn: OPT_NN,
                    })}
                  </code>
                </pre>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">{t('erd.dsl.syntaxGuide.invalidTitle')}</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>{t('erd.dsl.syntaxGuide.invalidRule1')}</li>
              <li>{t('erd.dsl.syntaxGuide.invalidRule2')}</li>
              <li>{t('erd.dsl.syntaxGuide.invalidRule3')}</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * SQL DDL 에디터 패널.
 *
 * @param props.canEdit 편집 가능 여부
 * @returns SQL DDL 에디터 JSX
 */
function SqlDdlEditor({
  canEdit = true,
  enableCodeToErdAutoSync = true,
  enableErdToCodeAutoSync = true,
  enableTableLock = true,
  onNavigateToTable,
  tableRevealRequest,
}: {
  canEdit?: boolean;
  enableCodeToErdAutoSync?: boolean;
  enableErdToCodeAutoSync?: boolean;
  enableTableLock?: boolean;
  onNavigateToTable?: (request: CodeEditorTableFocusRequest) => void;
  tableRevealRequest?: CodeEditorTableRevealRequest | null;
}) {
  const { t } = useTranslation();
  const { teamId, projectId, diagramId } = useParams<{
    teamId: string;
    projectId: string;
    diagramId: string;
  }>();
  const remoteEditLocks = useRemoteEditLocks();
  const hasRemoteEditLocks = remoteEditLocks.hasTableLocks;
  const diagramErdStructureSnapshot = useDiagramErdStructureSnapshot();

  const { dbms, ddlText, parseResult, parsing, handleDdlChange, handleDbmsChange } = useDdlParse({
    persistDbms: true,
  });

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
    parseResult,
    parsing,
    policyScope: { teamId, projectId, diagramId },
    hasBlockingStructureLocks: remoteEditLocks.hasBlockingStructureLocks,
  });

  /** ERD → SQL DDL 생성 함수 (useCodeEditorRefresh에 전달) */
  const generate = useCallback(
    (nodes: TableNode[], edges: ERDEdge[]) => generateDdl(nodes, edges, dbms),
    [dbms],
  );

  /** 현재 ERD 상태를 SQL DDL 텍스트로 생성한다. */
  const generateFromErd = useCallback(() => {
    const { nodes, edges } = diagramErdStructureSnapshot.readCurrentStructure();
    return generate(nodes, edges);
  }, [diagramErdStructureSnapshot, generate]);

  const hasBlockingErrors =
    (parseResult?.diagnostics.some((d) => d.severity === 'error') ?? false) ||
    ((parseResult?.tables.length ?? 0) === 0 && (parseResult?.errors.length ?? 0) > 0);

  /** 에디터 인스턴스 ref (커서 가드용으로 sync 훅보다 앞에 선언) */
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const parsedSchemaHash = useMemo(
    () => (parseResult ? buildParsedSchemaHash(parseResult) : null),
    [parseResult],
  );

  // ERD→Code 동기화 시 커서/스크롤 보존 가드
  const { syncCodeChange, shouldIgnoreChange } = useEditorCursorGuard(editorRef, handleDdlChange);

  const {
    handleUserCodeChange,
    handleGeneratedCodeChange,
    clearQueueTimeoutHold,
    syncStatus,
    draftState,
  } =
    useBidirectionalCodeSync({
      enableCodeToErdSync: canEdit && enableCodeToErdAutoSync,
      enableErdToCodeSync: canEdit && enableErdToCodeAutoSync,
      codeText: ddlText,
      parsing,
      hasBlockingErrors,
      hasParsedTables: parseResult != null && !hasBlockingErrors,
      hasRemoteEditLocks,
      parsedSchemaHash,
      onCodeTextChange: handleDdlChange,
      onSyncCodeTextChange: syncCodeChange,
      generateCodeFromErd: generateFromErd,
      currentErdRevisionHash: diagramErdStructureSnapshot.currentRevisionHash,
      applyParsedToErd,
    });

  const handleApplyWithSyncReset = useCallback(() => {
    if (isCodeEditorApplyBlocked(draftState)) {
      return;
    }
    clearQueueTimeoutHold();
    handleApply();
  }, [clearQueueTimeoutHold, draftState, handleApply]);

  const executeApplyWithSyncReset = useCallback(() => {
    if (isCodeEditorApplyBlocked(draftState)) {
      return;
    }
    clearQueueTimeoutHold();
    executeApply();
  }, [clearQueueTimeoutHold, draftState, executeApply]);

  const { executeRefresh, handleRefresh, hasNodes, refreshConfirmOpen, setRefreshConfirmOpen } =
    useCodeEditorRefresh({
      generateFromErd,
      onGenerated: handleGeneratedCodeChange,
      hasNodes: diagramErdStructureSnapshot.hasNodes,
      currentText: ddlText,
    });

  const syncStatusMeta = getCodeEditorStatusMeta(t, syncStatus, draftState);
  const canApplyWithDraftState = canApply && !isCodeEditorApplyBlocked(draftState);
  const navigableTables = useMemo<CodeEditorNavigableTable[]>(
    () => buildCodeEditorNavigableTables(parseResult?.tables ?? [], parseResult?.tableRanges ?? []),
    [parseResult?.tableRanges, parseResult?.tables],
  );

  /** 다크 모드 감지 (반응형) */
  const isDark = useDarkMode();
  /** Monaco 인스턴스 ref */
  const monacoRef = useRef<typeof Monaco | null>(null);
  /** 에디터 mount 완료 여부 */
  const [editorReady, setEditorReady] = useState(false);

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
   * onMount — editorRef/monacoRef 저장.
   *
   * @param editor Monaco editor 인스턴스
   * @param monaco Monaco 네임스페이스
   * @returns 없음
   */
  const handleOnMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorReady(true);
  };

  useCodeEditorTableLock({
    enabled: canEdit && enableTableLock,
    editorReady,
    editorRef,
    tableRanges: parseResult?.tableRanges ?? [],
    hasParseErrors: hasBlockingErrors,
  });
  useCodeEditorTableNavigation({
    enabled: !!onNavigateToTable,
    editorReady,
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
    editorReady,
    editorRef,
    tables: navigableTables,
    request: tableRevealRequest,
  });
  useEffect(() => {
    if (!tableRevealRequest || !editorReady) {
      return;
    }
    if (ddlText.trim().length > 0 || navigableTables.length > 0 || !hasNodes) {
      return;
    }
    executeRefresh();
  }, [ddlText, editorReady, executeRefresh, hasNodes, navigableTables.length, tableRevealRequest]);

  // diagnostics 변경 시 SQL 에러 마커 갱신 (라인 전체 마킹 정책)
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

    const diagnostics = parseResult?.diagnostics ?? [];
    if (diagnostics.length === 0) {
      monaco.editor.setModelMarkers(model, 'sql-ddl', []);
    } else {
      const lineCount = model.getLineCount();
      const markers: Monaco.editor.IMarkerData[] = diagnostics.flatMap((diag) => {
        if (!diag.location) {
          return [];
        }

        const line = Math.min(Math.max(diag.location.line, 1), lineCount);
        const endColumn = Math.max(2, model.getLineMaxColumn(line));
        return [
          {
            severity:
              diag.severity === 'error'
                ? monaco.MarkerSeverity.Error
                : monaco.MarkerSeverity.Warning,
            message: translateDiagnostic(t, diag.messageKey, diag.messageArgs),
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn,
          },
        ];
      });

      monaco.editor.setModelMarkers(model, 'sql-ddl', markers);
    }

    return () => {
      if (!model.isDisposed()) {
        monaco.editor.setModelMarkers(model, 'sql-ddl', []);
      }
    };
  }, [parseResult, t]);

  return (
    <div className="h-full flex flex-col">
      {/* DBMS 선택 */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <Label className="text-xs text-muted-foreground mb-1 block">
          {t('erd.ddlImport.dbmsLabel')}
        </Label>
        <Select value={dbms} onValueChange={(v) => handleDbmsChange(v as DbmsType)}>
          <SelectTrigger className="h-8 text-xs" aria-label={t('erd.ddlImport.dbmsLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="postgresql">{t('erd.ddlExport.dbms.postgresql')}</SelectItem>
            <SelectItem value="mysql">{t('erd.ddlExport.dbms.mysql')}</SelectItem>
            <SelectItem value="oracle">{t('erd.ddlExport.dbms.oracle')}</SelectItem>
            <SelectItem value="sqlserver">{t('erd.ddlExport.dbms.sqlserver')}</SelectItem>
            <SelectItem value="ansi">{t('erd.ddlExport.dbms.ansi')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="sql"
          value={ddlText}
          onChange={guardedOnChange}
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
        onApply={handleApplyWithSyncReset}
        canApply={canApplyWithDraftState}
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
        <SqlFooterStatus
          parsing={parsing}
          parseResult={parseResult}
          syncStatusMeta={syncStatusMeta}
        />
      </CodeEditorFooter>
    </div>
  );
}

/**
 * SQL DDL 에디터 하단 파싱 상태 표시.
 *
 * React.memo로 감싸 parsing/parseResult/syncStatusMeta가 변하지 않으면 리렌더링을 스킵한다.
 * CodeEditorFooter의 memo와 함께 작동하여 불필요한 깜빡임을 방지한다.
 */
const SqlFooterStatus = memo(function SqlFooterStatus({
  parsing,
  parseResult,
  syncStatusMeta,
}: {
  parsing: boolean;
  parseResult: DdlParseResult | null;
  syncStatusMeta: SyncStatusMeta | null;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 text-xs min-h-[20px]">
      {parsing && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('erd.ddlImport.parsing')}
        </span>
      )}

      {!parsing && parseResult && (
        <>
          {parseResult.tables.length > 0 && (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3 w-3" />
              {t('erd.ddlImport.preview', {
                tables: parseResult.tables.length,
                relations: parseResult.relations.length,
              })}
            </span>
          )}

          {parseResult.errors.length > 0 && parseResult.tables.length > 0 && (
            <span className="flex items-center gap-1 text-erd-warning">
              <AlertTriangle className="h-3 w-3" />
              {t('erd.ddlImport.warnings', { count: parseResult.errors.length })}
            </span>
          )}

          {parseResult.tables.length === 0 && parseResult.errors.length > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="h-3 w-3" />
              {t('erd.ddlImport.parseError')}
            </span>
          )}
        </>
      )}

      {syncStatusMeta && (
        <span
          className={cn('flex items-center gap-1', syncStatusMeta.className)}
          aria-label={t('erd.sync.statusAria')}
        >
          <syncStatusMeta.Icon className={cn('h-3 w-3', syncStatusMeta.spin && 'animate-spin')} />
          {syncStatusMeta.label}
        </span>
      )}
    </div>
  );
});
