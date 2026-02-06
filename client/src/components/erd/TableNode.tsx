import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TableNode as TableNodeType } from '../../types/erd';

/**
 * ERD 테이블 커스텀 노드 컴포넌트.
 *
 * 테이블 헤더(이름)와 컬럼 목록을 렌더링하며, 각 컬럼에 PK/FK 뱃지와
 * 좌우 Handle(source/target)을 배치하여 컬럼 레벨의 관계 연결을 지원한다.
 *
 * Handle ID 규칙: `{nodeId}-{colId}-source` / `{nodeId}-{colId}-target`
 *
 * @param props React Flow NodeProps (id, data)
 */
function TableNode({ id, data }: NodeProps<TableNodeType>) {
  const { label, columns } = data;

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
