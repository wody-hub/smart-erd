import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ProjectStaffingMonthlyAllocation, ProjectStaffingResource } from '@/types/staffing';
import {
  clampStaffingMonthWindowStart,
  getVisibleStaffingMonths,
  resolveStaffingMonthWindowSize,
} from './staffing-matrix-window';

interface StaffingMatrixTableProps {
  /** 인력 행 목록 */
  resources: ProjectStaffingResource[];
  /** 월 컬럼 목록 */
  months: string[];
}

function formatMm(value: number | null): string {
  if (value == null) {
    return '-';
  }
  return value.toFixed(2);
}

function buildAllocationMap(
  allocations: ProjectStaffingMonthlyAllocation[],
): Map<string, ProjectStaffingMonthlyAllocation> {
  return new Map(allocations.map((allocation) => [allocation.month, allocation]));
}

/**
 * 월별 계획/실적 M/M 비교 매트릭스.
 *
 * @param props 매트릭스 props
 * @returns 월별 매트릭스 JSX
 */
export default function StaffingMatrixTable({ resources, months }: StaffingMatrixTableProps) {
  const { t } = useTranslation();
  const windowSize = useMemo(() => resolveStaffingMonthWindowSize(months), [months]);
  const [windowStart, setWindowStart] = useState(0);

  useEffect(() => {
    setWindowStart((previous) => clampStaffingMonthWindowStart(months, previous, windowSize));
  }, [months, windowSize]);

  const visibleMonths = useMemo(
    () => getVisibleStaffingMonths(months, windowStart, windowSize),
    [months, windowSize, windowStart],
  );

  const pagingEnabled = months.length > 18;
  const canGoPrevious = windowStart > 0;
  const canGoNext = windowStart + windowSize < months.length;

  const tableMinWidth = Math.max(960, 240 + visibleMonths.length * 132);

  if (months.length === 0) {
    return (
      <section className="rounded-lg border border-border/80 bg-card p-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">{t('staffing.matrix.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('staffing.matrix.description')}</p>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{t('staffing.matrix.empty')}</p>
      </section>
    );
  }

  return (
    <section
      className="space-y-3 rounded-lg border border-border/80 bg-card p-4"
      aria-label={t('staffing.matrix.title')}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">{t('staffing.matrix.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('staffing.matrix.description')}</p>
        </div>

        {pagingEnabled ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setWindowStart((previous) => Math.max(previous - windowSize, 0))}
              disabled={!canGoPrevious}
              aria-label={t('staffing.matrix.previousWindow')}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t('common.button.previous')}
            </Button>
            <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {t('staffing.matrix.windowRange', {
                start: visibleMonths[0],
                end: visibleMonths[visibleMonths.length - 1],
                total: months.length,
              })}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setWindowStart((previous) =>
                  clampStaffingMonthWindowStart(months, previous + windowSize, windowSize),
                )
              }
              disabled={!canGoNext}
              aria-label={t('staffing.matrix.nextWindow')}
            >
              {t('common.button.next')}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <div
        className="min-w-0 overflow-x-auto rounded-md focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2"
        tabIndex={0}
      >
        <Table className="text-sm" style={{ minWidth: `${tableMinWidth}px` }}>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-20 min-w-[240px] bg-card">
                {t('staffing.field.member')}
              </TableHead>
              {visibleMonths.map((month) => (
                <TableHead key={month} className="min-w-[132px] text-center">
                  {month}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {resources.map((resource) => {
              const allocationMap = buildAllocationMap(resource.monthlyAllocations);

              return (
                <TableRow key={resource.id}>
                  <TableCell className="sticky left-0 z-10 min-w-[240px] bg-card">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{resource.memberName}</p>
                      {resource.memberLoginId ? (
                        <p className="text-xs text-muted-foreground">{resource.memberLoginId}</p>
                      ) : null}
                    </div>
                  </TableCell>

                  {visibleMonths.map((month) => {
                    const allocation = allocationMap.get(month);

                    return (
                      <TableCell key={month} className="min-w-[132px] py-3 text-center text-xs">
                        <div className="space-y-1 tabular-nums">
                          <p>
                            <span className="mr-1 text-muted-foreground">
                              {t('staffing.matrix.planned')}
                            </span>
                            <span>{formatMm(allocation?.plannedMm ?? null)}</span>
                          </p>
                          <p>
                            <span className="mr-1 text-muted-foreground">
                              {t('staffing.matrix.actual')}
                            </span>
                            <span>
                              {allocation?.actualMm != null
                                ? formatMm(allocation.actualMm)
                                : t('staffing.status.actualNotEntered')}
                            </span>
                          </p>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
