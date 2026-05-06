import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUp,
  CornerDownRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { WbsItem, WbsTemplateSummary } from '@/types/wbs';

function ActionTooltip({ label, description }: { label: string; description: string }) {
  return (
    <TooltipContent
      side="top"
      className="max-w-60 rounded-lg border-border/80 bg-popover/95 px-3 py-2 text-left shadow-lg"
    >
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-[11px] leading-4 text-muted-foreground">{description}</p>
      </div>
    </TooltipContent>
  );
}

function ActionIconButton({
  icon,
  label,
  description,
  onClick,
  disabled,
  destructive = false,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-6 w-6 rounded-md border border-border/70 bg-transparent text-foreground/80 transition-colors hover:border-border hover:bg-accent/80 hover:text-foreground disabled:border-transparent disabled:bg-transparent disabled:text-muted-foreground/35 disabled:opacity-100',
            destructive &&
              'hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive',
          )}
          onClick={onClick}
          aria-label={label}
          disabled={disabled}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <ActionTooltip label={label} description={description} />
    </Tooltip>
  );
}

export interface SortableWbsRowActionStripProps {
  canAddBelow: boolean;
  canAddChild: boolean;
  canEdit: boolean;
  canIndent: boolean;
  canMoveDown: boolean;
  canMoveUp: boolean;
  canOutdent: boolean;
  disabled: boolean;
  item: WbsItem;
  pageActionCellClass?: string;
  pageAuthoringMode: boolean;
  pageDenseCellClass?: string;
  t: TFunction;
  templates: WbsTemplateSummary[];
  onAddBelow?: (item: WbsItem) => void;
  onAddChild?: (item: WbsItem) => void;
  onApplyTemplate?: (template: WbsTemplateSummary, item: WbsItem) => void;
  onDuplicate?: (item: WbsItem) => void;
  onIndent?: (item: WbsItem) => void;
  onMoveDown?: (item: WbsItem) => void;
  onMoveUp?: (item: WbsItem) => void;
  onOpenEditDialog: (item: WbsItem) => void;
  onOpenMoveDialog: (item: WbsItem) => void;
  onOutdent?: (item: WbsItem) => void;
  onRequestDelete: (item: WbsItem) => void;
  onSaveTemplate?: (item: WbsItem) => void;
}

export function SortableWbsRowActionStrip({
  canAddBelow,
  canAddChild,
  canEdit,
  canIndent,
  canMoveDown,
  canMoveUp,
  canOutdent,
  disabled,
  item,
  pageActionCellClass,
  pageAuthoringMode,
  pageDenseCellClass,
  t,
  templates,
  onAddBelow,
  onAddChild,
  onApplyTemplate,
  onDuplicate,
  onIndent,
  onMoveDown,
  onMoveUp,
  onOpenEditDialog,
  onOpenMoveDialog,
  onOutdent,
  onRequestDelete,
  onSaveTemplate,
}: SortableWbsRowActionStripProps) {
  if (!canEdit) {
    return null;
  }

  return (
    <TableCell className={cn(pageDenseCellClass, pageAuthoringMode && 'pr-3', pageActionCellClass)}>
      <div className={cn('flex gap-1', pageAuthoringMode && 'justify-end')}>
        {pageAuthoringMode ? (
          <TooltipProvider delayDuration={220}>
            <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-transparent px-1.5 py-1">
              <ActionIconButton
                icon={<Plus className="h-3.5 w-3.5" />}
                label={t('wbs.action.addBelow')}
                description={t('wbs.tooltip.addBelow')}
                onClick={() => onAddBelow?.(item)}
                disabled={disabled || !canAddBelow}
              />
              <ActionIconButton
                icon={<CornerDownRight className="h-3.5 w-3.5" />}
                label={t('wbs.action.addChild')}
                description={t('wbs.tooltip.addChild')}
                onClick={() => onAddChild?.(item)}
                disabled={disabled || !canAddChild}
              />
              <ActionIconButton
                icon={<ArrowUp className="h-3.5 w-3.5" />}
                label={t('wbs.action.moveUp')}
                description={t('wbs.tooltip.moveUp')}
                onClick={() => onMoveUp?.(item)}
                disabled={disabled || !canMoveUp}
              />
              <ActionIconButton
                icon={<ArrowDown className="h-3.5 w-3.5" />}
                label={t('wbs.action.moveDown')}
                description={t('wbs.tooltip.moveDown')}
                onClick={() => onMoveDown?.(item)}
                disabled={disabled || !canMoveDown}
              />
              <ActionIconButton
                icon={<ChevronRight className="h-3.5 w-3.5" />}
                label={t('wbs.action.indent')}
                description={t('wbs.tooltip.indent')}
                onClick={() => onIndent?.(item)}
                disabled={disabled || !canIndent}
              />
              <ActionIconButton
                icon={<ArrowLeft className="h-3.5 w-3.5" />}
                label={t('wbs.action.outdent')}
                description={t('wbs.tooltip.outdent')}
                onClick={() => onOutdent?.(item)}
                disabled={disabled || !canOutdent}
              />
              <span className="mx-0.5 h-4 w-px bg-border/70" aria-hidden />
              <ActionIconButton
                icon={<Pencil className="h-3.5 w-3.5" />}
                label={t('wbs.action.edit')}
                description={t('wbs.tooltip.edit')}
                onClick={() => onOpenEditDialog(item)}
                disabled={disabled}
              />
              <ActionIconButton
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label={t('wbs.action.delete')}
                description={t('wbs.tooltip.delete')}
                onClick={() => onRequestDelete(item)}
                disabled={disabled}
                destructive
              />
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md border border-border/70 bg-transparent text-foreground/80 transition-colors hover:border-border hover:bg-accent/80 hover:text-foreground"
                        aria-label={t('wbs.aria.more', { name: item.name })}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <ActionTooltip
                    label={t('wbs.action.more')}
                    description={t('wbs.tooltip.more')}
                  />
                </Tooltip>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>{t('wbs.template.menuTitle')}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onDuplicate?.(item)}>
                    {t('wbs.action.duplicate')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSaveTemplate?.(item)}>
                    {t('wbs.template.saveAction')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {templates.length === 0 ? (
                    <div className="px-2.5 py-2 text-sm text-muted-foreground">
                      {t('wbs.template.empty')}
                    </div>
                  ) : (
                    templates.map((template) => (
                      <DropdownMenuItem
                        key={template.id}
                        onClick={() => onApplyTemplate?.(template, item)}
                      >
                        {t('wbs.template.applyNamed', { name: template.name })}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TooltipProvider>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenMoveDialog(item)}
            aria-label={t('wbs.aria.move', { name: item.name })}
            disabled={disabled}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        )}
        {!pageAuthoringMode ? (
          <>
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
          </>
        ) : null}
      </div>
    </TableCell>
  );
}
