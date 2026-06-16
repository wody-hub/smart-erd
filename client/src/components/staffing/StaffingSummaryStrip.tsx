import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectStaffingSummary } from '@/types/staffing';

interface StaffingSummaryStripProps {
  /** 프로젝트 인력 요약 수치 */
  summary: ProjectStaffingSummary;
}

function formatMm(value: number): string {
  return value.toFixed(2);
}

function formatSignedMm(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

/**
 * 인력 투입 요약 지표 스트립.
 *
 * @param props summary props
 * @returns 요약 지표 JSX
 */
export default function StaffingSummaryStrip({ summary }: StaffingSummaryStripProps) {
  const { t } = useTranslation();

  const deltaToneClass =
    summary.deltaMm > 0
      ? 'text-brand-secondary'
      : summary.deltaMm < 0
        ? 'text-foreground'
        : 'text-foreground';

  return (
    <section
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      aria-label={t('staffing.section.title')}
    >
      <article className="rounded-lg border border-border/80 bg-card p-4 shadow-operational">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t('staffing.summary.plannedMm')}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
          {formatMm(summary.plannedMm)}
        </p>
      </article>

      <article className="rounded-lg border border-border/80 bg-card p-4 shadow-operational">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t('staffing.summary.actualMm')}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
          {formatMm(summary.actualMm)}
        </p>
      </article>

      <article className="rounded-lg border border-border/80 bg-card p-4 shadow-operational">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t('staffing.summary.deltaMm')}
        </p>
        <p className={cn('mt-2 text-2xl font-semibold tabular-nums', deltaToneClass)}>
          {formatSignedMm(summary.deltaMm)}
        </p>
      </article>

      <article className="rounded-lg border border-border/80 bg-card p-4 shadow-operational">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t('staffing.summary.plannedCost')}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
          {formatCurrency(summary.plannedCost)}
        </p>
      </article>

      <article className="rounded-lg border border-border/80 bg-card p-4 shadow-operational">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t('staffing.summary.actualCost')}
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
          {formatCurrency(summary.actualCost)}
        </p>
      </article>
    </section>
  );
}
