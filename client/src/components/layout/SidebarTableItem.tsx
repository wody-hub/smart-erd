import { useState } from 'react';
import { Trash2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** SidebarTableItem의 props. */
interface SidebarTableItemProps {
  /** 노드 ID */
  nodeId: string;
  /** 테이블 표시 이름 */
  label: string;
  /** 테이블 클릭 시 캔버스 포커스 핸들러 */
  onClick: () => void;
  /** 이름 변경 핸들러 */
  onRename: (newName: string) => void;
  /** 삭제 핸들러 */
  onDelete: () => void;
}

/**
 * Sidebar 내 개별 테이블 항목 컴포넌트.
 *
 * 테이블 이름 표시, 클릭 시 캔버스 포커스, 인라인 이름 변경, 삭제 기능을 제공한다.
 */
export default function SidebarTableItem({
  label,
  onClick,
  onRename,
  onDelete,
}: SidebarTableItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);

  /** 이름 변경을 확정한다. */
  const confirmEdit = () => {
    if (editValue.trim()) {
      onRename(editValue.trim());
    }
    setEditing(false);
  };

  /** 이름 변경을 취소한다. */
  const cancelEdit = () => {
    setEditValue(label);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="h-6 text-xs flex-1"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmEdit();
            if (e.key === 'Escape') cancelEdit();
          }}
        />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={confirmEdit}>
          <Check className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-200 cursor-pointer group"
      onClick={onClick}
    >
      <span className="text-sm truncate flex-1">{label}</span>
      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            setEditValue(label);
            setEditing(true);
          }}
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
