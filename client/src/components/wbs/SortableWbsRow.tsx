import { useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TFunction } from 'i18next';
import { ChevronDown, ChevronRight, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { formatProjectDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { WbsItem } from '@/types/wbs';
import { TREE_INDENT } from './wbs-tree-utils';

/** SortableWbsRow 컴포넌트 props. */
export interface SortableWbsRowProps {
  /** WBS 항목 */
  item: WbsItem;
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** 로케일 */
  locale: string;
  /** 담당자 이름 */
  assigneeName: string | null;
  /** 연결 마일스톤 이름 */
  milestoneName: string | null;
  /** 자식 항목 존재 여부 */
  hasChildren: boolean;
  /** 접힌 상태 여부 */
  collapsed: boolean;
  /** 비활성 여부 */
  disabled: boolean;
  /** 강조 상태 */
  highlighted?: boolean;
  /** 번역 함수 */
  t: TFunction;
  /** 접기/펼치기 토글 핸들러 */
  onToggleCollapse: (id: number) => void;
  /** 인라인 이름 수정 핸들러 */
  onInlineNameSubmit: (item: WbsItem, nextName: string) => void;
  /** 인라인 진척률 수정 핸들러 */
  onInlineProgressSubmit: (item: WbsItem, nextProgress: number) => void;
  /** 수정 다이얼로그 열기 핸들러 */
  onOpenEditDialog: (item: WbsItem) => void;
  /** 삭제 요청 핸들러 */
  onRequestDelete: (item: WbsItem) => void;
}

/**
 * 인라인 진척률 편집 결과를 검증하고 확정한다.
 *
 * @param rawValue 사용자가 입력한 문자열
 * @param item 대상 WBS 항목
 * @param t 번역 함수
 * @param onSubmit 유효 값 제출 핸들러
 * @returns 검증 실패 시 기존 값 문자열, 성공 시 null
 */
function confirmProgressEdit(
  rawValue: string,
  item: WbsItem,
  t: TFunction,
  onSubmit: (item: WbsItem, nextProgress: number) => void,
): string | null {
  const parsed = Number(rawValue);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    toast.error(t('wbs.validation.progressRate'));
    return String(item.progressRate);
  }
  if (parsed !== item.progressRate) {
    onSubmit(item, parsed);
  }
  return null;
}

/**
 * 정렬 가능한 WBS 행을 렌더링한다.
 *
 * @param props SortableWbsRow props
 * @returns WBS 단일 행 JSX
 */
export default function SortableWbsRow({
  item,
  canEdit,
  locale,
  assigneeName,
  milestoneName,
  hasChildren,
  collapsed,
  disabled,
  highlighted = false,
  t,
  onToggleCollapse,
  onInlineNameSubmit,
  onInlineProgressSubmit,
  onOpenEditDialog,
  onRequestDelete,
}: SortableWbsRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !canEdit || disabled,
  });
  const { editing, value, setValue, startEdit, confirmEdit, cancelEdit } = useInlineEdit(
    (nextName) => {
      if (nextName !== item.name) {
        onInlineNameSubmit(item, nextName);
      }
    },
  );
  const [progressEditing, setProgressEditing] = useState(false);
  const [progressValue, setProgressValue] = useState(String(item.progressRate));

  useEffect(() => {
    if (!progressEditing) {
      setProgressValue(String(item.progressRate));
    }
  }, [item.progressRate, progressEditing]);

  /** 진척률 인라인 편집을 검증하고 닫는다. */
  const confirmAndCloseProgress = () => {
    const resetValue = confirmProgressEdit(progressValue, item, t, onInlineProgressSubmit);
    if (resetValue != null) {
      setProgressValue(resetValue);
    }
    setProgressEditing(false);
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
      className={cn(
        isDragging && 'bg-accent/40',
        highlighted && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
      )}
    >
      <TableCell>
        <div
          className="flex items-center gap-1.5"
          style={{ paddingLeft: `${item.depth * TREE_INDENT}px` }}
        >
          {hasChildren ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onToggleCollapse(item.id)}
              aria-expanded={!collapsed}
              aria-label={
                collapsed
                  ? t('wbs.aria.expand', { name: item.name })
                  : t('wbs.aria.collapse', { name: item.name })
              }
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <span className="h-7 w-7" aria-hidden />
          )}

          {canEdit && (
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t('wbs.aria.drag', { name: item.name })}
              disabled={disabled}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          <span className="text-xs text-muted-foreground">L{item.depth + 1}</span>

          {editing && canEdit ? (
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onBlur={confirmEdit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  confirmEdit();
                } else if (event.key === 'Escape') {
                  cancelEdit();
                }
              }}
              disabled={disabled}
              className="h-8 max-w-[280px]"
              autoFocus
              aria-label={t('wbs.aria.editName', { name: item.name })}
            />
          ) : canEdit ? (
            <button
              type="button"
              className="truncate text-left font-medium text-foreground hover:underline"
              onClick={() => startEdit(item.name)}
              disabled={disabled}
            >
              {item.name}
            </button>
          ) : (
            <span className="truncate font-medium text-foreground">{item.name}</span>
          )}
        </div>
      </TableCell>

      <TableCell>
        {assigneeName ? (
          <span className="inline-flex max-w-full items-center rounded-full border border-border/80 bg-card px-2.5 py-1 text-xs font-medium text-foreground">
            <span className="truncate">{assigneeName}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{t('wbs.field.unassigned')}</span>
        )}
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {item.startDate && item.endDate
          ? `${formatProjectDate(item.startDate, locale)} ~ ${formatProjectDate(item.endDate, locale)}`
          : item.startDate
            ? `${formatProjectDate(item.startDate, locale)} ~ -`
            : item.endDate
              ? `- ~ ${formatProjectDate(item.endDate, locale)}`
              : t('wbs.field.noPeriod')}
      </TableCell>

      <TableCell className="tabular-nums">
        {progressEditing && canEdit ? (
          <Input
            value={progressValue}
            type="number"
            min={0}
            max={100}
            step={1}
            className="h-8 w-20 tabular-nums"
            onChange={(event) => setProgressValue(event.target.value)}
            onBlur={confirmAndCloseProgress}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                confirmAndCloseProgress();
              } else if (event.key === 'Escape') {
                setProgressValue(String(item.progressRate));
                setProgressEditing(false);
              }
            }}
            autoFocus
            disabled={disabled}
            aria-label={t('wbs.aria.editProgress', { name: item.name })}
          />
        ) : canEdit ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-left text-sm tabular-nums hover:bg-accent"
            onClick={() => setProgressEditing(true)}
            disabled={disabled}
          >
            {item.progressRate}%
          </button>
        ) : (
          `${item.progressRate}%`
        )}
      </TableCell>

      <TableCell className="tabular-nums">
        {item.estimatedMm != null
          ? t('wbs.field.mmValue', { value: item.estimatedMm })
          : t('wbs.field.noEstimatedMm')}
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {milestoneName ?? t('wbs.field.noMilestone')}
      </TableCell>

      {canEdit && (
        <TableCell>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenEditDialog(item)}
              aria-label={t('wbs.aria.edit', { name: item.name })}
              disabled={disabled}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onRequestDelete(item)}
              aria-label={t('wbs.aria.delete', { name: item.name })}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
