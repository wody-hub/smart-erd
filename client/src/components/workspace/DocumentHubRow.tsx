import { Check, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import DocumentTypeBadge from '@/components/workspace/DocumentTypeBadge';
import { cn } from '@/lib/utils';
import type { DocumentListItem } from '@/types/workspace';

/** 문서 허브 목록 행 컴포넌트 props. */
interface DocumentHubRowProps {
  /** 표시할 문서 목록 아이템 */
  item: DocumentListItem;
  /** 날짜 포맷에 쓸 locale 문자열 */
  locale: string;
  /** 문서 열기 핸들러 */
  onOpen: () => void;
  /** 편집 권한 여부 */
  canEdit?: boolean;
  /** 컨텍스트 제어 슬롯 (사전 세트 선택 등) */
  contextControl?: React.ReactNode;
  /** 이름 변경 진행 상태 (undefined면 비활성) */
  renameState?:
    | {
        value: string;
        onValueChange: (value: string) => void;
        onConfirm: () => void;
        onCancel: () => void;
      }
    | undefined;
  /** 이름 변경 시작 핸들러 */
  onStartRename?: () => void;
  /** 삭제 핸들러 */
  onDelete?: () => void;
}

const STATUS_TONE_STYLES = {
  neutral: 'text-muted-foreground',
  success: 'text-erd-validation-matched',
  warning: 'text-erd-validation-mismatch',
} as const;

/**
 * 문서 허브 목록의 단일 행을 렌더링한다.
 *
 * @param props 행 컴포넌트 props
 * @returns 문서 행 JSX
 */
export default function DocumentHubRow({
  item,
  locale,
  onOpen,
  canEdit = false,
  contextControl,
  renameState,
  onStartRename,
  onDelete,
}: DocumentHubRowProps) {
  const { t } = useTranslation();
  const updatedAtLabel = t('workspace.meta.updatedAt', {
    date: new Date(item.updatedAt).toLocaleDateString(locale),
  });
  const dictionaryContextLabel = item.dictionaryContextName
    ? t('workspace.meta.dictionaryContext', { name: item.dictionaryContextName })
    : null;
  const templateLabel = item.templateLabel
    ? t('workspace.meta.templateContext', { name: item.templateLabel })
    : null;
  const summaryText =
    item.summaryText && item.summaryText.trim() !== item.name.trim() ? item.summaryText : null;

  return (
    <div className="surface-operational group rounded-xl transition-all hover:-translate-y-0.5 hover:border-primary/20">
      <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <DocumentTypeBadge documentType={item.type} />
            {renameState ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Input
                  value={renameState.value}
                  onChange={(e) => renameState.onValueChange(e.target.value)}
                  className="h-9"
                  autoFocus
                  aria-label={t('workspace.action.renameDocument')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameState.onConfirm();
                    if (e.key === 'Escape') renameState.onCancel();
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={renameState.onConfirm}
                  aria-label={t('common.aria.confirmRename')}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={renameState.onCancel}
                  aria-label={t('common.aria.cancelRename')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpen}
                className="min-w-0 text-left"
                aria-label={t('workspace.action.openDocument', { name: item.name })}
              >
                <span className="block truncate text-[1.02rem] font-semibold tracking-[-0.02em] text-foreground transition-colors group-hover:text-primary">
                  {item.name}
                </span>
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:gap-y-1">
            <span>{updatedAtLabel}</span>
            {dictionaryContextLabel && <span>{dictionaryContextLabel}</span>}
            {templateLabel && <span>{templateLabel}</span>}
            {item.statusLabel && (
              <span className={cn(STATUS_TONE_STYLES[item.statusTone ?? 'neutral'])}>
                {item.statusLabel}
              </span>
            )}
          </div>
          {summaryText && (
            <p className="mt-3 text-sm leading-6 text-ink-secondary">{summaryText}</p>
          )}
        </div>

        {contextControl && <div className="min-w-0 lg:w-[240px] lg:shrink-0">{contextControl}</div>}

        {canEdit && (onStartRename || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 self-end lg:self-center"
                aria-label={t('workspace.action.documentActions')}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onStartRename && (
                <DropdownMenuItem onSelect={onStartRename}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t('workspace.action.renameDocument')}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onSelect={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('workspace.action.deleteDocument')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
