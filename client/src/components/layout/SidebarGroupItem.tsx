import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { cn } from '@/lib/utils';
import type { TableGroup } from '@/types/erd';

/** SidebarGroupItem의 props. */
interface SidebarGroupItemProps {
  /** 그룹 데이터 */
  group: TableGroup;
  /** 테이블 ID -> 라벨 매핑 */
  tableMap: Map<string, string>;
  /** 편집 가능 여부 */
  canEdit?: boolean;
  /** 그룹 뷰 진입 핸들러 */
  onViewGroup?: (groupId: string) => void;
  /** 이름 변경 핸들러 */
  onRename: (newName: string) => void;
  /** 그룹 삭제 핸들러 */
  onDelete: () => void;
  /** 그룹에서 테이블 제거 핸들러 */
  onRemoveTable: (tableId: string) => void;
  /** 테이블 선택 다이얼로그 열기 핸들러 */
  onOpenTableSelect: () => void;
  /** 현재 활성 그룹 여부 */
  isActive?: boolean;
}

/**
 * 사이드바 그룹 항목 컴포넌트.
 */
export default function SidebarGroupItem({
  group,
  tableMap,
  canEdit = true,
  onViewGroup,
  onRename,
  onDelete,
  onRemoveTable,
  onOpenTableSelect,
  isActive = false,
}: SidebarGroupItemProps) {
  const { t } = useTranslation();
  /** 확장/축소 상태 */
  const [open, setOpen] = useState(false);
  /** 삭제 확인 다이얼로그 상태 */
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { editing, value, setValue, startEdit, confirmEdit, cancelEdit } = useInlineEdit(onRename);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          'group flex items-center justify-between px-2 py-1.5 rounded',
          isActive && 'bg-accent text-accent-foreground',
          !isActive && 'hover:bg-accent hover:text-accent-foreground',
        )}
      >
        {editing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-6 text-xs flex-1"
              autoFocus
              aria-label={t('erd.sidebar.aria.groupNameInput', { name: group.label })}
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
        ) : (
          <>
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center gap-1 flex-1 min-w-0 text-sm cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                aria-label={t('erd.sidebar.aria.toggleGroup', { name: group.label })}
              >
                {open ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">{group.label}</span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({group.tableIds.length})
                </span>
              </button>
            </CollapsibleTrigger>

            <div className="flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => onViewGroup?.(group.id)}
                disabled={group.tableIds.length === 0}
                aria-label={
                  group.tableIds.length === 0
                    ? t('erd.sidebar.aria.viewGroupEmpty', { name: group.label })
                    : t('erd.sidebar.aria.viewGroup', { name: group.label })
                }
              >
                <Eye className="h-3 w-3" />
              </Button>
              {canEdit && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(group.label);
                    }}
                    aria-label={t('erd.sidebar.aria.renameGroup', { name: group.label })}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmOpen(true);
                    }}
                    aria-label={t('erd.sidebar.aria.deleteGroup', { name: group.label })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="pl-6 space-y-0.5 py-1">
          {group.tableIds.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('erd.group.noTables')}</p>
          ) : (
            group.tableIds.map((tableId) => {
              const tableName = tableMap.get(tableId) ?? tableId;
              return (
                <div
                  key={tableId}
                  className="flex items-center justify-between text-xs py-0.5 text-foreground"
                >
                  <span className="truncate flex-1" title={tableName}>
                    {tableName}
                  </span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => onRemoveTable(tableId)}
                      aria-label={t('erd.sidebar.aria.removeFromGroup', {
                        table: tableName,
                        group: group.label,
                      })}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={onOpenTableSelect}
              aria-label={t('erd.group.aria.addTableToGroup', { name: group.label })}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('erd.sidebar.addTableToGroup')}
            </Button>
          )}
        </div>
      </CollapsibleContent>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('erd.group.deleteConfirm.title', { name: group.label })}
        description={t('erd.group.deleteConfirm.description')}
        onConfirm={() => {
          onDelete();
          setDeleteConfirmOpen(false);
        }}
      />
    </Collapsible>
  );
}
