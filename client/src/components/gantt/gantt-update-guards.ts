import { formatDateOnly } from './gantt-date-utils';

interface ResolveWbsDateRangeUpdateArgs {
  start: unknown;
  end: unknown;
  originalStartDate: string | null;
  originalEndDate: string | null;
}

interface WbsDateRangeUpdate {
  startDate: string;
  endDate: string;
}

/**
 * Accept only finalized WBS date-range edits.
 * Rejects non-date edits (e.g. progress handle) by requiring a real start/end change.
 */
export function resolveWbsDateRangeUpdate({
  start,
  end,
  originalStartDate,
  originalEndDate,
}: ResolveWbsDateRangeUpdateArgs): WbsDateRangeUpdate | null {
  if (!(start instanceof Date) || !(end instanceof Date)) {
    return null;
  }
  if (!originalStartDate || !originalEndDate) {
    return null;
  }

  const startDate = formatDateOnly(start);
  const endDate = formatDateOnly(end);
  if (startDate === originalStartDate && endDate === originalEndDate) {
    return null;
  }

  return { startDate, endDate };
}
