import type { TFunction } from 'i18next';
import { formatProjectDate } from '@/lib/format';

export const UNASSIGNED_VALUE = '__unassigned__';
export const NO_MILESTONE_VALUE = '__none__';

export function formatPeriod(
  startDate: string | null,
  endDate: string | null,
  locale: string,
  t: TFunction,
): string {
  if (startDate && endDate) {
    return `${formatProjectDate(startDate, locale)} ~ ${formatProjectDate(endDate, locale)}`;
  }
  if (startDate) {
    return `${formatProjectDate(startDate, locale)} ~ -`;
  }
  if (endDate) {
    return `- ~ ${formatProjectDate(endDate, locale)}`;
  }
  return t('wbs.field.noPeriod');
}

export function formatOptionalPercentage(value: number | null, t: TFunction): string {
  return value == null ? t('wbs.field.noMetric') : `${value}%`;
}

export function formatVariance(value: number | null, t: TFunction): string {
  if (value == null) {
    return t('wbs.field.noMetric');
  }
  return `${value > 0 ? '+' : ''}${value}%`;
}

export function formatVarianceDays(
  value: number | null,
  kind: 'start' | 'end',
  t: TFunction,
): string | null {
  if (value == null) {
    return null;
  }
  return t(`wbs.field.${kind}VarianceDays`, {
    count: value,
    value: `${value > 0 ? '+' : ''}${value}`,
  });
}

export function isDelayedWbsItem(item: {
  progressVarianceRate: number | null;
  startVarianceDays: number | null;
  endVarianceDays: number | null;
}): boolean {
  if ((item.progressVarianceRate ?? 0) < 0) {
    return true;
  }
  if ((item.startVarianceDays ?? 0) > 0) {
    return true;
  }
  if ((item.endVarianceDays ?? 0) > 0) {
    return true;
  }
  return false;
}
