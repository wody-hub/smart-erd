import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import type { LogicalNameResolution } from '@/lib/logical-name-resolution';
import type { Domain } from '@/types/dictionary';
import type { Column } from '@/types/erd';
import {
  buildColumnRenderMeta,
  countDuplicateLogicalNameColumns,
  getValidationStatusI18nKey,
} from '@/hooks/useColumnValidation';
import { selectCompactOverviewColumns } from './CompactTableRenderingContext';

interface UseTableColumnRenderModelOptions {
  columns: Column[];
  connectedColumnIds: Set<string>;
  compactRows: boolean;
  t: TFunction;
  resolveLogicalName: (logicalName: string) => LogicalNameResolution;
  findTermById: (id: number) => { physicalName: string; domainId: number | null } | undefined;
  findDomainById: (id: number) => Domain | undefined;
}

/**
 * persisted/preview table이 공유하는 컬럼 렌더 메타를 구성한다.
 *
 * 경고/도메인/중복 논리명/compact overview 가시 컬럼 계산을 한 군데로 모아
 * 대형 TableNode/PreviewTableNodes가 정책 계산을 직접 들고 있지 않게 만든다.
 */
export function useTableColumnRenderModel({
  columns,
  connectedColumnIds,
  compactRows,
  t,
  resolveLogicalName,
  findTermById,
  findDomainById,
}: UseTableColumnRenderModelOptions) {
  const visibleColumns = useMemo(() => {
    if (!compactRows) {
      return columns;
    }
    return selectCompactOverviewColumns(columns, connectedColumnIds);
  }, [columns, compactRows, connectedColumnIds]);

  const duplicateLogicalNameColumnCount = useMemo(
    () => countDuplicateLogicalNameColumns(columns),
    [columns],
  );

  const { renderMetaById } = useMemo(
    () =>
      buildColumnRenderMeta(
        columns,
        {
          resolveLogicalName,
          findTermById,
          findDomainById,
        },
        visibleColumns,
      ),
    [columns, findDomainById, findTermById, resolveLogicalName, visibleColumns],
  );

  const validationWarningTextByStatus = useMemo(
    () => ({
      'name-mismatch': t(getValidationStatusI18nKey('name-mismatch')),
      'type-mismatch': t(getValidationStatusI18nKey('type-mismatch')),
      unregistered: t(getValidationStatusI18nKey('unregistered')),
    }),
    [t],
  );

  const hiddenUnconnectedColumnCount = compactRows ? columns.length - visibleColumns.length : 0;

  return {
    renderMetaById,
    duplicateLogicalNameColumnCount,
    validationWarningTextByStatus,
    visibleColumns,
    hiddenUnconnectedColumnCount,
  };
}
