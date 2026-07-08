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

interface UseTableColumnRenderModelOptions {
  columns: Column[];
  t: TFunction;
  resolveLogicalName: (logicalName: string) => LogicalNameResolution;
  findTermById: (id: number) => { physicalName: string; domainId: number | null } | undefined;
  findDomainById: (id: number) => Domain | undefined;
}

/**
 * persisted/preview table이 공유하는 컬럼 렌더 메타를 구성한다.
 *
 * 경고/도메인/중복 논리명/가시 컬럼 계산을 한 군데로 모아
 * 대형 TableNode/PreviewTableNodes가 정책 계산을 직접 들고 있지 않게 만든다.
 */
export function useTableColumnRenderModel({
  columns,
  t,
  resolveLogicalName,
  findTermById,
  findDomainById,
}: UseTableColumnRenderModelOptions) {
  const visibleColumns = columns;

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

  const hiddenUnconnectedColumnCount = 0;

  return {
    renderMetaById,
    duplicateLogicalNameColumnCount,
    validationWarningTextByStatus,
    visibleColumns,
    hiddenUnconnectedColumnCount,
  };
}
