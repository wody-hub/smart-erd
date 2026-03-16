import { Position, type HandleType } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { TableHandleLayout } from '@/types/erd';
import { getAllowedHandleSides } from '@/lib/edge-handles';
import type { ColumnHandleSide } from '@/lib/handle-id';

interface ColumnHandlePlacement {
  side: ColumnHandleSide;
  position: Position;
  style?: CSSProperties;
}

export function getColumnHandlePlacements(
  layout: TableHandleLayout,
  handleType: HandleType,
): ColumnHandlePlacement[] {
  if (layout === 'split') {
    return [
      {
        side: 'left',
        position: Position.Left,
        style: handleType === 'source' ? { top: '62%' } : undefined,
      },
      {
        side: 'right',
        position: Position.Right,
        style: handleType === 'target' ? { top: '38%' } : undefined,
      },
    ];
  }

  return getAllowedHandleSides(layout).map((side) => ({
    side,
    position: side === 'left' ? Position.Left : Position.Right,
    style: {
      top: handleType === 'target' ? '38%' : '62%',
    },
  }));
}
