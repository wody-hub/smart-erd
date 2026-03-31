import { createContext, useContext } from 'react';
import type { CodeEditorTableRevealRequest } from '@/lib/code-editor-table-navigation';

interface DiagramCodeNavigationContextValue {
  /** 테이블 -> 코드 이동 가능 여부 */
  canNavigateToCode: boolean;
  /** 테이블 -> 코드 이동 핸들러 */
  navigateToCode?: (request: CodeEditorTableRevealRequest) => void;
}

const DiagramCodeNavigationContext = createContext<DiagramCodeNavigationContextValue>({
  canNavigateToCode: false,
});

/**
 * 다이어그램 코드 네비게이션 컨텍스트 provider.
 */
export const DiagramCodeNavigationProvider = DiagramCodeNavigationContext.Provider;

/**
 * 테이블 -> 코드 이동 컨텍스트를 반환한다.
 *
 * @returns 코드 네비게이션 컨텍스트
 */
export function useDiagramCodeNavigation(): DiagramCodeNavigationContextValue {
  return useContext(DiagramCodeNavigationContext);
}
