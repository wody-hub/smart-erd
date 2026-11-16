import type { TableHandleLayout } from '@/types/erd';
import { buildColumnHandleId, buildLegacyColumnHandleId } from '@/lib/handle-id';
import { getColumnHandlePlacements } from './columnHandleLayout';

export type TableNodeHandleRenderMode = 'editable' | 'static';

export interface ColumnHandleRenderStateInput {
  mode: TableNodeHandleRenderMode;
  fkMode: boolean;
  connected?: boolean;
  sourceConnected?: boolean;
  targetConnected?: boolean;
}

export interface TableNodeHandleSignatureRow extends Omit<
  ColumnHandleRenderStateInput,
  'mode' | 'fkMode'
> {
  columnId: string;
}

export interface TableNodeHandleSignatureInput {
  nodeId: string;
  rows: TableNodeHandleSignatureRow[];
  mode: TableNodeHandleRenderMode;
  fkMode: boolean;
  handleLayout: TableHandleLayout;
}

/** 행 렌더러와 노드 내부 핸들 갱신 서명이 공유하는 핸들 표시 조건. */
export function getColumnHandleRenderState({
  mode,
  fkMode,
  connected = false,
  sourceConnected = false,
  targetConnected = false,
}: ColumnHandleRenderStateInput) {
  if (mode === 'editable') {
    const showHandles = fkMode || connected;
    return { source: showHandles, target: showHandles };
  }

  return {
    source: fkMode || sourceConnected,
    target: fkMode || targetConnected,
  };
}

/** 현재 실제 렌더될 컬럼 핸들 ID를 직렬화해 내부 좌표 재측정 입력을 만든다. */
export function getTableNodeHandleRenderSignature({
  nodeId,
  rows,
  mode,
  fkMode,
  handleLayout,
}: TableNodeHandleSignatureInput): string {
  const handleIds: string[] = [];

  for (const row of rows) {
    const { source, target } = getColumnHandleRenderState({ ...row, mode, fkMode });
    for (const [handleType, visible] of [
      ['target', target],
      ['source', source],
    ] as const) {
      if (!visible) continue;

      const placements = getColumnHandlePlacements(handleLayout, handleType);
      const legacySide = handleType === 'source' ? 'right' : 'left';
      const legacyPlacement =
        placements.find((placement) => placement.side === legacySide) ?? placements[0];

      if (legacyPlacement) {
        handleIds.push(buildLegacyColumnHandleId(nodeId, row.columnId, handleType));
      }
      for (const placement of placements) {
        handleIds.push(buildColumnHandleId(nodeId, row.columnId, handleType, placement.side));
      }
    }
  }

  return handleIds.join('\u0000');
}
