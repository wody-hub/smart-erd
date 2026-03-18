import { useState, useEffect, useRef, useCallback } from 'react';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { TableNode, ERDEdge } from '@/types/erd';

/**
 * useCodeEditorRefresh 훅의 옵션.
 */
interface UseCodeEditorRefreshOptions {
  /**
   * ERD 노드/엣지를 코드 텍스트로 변환하는 생성 함수.
   *
   * @param nodes 테이블 노드 배열
   * @param edges 엣지 배열
   * @returns 생성된 코드 텍스트
   */
  generate: (nodes: TableNode[], edges: ERDEdge[]) => string;
  /** 생성된 코드를 에디터에 반영하는 핸들러 */
  onGenerated: (text: string) => void;
  /** 현재 에디터 텍스트 (Refresh 시 확인 다이얼로그 표시 판단용) */
  currentText: string;
  /** 초기화 가능 여부 (사전 데이터 로딩 등 선행 조건) */
  ready?: boolean;
  /** 초기 ERD -> 코드 자동 채우기를 건너뛸지 여부 */
  skipInitialRefresh?: boolean;
  /** 실제 Refresh 실행 직전 호출할 콜백 */
  beforeExecuteRefresh?: () => void;
}

/**
 * useCodeEditorRefresh 훅의 반환값.
 */
interface UseCodeEditorRefreshReturn {
  /** ERD → 코드 생성을 실행한다 */
  executeRefresh: () => void;
  /** Refresh 버튼 핸들러 (편집 내용이 있으면 확인 다이얼로그) */
  handleRefresh: () => void;
  /** ERD에 노드가 있는지 여부 */
  hasNodes: boolean;
  /** Refresh 확인 다이얼로그 열림 상태 */
  refreshConfirmOpen: boolean;
  /** Refresh 확인 다이얼로그 열림 상태 세터 */
  setRefreshConfirmOpen: (open: boolean) => void;
}

/**
 * 코드 에디터의 ERD → 코드 Refresh 로직을 공통화한다.
 *
 * SQL DDL 에디터와 논리명 DSL 에디터에서 동일하게 사용되는
 * Refresh 상태, 초기 코드 채우기, Refresh 핸들러를 추출한 훅이다.
 *
 * @param options 훅 옵션
 * @returns Refresh 관련 상태 및 핸들러
 */
export function useCodeEditorRefresh({
  generate,
  onGenerated,
  currentText,
  ready = true,
  skipInitialRefresh = false,
  beforeExecuteRefresh,
}: UseCodeEditorRefreshOptions): UseCodeEditorRefreshReturn {
  /** Refresh 확인 다이얼로그 열림 상태 */
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);

  /** 초기 코드 채우기 완료 여부 */
  const initializedRef = useRef(false);

  /** ERD → 코드 생성을 실행한다 */
  const executeRefresh = useCallback(() => {
    beforeExecuteRefresh?.();
    const nodes = useCanvasStore.getState().nodes as TableNode[];
    const edges = useCanvasStore.getState().edges as ERDEdge[];
    const generated = generate(nodes, edges);
    onGenerated(generated);
  }, [beforeExecuteRefresh, generate, onGenerated]);

  /** Refresh 버튼 핸들러 (편집 내용이 있으면 확인 다이얼로그) */
  const handleRefresh = useCallback(() => {
    if (currentText.trim()) {
      setRefreshConfirmOpen(true);
    } else {
      executeRefresh();
    }
  }, [currentText, executeRefresh]);

  /** ERD에 노드가 있는지 여부 */
  const hasNodes = useCanvasStore((s) => s.nodes.length > 0);

  // 마운트 시 ERD → 코드 초기 채우기 (1회)
  useEffect(() => {
    if (skipInitialRefresh) {
      initializedRef.current = true;
      return;
    }
    if (!initializedRef.current && ready) {
      initializedRef.current = true;
      const nodes = useCanvasStore.getState().nodes as TableNode[];
      if (nodes.length > 0) {
        executeRefresh();
      }
    }
  }, [executeRefresh, ready, skipInitialRefresh]);

  return {
    executeRefresh,
    handleRefresh,
    hasNodes,
    refreshConfirmOpen,
    setRefreshConfirmOpen,
  };
}
