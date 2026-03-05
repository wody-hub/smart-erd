import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import type { BulkValidationResponse, BulkSaveResponse } from '@/types/dictionary';

/** BulkUploadStepPreview 컴포넌트 props */
interface BulkUploadStepPreviewProps {
  /** 업로드 모드 (도메인/용어) */
  mode: 'domain' | 'term';
  /** 검증 결과 */
  validationResult: BulkValidationResponse;
  /** 저장에서 제외할 행 번호 Set */
  excludedRows: Set<number>;
  /** 행 체크박스 토글 핸들러 */
  onToggleRow: (rowNumber: number) => void;
  /** 오류 행만 보기 토글 */
  showErrorOnly: boolean;
  /** 오류 행만 보기 변경 핸들러 */
  onShowErrorOnlyChange: (checked: boolean) => void;
  /** 오류 엑셀 다운로드 핸들러 */
  onErrorDownload: () => void;
  /** 오류 엑셀 다운로드 진행 여부 */
  downloadingErrors: boolean;
  /** 오류가 있는 상태에서 저장이 완료되었는지 여부 */
  saveCompletedWithErrors: boolean;
  /** 저장 결과 */
  saveResult: BulkSaveResponse | null;
  /** 미리보기 렌더링 최대 행 수 */
  previewRowLimit: number;
}

/** 도메인 데이터 컬럼 키 */
const DOMAIN_COLUMNS = ['logicalName', 'physicalType', 'description'] as const;

/** 용어 데이터 컬럼 키 */
const TERM_COLUMNS = ['logicalName', 'physicalName', 'domainLogicalName', 'description'] as const;

/**
 * 컬럼 키에 대응하는 i18n 헤더 키를 반환한다.
 *
 * @param col 컬럼 키
 * @returns i18n 헤더 키
 */
function getColumnHeaderKey(col: string): string {
  const headerMap: Record<string, string> = {
    logicalName: 'dictionary.domain.table.logicalName',
    physicalType: 'dictionary.domain.table.physicalType',
    physicalName: 'dictionary.term.table.physicalName',
    domainLogicalName: 'dictionary.term.table.domain',
    description: 'dictionary.domain.table.description',
  };
  return headerMap[col] ?? col;
}

/**
 * 컬럼 키별 고정 폭 클래스를 반환한다.
 *
 * @param col 컬럼 키
 * @returns Tailwind width class
 */
function getColumnWidthClass(col: string): string {
  const widthMap: Record<string, string> = {
    logicalName: 'w-[180px]',
    physicalType: 'w-[200px]',
    physicalName: 'w-[200px]',
    domainLogicalName: 'w-[180px]',
    description: 'w-[320px]',
  };
  return widthMap[col] ?? 'w-[180px]';
}

/**
 * 대량 업로드 Step 2 — 미리보기 테이블 + 에러 필터.
 *
 * @param props 미리보기 관련 상태 및 콜백
 * @returns Step 2 JSX
 */
export default function BulkUploadStepPreview({
  mode,
  validationResult,
  excludedRows,
  onToggleRow,
  showErrorOnly,
  onShowErrorOnlyChange,
  onErrorDownload,
  downloadingErrors,
  saveCompletedWithErrors,
  saveResult,
  previewRowLimit,
}: BulkUploadStepPreviewProps) {
  const { t } = useTranslation();

  const columns = mode === 'domain' ? DOMAIN_COLUMNS : TERM_COLUMNS;
  const previewRows = validationResult.rows;
  const isPreviewTruncated = validationResult.previewTruncated;
  const previewErrorCount = previewRows.filter((row) => !row.valid).length;
  const filteredPreviewRows = showErrorOnly ? previewRows.filter((row) => !row.valid) : previewRows;
  const tableMinWidthClass = mode === 'term' ? 'min-w-[980px]' : 'min-w-[840px]';

  return (
    <div className="space-y-4 min-w-0">
      <p className="text-sm">
        {t('dictionary.upload.preview.summary', {
          success: validationResult.validCount,
          error: validationResult.errorCount,
          total: validationResult.totalCount,
        })}
      </p>
      {isPreviewTruncated && (
        <p className="text-xs text-muted-foreground">
          {t('dictionary.upload.preview.limitNotice', { max: previewRowLimit })}
        </p>
      )}
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showErrorOnly}
          onChange={(e) => onShowErrorOnlyChange(e.target.checked)}
        />
        {t('dictionary.upload.preview.errorOnly', { count: previewErrorCount })}
      </label>
      {validationResult.errorCount > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onErrorDownload}
          disabled={downloadingErrors}
        >
          <Download className="mr-1 h-4 w-4" />
          {downloadingErrors
            ? t('common.button.processing')
            : t('dictionary.upload.preview.downloadErrors')}
        </Button>
      )}

      <div className="max-h-[52vh] min-w-0 max-w-full overflow-auto rounded-md border">
        <Table className={cn('w-max min-w-full table-fixed', tableMinWidthClass)}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead className="w-[50px]">{t('dictionary.upload.preview.row')}</TableHead>
              {columns.map((col) => (
                <TableHead key={col} className={getColumnWidthClass(col)}>
                  {t(getColumnHeaderKey(col) as never)}
                </TableHead>
              ))}
              <TableHead className="w-[180px]">{t('dictionary.upload.preview.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPreviewRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 3}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {t('dictionary.upload.preview.emptyFiltered')}
                </TableCell>
              </TableRow>
            ) : (
              filteredPreviewRows.map((row) => (
                <TableRow key={row.rowNumber} className={cn(!row.valid && 'bg-destructive/10')}>
                  <TableCell className="align-top">
                    <input
                      type="checkbox"
                      checked={!excludedRows.has(row.rowNumber)}
                      disabled={!row.valid}
                      onChange={() => onToggleRow(row.rowNumber)}
                      aria-label={t('dictionary.upload.aria.selectRow', {
                        row: row.rowNumber,
                      })}
                    />
                  </TableCell>
                  <TableCell className="align-top text-muted-foreground">{row.rowNumber}</TableCell>
                  {columns.map((col) => (
                    <TableCell
                      key={col}
                      className={cn(
                        getColumnWidthClass(col),
                        'whitespace-pre-wrap break-all align-top text-sm',
                      )}
                    >
                      {row.data[col] ?? ''}
                    </TableCell>
                  ))}
                  <TableCell className="w-[180px] whitespace-normal break-words align-top">
                    {row.valid ? (
                      <span className="text-primary">&#10003;</span>
                    ) : (
                      <div>
                        <span className="text-destructive">&#10007;</span>
                        {row.errors.map((err, i) => (
                          <p key={i} className="text-xs text-destructive">
                            {err}
                          </p>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {validationResult.errorCount > 0 && (
        <p className="text-xs text-muted-foreground">{t('dictionary.upload.preview.errorNote')}</p>
      )}
      {saveCompletedWithErrors && saveResult && (
        <p className="text-xs text-primary">
          {t('dictionary.upload.preview.savedWithErrors', {
            saved: saveResult.savedCount,
            error: validationResult.errorCount,
          })}
        </p>
      )}
    </div>
  );
}
