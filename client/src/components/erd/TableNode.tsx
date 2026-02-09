import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Plus, X } from 'lucide-react';
import type { TableNode as TableNodeType } from '@/types/erd';
import useCanvasStore from '@/stores/useCanvasStore';
import { useInlineEdit } from '@/hooks/useInlineEdit';

/**
 * ERD 테이블 커스텀 노드 컴포넌트.
 *
 * 테이블 헤더(이름)와 컬럼 목록을 렌더링하며, 각 컬럼에 PK/FK 뱃지와
 * 좌우 Handle(source/target)을 배치하여 컬럼 레벨의 관계 연결을 지원한다.
 * 인라인 편집을 통해 테이블명, 컬럼명, 타입, PK/FK/nullable을 변경할 수 있다.
 *
 * Handle ID 규칙: `{nodeId}-{colId}-source` / `{nodeId}-{colId}-target`
 *
 * @param props.id   React Flow 노드 ID
 * @param props.data 테이블 데이터 (label, columns)
 */
function TableNode({ id, data }: NodeProps<TableNodeType>) {
  const { label, columns } = data;
  const renameTable = useCanvasStore((s) => s.renameTable);
  const addColumn = useCanvasStore((s) => s.addColumn);
  const deleteColumn = useCanvasStore((s) => s.deleteColumn);
  const updateColumn = useCanvasStore((s) => s.updateColumn);

  /** 테이블 이름 변경 핸들러. @param value 새 테이블 이름 */
  const handleRename = (value: string) => renameTable(id, value);

  const { editing, value, setValue, startEdit, confirmEdit, cancelEdit } =
    useInlineEdit(handleRename);

  return (
    <div className="bg-card border border-border rounded shadow-md min-w-[200px]">
      {/* Table header */}
      {editing ? (
        <div className="bg-erd-table-header px-3 py-2 rounded-t">
          <input
            className="nodrag bg-transparent text-erd-table-header-foreground font-semibold text-sm w-full outline-none placeholder-erd-table-header-foreground/50"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={confirmEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            autoFocus
            aria-label="Table name"
          />
        </div>
      ) : (
        <div
          className="bg-erd-table-header text-erd-table-header-foreground px-3 py-2 rounded-t font-semibold text-sm cursor-pointer select-none"
          onDoubleClick={() => startEdit(label)}
        >
          {label}
        </div>
      )}

      {/* Columns */}
      <div className="divide-y divide-border">
        {columns.map((col) => (
          <div
            key={col.id}
            className="relative px-3 py-1.5 text-xs flex items-center gap-1 group/col"
          >
            <Handle
              type="target"
              position={Position.Left}
              id={`${id}-${col.id}-target`}
              className="!w-2 !h-2 !bg-erd-handle !border-erd-handle-border"
            />

            {/* PK toggle */}
            <button
              className={`nodrag w-5 text-center font-bold text-[10px] cursor-pointer ${col.pk ? 'text-erd-pk' : 'text-muted-foreground/40 hover:text-erd-pk/80'}`}
              onClick={() => updateColumn(id, col.id, { pk: !col.pk })}
              title="Toggle PK"
              aria-label={`Toggle primary key for ${col.name}`}
            >
              PK
            </button>

            {/* FK toggle */}
            <button
              className={`nodrag w-5 text-center font-bold text-[10px] cursor-pointer ${col.fk ? 'text-erd-fk' : 'text-muted-foreground/40 hover:text-erd-fk/80'}`}
              onClick={() => updateColumn(id, col.id, { fk: !col.fk })}
              title="Toggle FK"
              aria-label={`Toggle foreign key for ${col.name}`}
            >
              FK
            </button>

            {/* Column name */}
            <input
              className="nodrag flex-1 font-mono bg-transparent outline-none hover:bg-accent focus:bg-accent px-1 rounded min-w-0"
              value={col.name}
              onChange={(e) => updateColumn(id, col.id, { name: e.target.value })}
              aria-label="Column name"
            />

            {/* Column type */}
            <input
              className="nodrag w-24 font-mono text-muted-foreground bg-transparent outline-none hover:bg-accent focus:bg-accent px-1 rounded text-right"
              value={col.type}
              onChange={(e) => updateColumn(id, col.id, { type: e.target.value })}
              aria-label="Column type"
            />

            {/* Nullable toggle */}
            <button
              className={`nodrag text-[10px] cursor-pointer w-4 text-center ${col.nullable ? 'text-erd-nullable' : 'text-muted-foreground/40 hover:text-erd-nullable/80'}`}
              onClick={() => updateColumn(id, col.id, { nullable: !col.nullable })}
              title="Toggle nullable"
              aria-label={`Toggle nullable for ${col.name}`}
            >
              N
            </button>

            {/* Delete column */}
            <button
              className="nodrag opacity-0 group-hover/col:opacity-100 transition-opacity text-muted-foreground hover:text-destructive cursor-pointer"
              onClick={() => deleteColumn(id, col.id)}
              title="Delete column"
              aria-label={`Delete column ${col.name}`}
            >
              <X className="h-3 w-3" />
            </button>

            <Handle
              type="source"
              position={Position.Right}
              id={`${id}-${col.id}-source`}
              className="!w-2 !h-2 !bg-erd-handle !border-erd-handle-border"
            />
          </div>
        ))}
      </div>

      {/* Add column button */}
      <div className="border-t border-border">
        <button
          className="nodrag w-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center gap-1 cursor-pointer"
          onClick={() => addColumn(id)}
        >
          <Plus className="h-3 w-3" />
          Add Column
        </button>
      </div>
    </div>
  );
}

export default memo(TableNode);
