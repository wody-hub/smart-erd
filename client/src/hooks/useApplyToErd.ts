import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Edge, Node } from '@xyflow/react';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import useAuthStore from '@/stores/useAuthStore';
import { applyDagreLayout, applyIncrementalLayoutByLabel } from '@/lib/auto-layout';
import type { DdlParseResult } from '@/lib/ddl-parser';
import { buildErdTableDiffPlan } from '@/lib/erd-diff-builder';
import { buildScopedDiffPlan } from '@/lib/erd-scoped-diff-builder';
import { buildFallbackGroupAssignments } from '@/lib/erd-fallback-group-remap';
import { loadDiffApplyLocalOverride, resolveDiffApplyRollout } from '@/lib/diff-apply-rollout';
import {
  createCurrentSnapshots,
  type DiffParsedRelation,
  type DiffParsedTable,
  type TableDiff,
} from '@/lib/erd-diff-plan';
import type { ERDEdge, TableGroup, TableNode, TableNodeData } from '@/types/erd';
import {
  getAutoApplyBlockReason,
  LARGE_DIAGRAM_WARNING_THRESHOLD,
  loadSyncPolicy,
  resolveLayoutMode,
  type SyncPolicy,
  type SyncPolicyScope,
} from '@/lib/sync-policy';
import { shouldOpenApplyConfirm } from '@/lib/code-sync-apply-gate';

/** useApplyToErd 훅 옵션 */
interface UseApplyToErdOptions {
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** 파싱 결과 (null이면 Apply 불가) */
  parseResult: DdlParseResult | null;
  /** 파싱 중 여부 */
  parsing: boolean;
  /** 다이어그램 단위 정책 스코프 */
  policyScope?: SyncPolicyScope;
  /** 구조 변경 차단 여부 */
  hasBlockingStructureLocks?: boolean;
  /** 수동 ERD 적용 직전 실행할 사전 검증 */
  beforeManualApply?: () => boolean;
  /** 수동 ERD 적용을 실제 실행하기 직전 수행할 후처리 */
  beforeExecuteManualApply?: () => void;
  /** 수동 ERD 적용 성공 직후 실행할 후처리 */
  onManualApplySuccess?: () => void;
}

/** useApplyToErd 훅 반환 타입 */
interface UseApplyToErdReturn {
  /** Apply 버튼 클릭 핸들러 (기존 테이블이 있으면 확인 다이얼로그 표시) */
  handleApply: () => void;
  /** 파싱 결과를 ERD에 즉시 반영한다 (확인 다이얼로그에서 호출) */
  executeApply: () => void;
  /** 코드 자동 동기화 경로에서 파싱 결과를 ERD에 반영한다 (차단 시 false) */
  applyParsedToErd: () => boolean;
  /** 교체 확인 다이얼로그 열림 상태 */
  confirmOpen: boolean;
  /** 교체 확인 다이얼로그 열림 상태 변경 함수 */
  setConfirmOpen: (open: boolean) => void;
  /** 교체 확인 다이얼로그 설명 문구 */
  confirmDescription: string;
  /** Apply 버튼 활성화 여부 */
  canApply: boolean;
}

type ApplySource = 'manual' | 'auto';
type ApplyPath = 'diff' | 'full-replace' | 'full-replace-fallback';

/** logApplyMetrics 파라미터 */
interface ApplyMetricsParams {
  source: ApplySource;
  diffPhase: DiffPhaseResult;
  layoutPhase: LayoutPhaseResult;
  syncPolicy: SyncPolicy;
  diffApplyRollout: ReturnType<typeof resolveDiffApplyRollout>;
  replaceDurationMs: number;
  totalDurationMs: number;
}

/**
 * ERD Apply 파이프라인 실행 메트릭을 콘솔에 로깅한다.
 *
 * @param params 메트릭 로깅에 필요한 파라미터
 */
function logApplyMetrics(params: ApplyMetricsParams): void {
  console.info('[erd-sync-metrics]', {
    source: params.source,
    applyPath: params.diffPhase.applyPath,
    nodeCount: params.layoutPhase.freshNodes.length,
    edgeCount: params.layoutPhase.freshEdges.length,
    policyLayoutMode: params.syncPolicy.layoutMode,
    effectiveLayoutMode: params.layoutPhase.effectiveLayoutMode,
    largeDiagramThreshold: params.syncPolicy.largeDiagramThreshold,
    rollout: {
      mode: params.diffApplyRollout.mode,
      enabled: params.diffApplyRollout.enabled,
      reason: params.diffApplyRollout.reason,
      bucket: params.diffApplyRollout.bucket ?? null,
      betaPercent: params.diffApplyRollout.betaPercent ?? null,
    },
    diff: {
      appliedOperations: params.diffPhase.diffAppliedOperations,
      skippedOperations: params.diffPhase.diffSkippedOperations,
      groupDroppedCount: params.diffPhase.groupDroppedCount,
    },
    metrics: {
      replaceMs: Math.round(params.replaceDurationMs),
      layoutMs: Math.round(params.layoutPhase.layoutDurationMs),
      applyTotalMs: Math.round(params.totalDurationMs),
    },
  });
}

interface DiffPhaseResult {
  applyPath: ApplyPath;
  diffAppliedOperations: number;
  diffSkippedOperations: number;
  groupDroppedCount: number;
}

interface LayoutPhaseResult {
  freshNodes: Node<TableNodeData>[];
  freshEdges: Edge[];
  effectiveLayoutMode: SyncPolicy['layoutMode'];
  layoutDurationMs: number;
}

interface ExecuteDiffPhaseParams {
  diffApplyEnabled: boolean;
  source: ApplySource;
  beforeNodes: TableNode[];
  beforeEdges: ERDEdge[];
  beforeGroups: TableGroup[];
  parseResult: DdlParseResult;
  replaceFromDdl: (result: DdlParseResult) => void;
  applyDiffPlan: ReturnType<typeof useCanvasStore.getState>['applyDiffPlan'];
  updateGroupTables: ReturnType<typeof useCanvasStore.getState>['updateGroupTables'];
  getCurrentNodes: () => TableNode[];
  onFallback: (droppedCount: number, error: unknown) => void;
}

/**
 * Diff 적용 경로를 실행하고, 실패 시 Full Replace 폴백까지 처리한다.
 *
 * @param params 실행 파라미터
 * @returns 적용 경로/디프 통계 결과
 */
function executeDiffPhase(params: ExecuteDiffPhaseParams): DiffPhaseResult {
  if (!params.diffApplyEnabled) {
    params.replaceFromDdl(params.parseResult);
    return {
      applyPath: 'full-replace',
      diffAppliedOperations: 0,
      diffSkippedOperations: 0,
      groupDroppedCount: 0,
    };
  }

  let diffTableDiffs: TableDiff[] = [];
  try {
    const currentSnapshots = createCurrentSnapshots(params.beforeNodes, params.beforeEdges);
    const nextTables = toDiffParsedTables(params.parseResult);
    const nextRelations = toDiffParsedRelations(params.parseResult);
    const scopedDiffResult = buildScopedDiffPlan(
      currentSnapshots.tables,
      Object.values(currentSnapshots.edgeById),
      nextTables,
      nextRelations,
    );
    const diffPlan =
      scopedDiffResult?.safe === true
        ? scopedDiffResult.plan
        : buildErdTableDiffPlan({
            currentTables: currentSnapshots.tables,
            currentEdges: Object.values(currentSnapshots.edgeById),
            nextTables,
            nextRelations,
          });
    diffTableDiffs = diffPlan.tables;
    const diffResult = params.applyDiffPlan(diffPlan);
    if (!diffResult) {
      throw new Error('applyDiffPlan unavailable');
    }
    return {
      applyPath: 'diff',
      diffAppliedOperations: diffResult.appliedOperations,
      diffSkippedOperations: diffResult.skippedOperations,
      groupDroppedCount: diffResult.groupRemap.droppedCount,
    };
  } catch (error) {
    params.replaceFromDdl(params.parseResult);
    const replacedNodes = params.getCurrentNodes();
    const assignments = buildFallbackGroupAssignments(
      params.beforeGroups,
      diffTableDiffs,
      replacedNodes,
    );
    for (const assignment of assignments) {
      params.updateGroupTables(assignment.groupId, assignment.tableIds, []);
    }
    const droppedCount = assignments.reduce((sum, item) => sum + item.droppedCount, 0);
    params.onFallback(droppedCount, error);
    return {
      applyPath: 'full-replace-fallback',
      diffAppliedOperations: 0,
      diffSkippedOperations: 0,
      groupDroppedCount: droppedCount,
    };
  }
}

interface ExecuteLayoutPhaseParams {
  source: ApplySource;
  beforeNodes: Node<TableNodeData>[];
  estimatedNodeCount: number;
  syncPolicy: SyncPolicy;
  applyPath: ApplyPath;
  diffAppliedOperations: number;
  applyLayout: ReturnType<typeof useCanvasStore.getState>['applyLayout'];
  getCurrentState: () => { nodes: Node<TableNodeData>[]; edges: Edge[] };
}

/**
 * 정책과 변경량을 기반으로 레이아웃 단계를 수행한다.
 *
 * @param params 실행 파라미터
 * @returns 레이아웃 결과와 최신 노드/엣지
 */
function executeLayoutPhase(params: ExecuteLayoutPhaseParams): LayoutPhaseResult {
  const { nodes: freshNodes, edges: freshEdges } = params.getCurrentState();
  const shouldRunLayout = params.applyPath !== 'diff' || params.diffAppliedOperations > 0;
  const preserveExistingDiagram = params.beforeNodes.length > 0;
  const effectiveLayoutMode = preserveExistingDiagram
    ? 'none'
    : shouldRunLayout
    ? resolveLayoutMode(
        params.syncPolicy.layoutMode,
        Math.max(params.estimatedNodeCount, freshNodes.length),
        params.syncPolicy.largeDiagramThreshold,
      )
    : 'none';

  let layoutDurationMs = 0;
  if (freshNodes.length > 0 && shouldRunLayout) {
    const layoutStart = performance.now();
    if (effectiveLayoutMode === 'full') {
      const layoutedNodes = applyDagreLayout(freshNodes, freshEdges);
      params.applyLayout(layoutedNodes);
    } else if (effectiveLayoutMode === 'incremental') {
      const layoutedNodes = applyIncrementalLayoutByLabel(params.beforeNodes, freshNodes);
      params.applyLayout(layoutedNodes);
    }
    layoutDurationMs = performance.now() - layoutStart;
  }

  return {
    freshNodes,
    freshEdges,
    effectiveLayoutMode,
    layoutDurationMs,
  };
}

/**
 * DDL/DSL 파싱 결과를 ERD 캔버스에 반영하는 공통 훅.
 *
 * replaceFromDdl → dagre 레이아웃 → toast 알림 흐름을 캡슐화하여
 * SqlDdlEditor와 DslCodeEditorPanel에서 중복 없이 재사용한다.
 *
 * @param options.canEdit     편집 가능 여부
 * @param options.parseResult 파싱 결과
 * @param options.parsing     파싱 중 여부
 * @returns Apply 관련 상태 및 핸들러
 */
export function useApplyToErd({
  canEdit,
  parseResult,
  parsing,
  policyScope = {},
  hasBlockingStructureLocks = false,
  beforeManualApply,
  beforeExecuteManualApply,
  onManualApplySuccess,
}: UseApplyToErdOptions): UseApplyToErdReturn {
  const { t } = useTranslation();
  const { teamId, projectId, diagramId } = policyScope;
  const loginId = useAuthStore((s) => s.loginId);

  const replaceFromDdl = useCanvasStore((s) => s.replaceFromDdl);
  const applyDiffPlan = useCanvasStore((s) => s.applyDiffPlan);
  const applyLayout = useCanvasStore((s) => s.applyLayout);
  const updateGroupTables = useCanvasStore((s) => s.updateGroupTables);
  const nodes = useCanvasStore((s) => s.nodes);

  /** 교체 확인 다이얼로그 열림 상태 */
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** 다이어그램별 동기화 정책 */
  const syncPolicy = useMemo(
    () => loadSyncPolicy({ teamId, projectId, diagramId }),
    [diagramId, projectId, teamId],
  );
  /** Diff Apply rollout 판정 */
  const diffApplyRollout = useMemo(
    () =>
      resolveDiffApplyRollout({
        mode: import.meta.env.VITE_ERD_DIFF_APPLY_MODE,
        betaPercent: import.meta.env.VITE_ERD_DIFF_APPLY_BETA_PERCENT,
        internalIds: import.meta.env.VITE_ERD_DIFF_APPLY_INTERNAL_IDS,
        teamId,
        projectId,
        diagramId,
        loginId,
        localOverride: loadDiffApplyLocalOverride(),
      }),
    [diagramId, loginId, projectId, teamId],
  );
  /** 현재 또는 반영 예정 노드 수 */
  const projectedNodeCount = Math.max(nodes.length, parseResult?.tables.length ?? 0);
  /** 대형 다이어그램 여부 */
  const isLargeDiagram = projectedNodeCount >= syncPolicy.largeDiagramThreshold;
  /** 반영 가능한 파싱 결과인지 여부 (빈 스키마 포함) */
  const hasApplicableParseResult =
    parseResult != null && !(parseResult.tables.length === 0 && parseResult.errors.length > 0);

  /** Apply 버튼 활성화 여부 */
  const canApply = canEdit && hasApplicableParseResult && !parsing;
  /** 교체 확인 다이얼로그 설명 문구 */
  const confirmDescription = isLargeDiagram
    ? t('erd.codeEditor.confirmDescriptionLarge', {
        count: projectedNodeCount,
        threshold: syncPolicy.largeDiagramThreshold,
      })
    : t('erd.codeEditor.confirmDescription');

  /**
   * 파싱 결과를 ERD에 반영한다.
   *
   * @param source 반영 트리거 출처 (수동/자동)
   * @returns 반영 성공 여부
   */
  const runApply = useCallback(
    (source: ApplySource): boolean => {
      if (!parseResult || (parseResult.tables.length === 0 && parseResult.errors.length > 0)) {
        return false;
      }
      const beforeState = useCanvasStore.getState();
      const beforeNodes = beforeState.nodes as TableNode[];
      const beforeEdges = beforeState.edges as ERDEdge[];
      const beforeGroups = beforeState.groups as TableGroup[];
      const beforeLayoutNodes = beforeState.nodes as Node<TableNodeData>[];
      const estimatedNodeCount = Math.max(beforeNodes.length, parseResult.tables.length);

      if (hasBlockingStructureLocks) {
        if (source === 'manual') {
          toast.info(t('erd.edge.structureBlockedApply'));
        }
        return false;
      }

      if (source === 'manual' && beforeManualApply && !beforeManualApply()) {
        return false;
      }

      if (source === 'auto') {
        const blockReason = getAutoApplyBlockReason(syncPolicy, estimatedNodeCount);
        if (blockReason) {
          return false;
        }
      }

      const totalStart = performance.now();

      try {
        const replaceStart = performance.now();
        const diffPhase = executeDiffPhase({
          diffApplyEnabled: diffApplyRollout.enabled,
          source,
          beforeNodes,
          beforeEdges,
          beforeGroups,
          parseResult,
          replaceFromDdl,
          applyDiffPlan,
          updateGroupTables,
          getCurrentNodes: () => useCanvasStore.getState().nodes as TableNode[],
          onFallback: (droppedCount, error) => {
            if (source === 'manual') {
              toast.info(t('erd.codeEditor.diffFallbackApplied', { dropped: droppedCount }));
            }
            console.warn('[erd-sync-metrics] diff-apply-fallback', error);
          },
        });
        const replaceDurationMs = performance.now() - replaceStart;

        const layoutPhase = executeLayoutPhase({
          source,
          beforeNodes: beforeLayoutNodes,
          estimatedNodeCount,
          syncPolicy,
          applyPath: diffPhase.applyPath,
          diffAppliedOperations: diffPhase.diffAppliedOperations,
          applyLayout,
          getCurrentState: () => {
            const state = useCanvasStore.getState();
            return {
              nodes: state.nodes as Node<TableNodeData>[],
              edges: state.edges as Edge[],
            };
          },
        });

        const totalDurationMs = performance.now() - totalStart;
        logApplyMetrics({
          source,
          diffPhase,
          layoutPhase,
          syncPolicy,
          diffApplyRollout,
          replaceDurationMs,
          totalDurationMs,
        });

        if (source === 'manual') {
          onManualApplySuccess?.();
          toast.success(t('erd.codeEditor.success', { count: parseResult.tables.length }));
        }
        return true;
      } catch (err) {
        console.error('[erd-sync-metrics] apply-failed', err);
        if (source === 'manual') {
          toast.error(t('erd.codeEditor.failed'));
        }
        return false;
      }
    },
    [
      applyDiffPlan,
      applyLayout,
      diffApplyRollout,
      parseResult,
      replaceFromDdl,
      syncPolicy,
      hasBlockingStructureLocks,
      beforeManualApply,
      onManualApplySuccess,
      t,
      updateGroupTables,
    ],
  );

  /**
   * 파싱 결과를 수동으로 ERD에 즉시 반영한다.
   *
   * replaceFromDdl + 정책 기반 레이아웃 분기를 수행하고 성공 토스트를 표시한다.
   */
  const executeApply = useCallback(() => {
    if (!parseResult) {
      return;
    }
    beforeExecuteManualApply?.();
    runApply('manual');
    setConfirmOpen(false);
  }, [beforeExecuteManualApply, parseResult, runApply]);

  /**
   * 파싱 결과를 코드 자동 동기화 경로에서 ERD에 반영한다.
   *
   * @returns 반영 성공 여부 (차단 시 false)
   */
  const applyParsedToErd = useCallback(() => runApply('auto'), [runApply]);

  /**
   * Apply 버튼 클릭 핸들러.
   *
   * 기존 테이블이 있으면 확인 다이얼로그를 표시하고, 없으면 즉시 적용한다.
   */
  const handleApply = useCallback(() => {
    if (!parseResult || (parseResult.tables.length === 0 && parseResult.errors.length > 0)) {
      return;
    }
    if (projectedNodeCount >= LARGE_DIAGRAM_WARNING_THRESHOLD) {
      toast.info(
        t('erd.codeEditor.largeDiagramWarning', {
          count: projectedNodeCount,
          threshold: syncPolicy.largeDiagramThreshold,
        }),
      );
    }
    if (shouldOpenApplyConfirm(nodes.length, isLargeDiagram)) {
      setConfirmOpen(true);
    } else {
      executeApply();
    }
  }, [executeApply, isLargeDiagram, nodes.length, parseResult, projectedNodeCount, syncPolicy, t]);

  return {
    handleApply,
    executeApply,
    applyParsedToErd,
    confirmOpen,
    setConfirmOpen,
    confirmDescription,
    canApply,
  };
}

/**
 * DDL 파싱 결과 테이블을 DiffPlan 입력 스냅샷으로 변환한다.
 *
 * @param result DDL 파싱 결과
 * @returns DiffPlan 비교용 테이블 배열
 */
function toDiffParsedTables(result: DdlParseResult): DiffParsedTable[] {
  return result.tables.map((table) => ({
    name: table.name,
    logicalTableName: table.logicalTableName || table.comment || undefined,
    tableTermId: table.tableTermId,
    columns: table.columns.map((column) => ({
      name: column.name,
      type: column.type,
      pk: column.pk,
      nullable: column.nullable,
      autoIncrement: column.autoIncrement,
      logicalName: column.logicalName || column.comment || undefined,
      termId: column.termId,
      domainId: column.domainId,
    })),
  }));
}

/**
 * DDL 파싱 결과 관계를 DiffPlan 입력 스냅샷으로 변환한다.
 *
 * @param result DDL 파싱 결과
 * @returns DiffPlan 비교용 관계 배열
 */
function toDiffParsedRelations(result: DdlParseResult): DiffParsedRelation[] {
  return result.relations.map((relation) => ({
    parentTable: relation.parentTable,
    parentColumn: relation.parentColumn,
    childTable: relation.childTable,
    childColumn: relation.childColumn,
  }));
}
