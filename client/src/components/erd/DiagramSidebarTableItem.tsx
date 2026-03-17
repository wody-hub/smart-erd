import { Trash2, Pencil, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useInlineEdit } from '@/hooks/useInlineEdit';

/** DiagramSidebarTableItem의 props. */
interface DiagramSidebarTableItemProps {
  /** 노드 ID */
  nodeId: string;
  /** 항목 기본 이름(편집 시 초기값으로 사용) */
  label: string;
  /** 목록에 표시할 이름(미지정 시 label 사용) */
  displayLabel?: string;
  /** 이름 변경 접근성 라벨 */
  renameAriaLabel: string;
  /** 삭제 접근성 라벨 */
  deleteAriaLabel: string;
  /** 테이블 클릭 시 캔버스 포커스 핸들러 */
  onClick: () => void;
  /** 이름 변경 핸들러 */
  onRename: (newName: string) => void;
  /** 삭제 핸들러 */
  onDelete: () => void;
  /** 편집 가능 여부 (VIEWER일 때 false — 이름변경/삭제 버튼 숨김) */
  canEdit?: boolean;
}

/**
 * Sidebar 내 개별 테이블 항목 컴포넌트.
 *
 * 테이블 이름 표시, 클릭 시 캔버스 포커스, 인라인 이름 변경, 삭제 기능을 제공한다.
 *
 * @param props.label    테이블 표시 이름
 * @param props.onClick  테이블 클릭 시 캔버스 포커스 핸들러
 * @param props.onRename 이름 변경 확정 핸들러
 * @param props.onDelete 삭제 핸들러
 * @param props.canEdit  편집 가능 여부
 */
export default function DiagramSidebarTableItem({
  label,
  displayLabel,
  renameAriaLabel,
  deleteAriaLabel,
  onClick,
  onRename,
  onDelete,
  canEdit = true,
}: DiagramSidebarTableItemProps) {
  const { t } = useTranslation();
  const { editing, value, setValue, startEdit, confirmEdit, cancelEdit } = useInlineEdit(onRename);
  const rowLabel = displayLabel ?? label;

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-6 text-xs flex-1"
          autoFocus
          aria-label={renameAriaLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmEdit();
            if (e.key === 'Escape') cancelEdit();
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={confirmEdit}
          aria-label={t('common.aria.confirmRename')}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={cancelEdit}
          aria-label={t('common.aria.cancelRename')}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-foreground hover:bg-accent hover:text-accent-foreground focus-within:bg-accent focus-within:text-accent-foreground"
      onClick={onClick}
    >
      <span className="text-sm truncate flex-1" title={rowLabel}>
        {rowLabel}
      </span>
      {canEdit && (
        <div className="flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              startEdit(label);
            }}
            aria-label={renameAriaLabel}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label={deleteAriaLabel}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
