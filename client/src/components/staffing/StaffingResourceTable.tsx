import { Pencil, Trash2 } from 'lucide-react';
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
import { formatCurrency } from '@/lib/format';
import type { StaffingGrade, ProjectStaffingResource } from '@/types/staffing';

interface StaffingResourceTableProps {
  /** 인력 행 목록 */
  resources: ProjectStaffingResource[];
  /** 편집 권한 여부 */
  canEdit: boolean;
  /** 수정 클릭 핸들러 */
  onEdit: (resource: ProjectStaffingResource) => void;
  /** 삭제 클릭 핸들러 */
  onDelete: (resource: ProjectStaffingResource) => void;
  /** 삭제 진행 중 ID */
  deletingId?: number | null;
}

function formatMm(value: number | null): string {
  if (value == null) {
    return '-';
  }
  return value.toFixed(2);
}

function formatSignedMm(value: number | null): string {
  if (value == null) {
    return '-';
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function formatPeriod(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) {
    return '-';
  }
  return `${startDate} ~ ${endDate}`;
}

/**
 * 인력 투입 리소스 테이블.
 *
 * @param props 테이블 props
 * @returns 인력 테이블 JSX
 */
export default function StaffingResourceTable({
  resources,
  canEdit,
  onEdit,
  onDelete,
  deletingId = null,
}: StaffingResourceTableProps) {
  const { t } = useTranslation();
  const gradeLabelByValue: Record<StaffingGrade, string> = {
    JUNIOR: t('staffing.grade.junior'),
    MIDDLE: t('staffing.grade.middle'),
    SENIOR: t('staffing.grade.senior'),
    EXPERT: t('staffing.grade.expert'),
  };

  const sortedResources = [...resources].sort((left, right) => {
    const nameCompare = left.memberName.localeCompare(right.memberName);
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return left.id - right.id;
  });

  return (
    <section className="space-y-2" aria-label={t('staffing.section.title')}>
      <div className="min-w-0 overflow-x-auto">
        <Table className="min-w-[1820px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">{t('staffing.field.member')}</TableHead>
              <TableHead className="min-w-[120px]">{t('staffing.field.grade')}</TableHead>
              <TableHead className="min-w-[150px]">{t('staffing.field.monthlyRate')}</TableHead>
              <TableHead className="min-w-[220px]">{t('staffing.field.plannedPeriod')}</TableHead>
              <TableHead className="min-w-[120px]">
                {t('staffing.field.plannedParticipation')}
              </TableHead>
              <TableHead className="min-w-[120px]">{t('staffing.field.plannedMm')}</TableHead>
              <TableHead className="min-w-[220px]">{t('staffing.field.actualPeriod')}</TableHead>
              <TableHead className="min-w-[120px]">
                {t('staffing.field.actualParticipation')}
              </TableHead>
              <TableHead className="min-w-[120px]">{t('staffing.field.actualMm')}</TableHead>
              <TableHead className="min-w-[120px]">{t('staffing.field.deltaMm')}</TableHead>
              <TableHead className="min-w-[190px]">{t('staffing.field.cost')}</TableHead>
              {canEdit ? (
                <TableHead className="min-w-[104px]">{t('staffing.field.actions')}</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedResources.map((resource) => {
              const hasActualPeriod = resource.actualStartDate && resource.actualEndDate;
              const hasActualParticipation = resource.actualParticipationRate != null;
              const hasActualTotals = resource.actualMm != null;

              return (
                <TableRow key={resource.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{resource.memberName}</p>
                      {resource.memberLoginId ? (
                        <p className="text-xs text-muted-foreground">{resource.memberLoginId}</p>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell>{gradeLabelByValue[resource.grade]}</TableCell>

                  <TableCell className="tabular-nums">
                    {formatCurrency(resource.monthlyRate)}
                  </TableCell>

                  <TableCell className="tabular-nums">
                    {formatPeriod(resource.plannedStartDate, resource.plannedEndDate)}
                  </TableCell>

                  <TableCell className="tabular-nums">
                    {resource.plannedParticipationRate}%
                  </TableCell>

                  <TableCell className="tabular-nums">{formatMm(resource.plannedMm)}</TableCell>

                  <TableCell className="tabular-nums">
                    {hasActualPeriod
                      ? formatPeriod(resource.actualStartDate, resource.actualEndDate)
                      : t('staffing.status.actualNotEntered')}
                  </TableCell>

                  <TableCell className="tabular-nums">
                    {hasActualParticipation
                      ? `${resource.actualParticipationRate}%`
                      : t('staffing.status.actualNotEntered')}
                  </TableCell>

                  <TableCell className="tabular-nums">
                    {hasActualTotals
                      ? formatMm(resource.actualMm)
                      : t('staffing.status.actualNotEntered')}
                  </TableCell>

                  <TableCell className="tabular-nums">{formatSignedMm(resource.deltaMm)}</TableCell>

                  <TableCell className="tabular-nums">
                    <div className="space-y-1 text-xs">
                      <p>
                        {t('staffing.summary.plannedCost')}:{' '}
                        <span>{formatCurrency(resource.plannedCost)}</span>
                      </p>
                      <p>
                        {t('staffing.summary.actualCost')}:{' '}
                        <span>
                          {resource.actualCost != null
                            ? formatCurrency(resource.actualCost)
                            : t('staffing.status.actualNotEntered')}
                        </span>
                      </p>
                    </div>
                  </TableCell>

                  {canEdit ? (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('staffing.aria.edit', { name: resource.memberName })}
                          title={t('staffing.aria.edit', { name: resource.memberName })}
                          onClick={() => onEdit(resource)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('staffing.aria.delete', { name: resource.memberName })}
                          title={t('staffing.aria.delete', { name: resource.memberName })}
                          onClick={() => onDelete(resource)}
                          disabled={deletingId === resource.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
