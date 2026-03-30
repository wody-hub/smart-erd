import { createContext, useContext } from 'react';

/** 대형 다이어그램 overview 모드에서 compact table 렌더링을 켜는 노드 수 기준 */
export const COMPACT_TABLE_RENDERING_NODE_LIMIT = 80;
/** overview 모드에서 관계가 없는 컬럼을 최소 몇 개까지만 노출할지의 기준 */
export const MAX_OVERVIEW_UNCONNECTED_COLUMNS = 1;

const CompactTableRenderingContext = createContext(false);

export function selectCompactOverviewColumns<T extends { id: string }>(
  columns: T[],
  connectedColumnIds: Set<string>,
): T[] {
  const connectedColumns = columns.filter((column) => connectedColumnIds.has(column.id));
  if (connectedColumns.length > 0) {
    return connectedColumns;
  }
  return columns.slice(0, MAX_OVERVIEW_UNCONNECTED_COLUMNS);
}

export function CompactTableRenderingProvider({
  compact,
  children,
}: {
  compact: boolean;
  children: React.ReactNode;
}) {
  return (
    <CompactTableRenderingContext.Provider value={compact}>
      {children}
    </CompactTableRenderingContext.Provider>
  );
}

export function useCompactTableRendering(): boolean {
  return useContext(CompactTableRenderingContext);
}
