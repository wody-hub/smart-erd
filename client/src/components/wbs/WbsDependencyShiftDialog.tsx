import { useMemo } from 'react';
import { CalendarRange, Route } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { WbsDependencyShiftResponse, WbsItem } from '@/types/wbs';

interface WbsDependencyShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WbsItem | null;
  allItems: WbsItem[];
  shiftDaysValue: string;
  onShiftDaysValueChange: (value: string) => void;
  preview: WbsDependencyShiftResponse | null;
  previewLoading: boolean;
  loading: boolean;
  onApply: () => Promise<void>;
}

function formatDateRange(
  locale: string,
  startDate: string | null,
  endDate: string | null,
  fallback: string,
): string {
  if (!startDate && !endDate) {
    return fallback;
  }

  const start = startDate ? new Date(`${startDate}T00:00:00`).toLocaleDateString(locale) : '-';
  const end = endDate ? new Date(`${endDate}T00:00:00`).toLocaleDateString(locale) : '-';
  return `${start} → ${end}`;
}

export default function WbsDependencyShiftDialog({
  open,
  onOpenChange,
  item,
  allItems,
  shiftDaysValue,
  onShiftDaysValueChange,
  preview,
  previewLoading,
  loading,
  onApply,
}: WbsDependencyShiftDialogProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const shiftDays = Number.parseInt(shiftDaysValue, 10);
  const itemById = useMemo(() => new Map(allItems.map((entry) => [entry.id, entry])), [allItems]);
  const previewRows = preview?.updates ?? [];
  const previewIssues = preview?.issues ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('wbs.shift.title')}</DialogTitle>
          <DialogDescription>
            {item
              ? t('wbs.shift.description', { name: item.name })
              : t('wbs.shift.descriptionFallback')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/80 bg-secondary/10 p-4">
            <div className="flex items-start gap-3">
              <CalendarRange className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{t('wbs.shift.daysLabel')}</p>
                <p className="text-sm text-muted-foreground">{t('wbs.shift.daysHint')}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Input
                type="number"
                min={-365}
                max={365}
                step={1}
                value={shiftDaysValue}
                onChange={(event) => onShiftDaysValueChange(event.target.value)}
                className="max-w-[140px]"
              />
              <span className="text-sm text-muted-foreground">
                {t('wbs.shift.summary', { count: previewRows.length })}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card/70 p-4">
            <div className="flex items-start gap-3">
              <Route className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{t('wbs.shift.previewTitle')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('wbs.shift.previewDescription')}
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-[320px] overflow-y-auto rounded-lg border border-border/70 bg-background/80">
              {previewLoading ? (
                <div className="p-4 text-sm text-muted-foreground">{t('common.loading')}</div>
              ) : previewRows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">{t('wbs.shift.previewEmpty')}</div>
              ) : (
                <div className="divide-y divide-border/60">
                  {previewRows.map((entry) => (
                    <div key={entry.wbsItemId} className="space-y-2 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {itemById.get(entry.wbsItemId)?.name ?? `#${entry.wbsItemId}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t(
                              entry.anchor
                                ? 'wbs.shift.reason.anchor'
                                : 'wbs.shift.reason.downstream',
                            )}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t('wbs.shift.delta', { count: shiftDays })}
                        </span>
                      </div>
                      <div className="grid gap-2 text-sm md:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            {t('wbs.shift.before')}
                          </p>
                          <p className="mt-1 text-foreground">
                            {formatDateRange(
                              locale,
                              entry.originalStartDate,
                              entry.originalEndDate,
                              t('wbs.shift.unscheduled'),
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            {t('wbs.shift.after')}
                          </p>
                          <p className="mt-1 text-foreground">
                            {formatDateRange(
                              locale,
                              entry.startDate,
                              entry.endDate,
                              t('wbs.shift.unscheduled'),
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {previewIssues.length > 0 ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">{t('wbs.shift.issuesTitle')}</p>
              <div className="mt-2 space-y-1 text-sm text-destructive/90">
                {previewIssues.map((issue, index) => (
                  <p key={`${issue.code}-${issue.wbsItemId ?? 'global'}-${index}`}>{issue.message}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common.button.cancel')}
          </Button>
          <Button
            onClick={() => onApply()}
            disabled={
              loading ||
              previewLoading ||
              Number.isNaN(shiftDays) ||
              shiftDays === 0 ||
              previewRows.length === 0 ||
              previewIssues.length > 0
            }
          >
            {loading ? t('wbs.shift.applying') : t('wbs.shift.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
