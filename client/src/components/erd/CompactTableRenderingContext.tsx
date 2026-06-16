import { createContext, useContext } from 'react';

/** 대형 다이어그램 overview 모드에서 compact table 렌더링을 켜던 노드 수 기준 */
export const COMPACT_TABLE_RENDERING_NODE_LIMIT = 80;
/** overview 모드에서 관계가 없는 컬럼을 최소 몇 개까지만 노출할지의 기준 */
export const MAX_OVERVIEW_UNCONNECTED_COLUMNS = 0;
/** zoom이 이 값 이하면 compact overview를 유지하던 기준 */
export const COMPACT_TABLE_RENDERING_ZOOM_THRESHOLD = 0.8;
/** zoom이 이 값 이하면 더 공격적인 compact overview를 사용하던 기준 */
export const AGGRESSIVE_COMPACT_TABLE_RENDERING_ZOOM_THRESHOLD = 0.55;

export type CompactTableRenderingMode = 'off' | 'compact' | 'aggressive';

const CompactTableRenderingContext = createContext<CompactTableRenderingMode>('off');

export function resolveCompactTableRenderingMode(
  _nodeCount: number,
  _zoom: number,
): CompactTableRenderingMode {
  // Zoom/node-count 기반 compact table 렌더링은 가독성 이슈로 일시 비활성화한다.
  // if (nodeCount <= COMPACT_TABLE_RENDERING_NODE_LIMIT) {
  //   return 'off';
  // }
  // if (zoom <= AGGRESSIVE_COMPACT_TABLE_RENDERING_ZOOM_THRESHOLD) {
  //   return 'aggressive';
  // }
  // if (zoom <= COMPACT_TABLE_RENDERING_ZOOM_THRESHOLD) {
  //   return 'compact';
  // }
  return 'off';
}

export function resolveInteractiveCompactTableMode(
  baseMode: CompactTableRenderingMode,
  options: {
    selected: boolean;
    isEditing: boolean;
    fkMode: boolean;
    expanded: boolean;
  },
): CompactTableRenderingMode {
  if (
    baseMode === 'off' ||
    options.selected ||
    options.isEditing ||
    options.fkMode ||
    options.expanded
  ) {
    return 'off';
  }
  return baseMode;
}

export function resolvePreviewCompactTableMode(
  baseMode: CompactTableRenderingMode,
  options?: {
    override?: CompactTableRenderingMode;
    ghost?: boolean;
  },
): CompactTableRenderingMode {
  if (options?.ghost) {
    return 'off';
  }
  return options?.override ?? baseMode;
}

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
  mode,
  children,
}: {
  mode: CompactTableRenderingMode;
  children: React.ReactNode;
}) {
  return (
    <CompactTableRenderingContext.Provider value={mode}>
      {children}
    </CompactTableRenderingContext.Provider>
  );
}

export function useCompactTableRendering(): boolean {
  return useContext(CompactTableRenderingContext) !== 'off';
}

export function useCompactTableRenderingMode(): CompactTableRenderingMode {
  return useContext(CompactTableRenderingContext);
}
