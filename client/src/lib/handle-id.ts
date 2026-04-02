export type ColumnHandleType = 'source' | 'target';
export type ColumnHandleSide = 'left' | 'right';

const HANDLE_SUFFIX_RE = /-(?:source|target)(?:-(?:left|right))?$/;

export function buildColumnHandleId(
  nodeId: string,
  colId: string,
  handleType: ColumnHandleType,
  side: ColumnHandleSide,
): string {
  return `${nodeId}-${colId}-${handleType}-${side}`;
}

export function buildLegacyColumnHandleId(
  nodeId: string,
  colId: string,
  handleType: ColumnHandleType,
): string {
  return `${nodeId}-${colId}-${handleType}`;
}

export function extractColId(handleId: string, nodeId: string): string {
  return handleId.replace(`${nodeId}-`, '').replace(HANDLE_SUFFIX_RE, '');
}

export function extractHandleSide(handleId: string): ColumnHandleSide | null {
  if (handleId.endsWith('-left')) {
    return 'left';
  }
  if (handleId.endsWith('-right')) {
    return 'right';
  }
  return null;
}
