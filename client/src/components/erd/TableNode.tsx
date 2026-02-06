import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TableNodeData } from '../../types/erd';

function TableNode({ id, data }: NodeProps) {
  const { label, columns } = data as TableNodeData;

  return (
    <div className="bg-white border border-gray-300 rounded shadow-md min-w-[200px]">
      <div className="bg-blue-600 text-white px-3 py-2 rounded-t font-semibold text-sm">
        {label}
      </div>
      <div className="divide-y divide-gray-200">
        {columns.map((col) => (
          <div key={col.id} className="relative px-3 py-1.5 text-xs flex items-center gap-2">
            <Handle
              type="target"
              position={Position.Left}
              id={`${id}-${col.id}-target`}
              className="!w-2 !h-2 !bg-gray-400 !border-gray-500"
            />
            <span className="text-yellow-600 font-bold w-4 text-center">
              {col.pk ? 'PK' : col.fk ? 'FK' : ''}
            </span>
            <span className="flex-1 font-mono">{col.name}</span>
            <span className="text-gray-400 font-mono">{col.type}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={`${id}-${col.id}-source`}
              className="!w-2 !h-2 !bg-gray-400 !border-gray-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(TableNode);
