import { useState, useEffect, useRef, useCallback } from 'react';
import type { CodeEditorRefreshConfirmReason } from '@/lib/code-editor-draft-policy';
/**
 * useCodeEditorRefresh 훅의 옵션.
 */
interface UseCodeEditorRefreshOptions {
  /** 현재 persisted ERD 기준으로 코드 텍스트를 생성한다 */
  generateFromErd: () => string;
  /** 생성된 코드를 에디터에 반영하는 핸들러 */
  onGenerated: (text: string) => void;
  /** 현재 persisted ERD에 노드가 있는지 여부 */
  hasNodes: boolean;
  /** 현재 로컬 draft refresh 확인 사유 */
  refreshConfirmReason: CodeEditorRefreshConfirmReason | null;
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
  generateFromErd,
  onGenerated,
  hasNodes,
  refreshConfirmReason,
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
    onGenerated(generateFromErd());
  }, [beforeExecuteRefresh, generateFromErd, onGenerated]);

  /** Refresh 버튼 핸들러 (편집 내용이 있으면 확인 다이얼로그) */
  const handleRefresh = useCallback(() => {
    if (refreshConfirmReason != null) {
      setRefreshConfirmOpen(true);
    } else {
      executeRefresh();
    }
  }, [executeRefresh, refreshConfirmReason]);

  // 마운트 시 ERD → 코드 초기 채우기 (1회)
  useEffect(() => {
    if (skipInitialRefresh) {
      initializedRef.current = true;
      return;
    }
    if (!initializedRef.current && ready) {
      initializedRef.current = true;
      if (hasNodes) {
        executeRefresh();
      }
    }
  }, [executeRefresh, hasNodes, ready, skipInitialRefresh]);

  return {
    executeRefresh,
    handleRefresh,
    hasNodes,
    refreshConfirmOpen,
    setRefreshConfirmOpen,
  };
}
