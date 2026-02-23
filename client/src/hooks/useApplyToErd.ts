import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useCanvasStore from '@/stores/useCanvasStore';
import { applyDagreLayout } from '@/lib/auto-layout';
import type { DdlParseResult } from '@/lib/ddl-parser';

/** useApplyToErd 훅 옵션 */
interface UseApplyToErdOptions {
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** 파싱 결과 (null이면 Apply 불가) */
  parseResult: DdlParseResult | null;
  /** 파싱 중 여부 */
  parsing: boolean;
}

/** useApplyToErd 훅 반환 타입 */
interface UseApplyToErdReturn {
  /** Apply 버튼 클릭 핸들러 (기존 테이블이 있으면 확인 다이얼로그 표시) */
  handleApply: () => void;
  /** 파싱 결과를 ERD에 즉시 반영한다 (확인 다이얼로그에서 호출) */
  executeApply: () => void;
  /** 교체 확인 다이얼로그 열림 상태 */
  confirmOpen: boolean;
  /** 교체 확인 다이얼로그 열림 상태 변경 함수 */
  setConfirmOpen: (open: boolean) => void;
  /** Apply 버튼 활성화 여부 */
  canApply: boolean;
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
}: UseApplyToErdOptions): UseApplyToErdReturn {
  const { t } = useTranslation();

  const replaceFromDdl = useCanvasStore((s) => s.replaceFromDdl);
  const applyLayout = useCanvasStore((s) => s.applyLayout);
  const nodes = useCanvasStore((s) => s.nodes);

  /** 교체 확인 다이얼로그 열림 상태 */
  const [confirmOpen, setConfirmOpen] = useState(false);

  /** Apply 버튼 활성화 여부 */
  const canApply = canEdit && parseResult != null && parseResult.tables.length > 0 && !parsing;

  /**
   * 파싱 결과를 ERD에 즉시 반영한다.
   *
   * replaceFromDdl → dagre 자동 배치 → toast 알림.
   */
  const executeApply = useCallback(() => {
    if (!parseResult) {
      return;
    }
    try {
      replaceFromDdl(parseResult);
      const freshNodes = useCanvasStore.getState().nodes;
      const freshEdges = useCanvasStore.getState().edges;
      if (freshNodes.length > 0) {
        const layoutedNodes = applyDagreLayout(freshNodes, freshEdges);
        applyLayout(layoutedNodes);
      }
      toast.success(t('erd.codeEditor.success', { count: parseResult.tables.length }));
    } catch {
      toast.error(t('erd.codeEditor.failed'));
    }
    setConfirmOpen(false);
  }, [parseResult, replaceFromDdl, applyLayout, t]);

  /**
   * Apply 버튼 클릭 핸들러.
   *
   * 기존 테이블이 있으면 확인 다이얼로그를 표시하고, 없으면 즉시 적용한다.
   */
  const handleApply = useCallback(() => {
    if (!parseResult || parseResult.tables.length === 0) {
      return;
    }
    if (nodes.length > 0) {
      setConfirmOpen(true);
    } else {
      executeApply();
    }
  }, [parseResult, nodes.length, executeApply]);

  return {
    handleApply,
    executeApply,
    confirmOpen,
    setConfirmOpen,
    canApply,
  };
}
