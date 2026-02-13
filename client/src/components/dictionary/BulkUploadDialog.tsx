import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Upload, CheckCircle2, FileUp, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import Spinner from '@/components/ui/spinner';
import { validateDomainUpload, bulkSaveDomains, downloadDomainTemplate } from '@/api/domainApi';
import { validateTermUpload, bulkSaveTerms, downloadTermTemplate } from '@/api/termApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import type {
  BulkTermRow,
  BulkValidationResponse,
  BulkSaveResponse,
  DomainFormData,
} from '@/types/dictionary';

/** 최대 파일 크기 (5MB) */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** 지원하는 파일 확장자 */
const ACCEPTED_EXTENSIONS = ['.xlsx', '.csv'];

/** BulkUploadDialog 컴포넌트 props */
interface BulkUploadDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 업로드 모드 (도메인/용어) */
  mode: 'domain' | 'term';
  /** 선택된 사전 세트 ID */
  setId: string;
}

/** 도메인 데이터 컬럼 키 */
const DOMAIN_COLUMNS = ['logicalName', 'physicalType', 'description'] as const;

/** 용어 데이터 컬럼 키 */
const TERM_COLUMNS = ['logicalName', 'physicalName', 'domainLogicalName', 'description'] as const;

/**
 * 3-step 일괄 업로드 다이얼로그.
 *
 * 파일 선택(Step 1) → 미리보기/검증(Step 2) → 완료(Step 3) 흐름으로 동작한다.
 * mode prop에 따라 도메인/용어 업로드를 구분한다.
 */
export default function BulkUploadDialog({
  open,
  onOpenChange,
  mode,
  setId,
}: BulkUploadDialogProps) {
  const { teamId } = useParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  /** 현재 스텝 (1: 파일선택, 2: 미리보기, 3: 완료) */
  const [step, setStep] = useState<1 | 2 | 3>(1);
  /** 선택된 파일 */
  const [file, setFile] = useState<File | null>(null);
  /** 검증 결과 */
  const [validationResult, setValidationResult] = useState<BulkValidationResponse | null>(null);
  /** 선택된 행 번호 Set */
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  /** 저장 결과 */
  const [saveResult, setSaveResult] = useState<BulkSaveResponse | null>(null);
  /** 드래그 오버 상태 */
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const columns = mode === 'domain' ? DOMAIN_COLUMNS : TERM_COLUMNS;

  /**
   * 컬럼 키에 대응하는 i18n 헤더 텍스트를 반환한다.
   *
   * @param col 컬럼 키
   * @returns 번역된 헤더 텍스트
   */
  const getColumnHeader = (col: string): string => {
    const headerMap: Record<string, string> = {
      logicalName: t('dictionary.domain.table.logicalName'),
      physicalType: t('dictionary.domain.table.physicalType'),
      physicalName: t('dictionary.term.table.physicalName'),
      domainLogicalName: t('dictionary.term.table.domain'),
      description: t('dictionary.domain.table.description'),
    };
    return headerMap[col] ?? col;
  };

  const validateMutation = useMutation({
    mutationFn: (f: File) =>
      mode === 'domain'
        ? validateDomainUpload(teamId!, setId, f)
        : validateTermUpload(teamId!, setId, f),
    onSuccess: (result) => {
      setValidationResult(result);
      const validRowNumbers = new Set(result.rows.filter((r) => r.valid).map((r) => r.rowNumber));
      setSelectedRows(validRowNumbers);
      setStep(2);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.upload.toast.failed'))),
  });

  const saveMutation = useMutation({
    mutationFn: (): Promise<BulkSaveResponse> => {
      if (!validationResult) return Promise.reject(new Error('No validation result'));
      const selectedData = validationResult.rows
        .filter((r) => r.valid && selectedRows.has(r.rowNumber))
        .map((r) => r.data);
      if (mode === 'domain') {
        const rows: DomainFormData[] = selectedData.map((d) => ({
          logicalName: d.logicalName,
          physicalType: d.physicalType,
          description: d.description || undefined,
        }));
        return bulkSaveDomains(teamId!, setId, rows);
      } else {
        const rows: BulkTermRow[] = selectedData.map((d) => ({
          logicalName: d.logicalName,
          physicalName: d.physicalName,
          domainLogicalName: d.domainLogicalName || undefined,
          description: d.description || undefined,
        }));
        return bulkSaveTerms(teamId!, setId, rows);
      }
    },
    onSuccess: (result) => {
      setSaveResult(result);
      setStep(3);
      toast.success(t('dictionary.upload.toast.success'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.upload.toast.failed'))),
  });

  /**
   * 파일 유효성을 검사한다 (확장자, 크기).
   *
   * @param f 검사할 파일
   * @returns 유효하면 true
   */
  const validateFile = (f: File): boolean => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast.error(t('dictionary.upload.error.unsupportedFormat'));
      return false;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error(t('dictionary.upload.error.fileTooLarge'));
      return false;
    }
    return true;
  };

  /**
   * 파일 선택 핸들러.
   *
   * @param f 선택된 파일
   */
  const handleFileSelect = (f: File) => {
    if (validateFile(f)) {
      setFile(f);
    }
  };

  /** 드래그 앤 드롭 핸들러 */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  /** "다음" 클릭 — 서버 검증 요청 */
  const handleNext = () => {
    if (file) validateMutation.mutate(file);
  };

  /** 템플릿 다운로드 */
  const handleTemplateDownload = async () => {
    try {
      if (mode === 'domain') {
        await downloadDomainTemplate(teamId!, setId);
      } else {
        await downloadTermTemplate(teamId!, setId);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, t('dictionary.upload.toast.templateFailed')));
    }
  };

  /** 행 체크박스 토글 */
  const toggleRow = (rowNumber: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

  /** 다이얼로그 닫기 + 상태 초기화 */
  const handleClose = () => {
    onOpenChange(false);
    if (step === 3) {
      const key =
        mode === 'domain'
          ? queryKeys.dictionary.domains(teamId!, setId)
          : queryKeys.dictionary.terms(teamId!, setId);
      queryClient.invalidateQueries({ queryKey: key });
    }
    setTimeout(() => {
      setStep(1);
      setFile(null);
      setValidationResult(null);
      setSelectedRows(new Set());
      setSaveResult(null);
    }, 200);
  };

  const selectedValidCount = validationResult
    ? validationResult.rows.filter((r) => r.valid && selectedRows.has(r.rowNumber)).length
    : 0;

  const dialogTitle =
    mode === 'domain'
      ? t('dictionary.upload.dialogTitle.domain')
      : t('dictionary.upload.dialogTitle.term');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step === 2 ? 'sm:max-w-[700px]' : 'sm:max-w-[500px]'}>
        <DialogHeader>
          <DialogTitle>
            {dialogTitle}
            {step === 2 && ` — ${t('dictionary.upload.preview.title')}`}
            {step === 3 && ` — ${t('dictionary.upload.complete.title')}`}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: 파일 선택 */}
        {step === 1 && (
          <div className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              aria-label={t('dictionary.upload.aria.dropzone')}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                  e.target.value = '';
                }}
              />
              {file ? (
                <>
                  <FileUp className="h-10 w-10 text-primary mb-3" />
                  <p className="text-sm font-medium">
                    {t('dictionary.upload.dropzone.selected', { fileName: file.name })}
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground text-center">
                    {t('dictionary.upload.dropzone.title')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('dictionary.upload.dropzone.formats')}
                  </p>
                </>
              )}
            </div>

            <Button variant="link" className="px-0" onClick={handleTemplateDownload}>
              <Download className="h-4 w-4 mr-1" />
              {t('dictionary.upload.template')}
            </Button>
          </div>
        )}

        {/* Step 2: 미리보기 */}
        {step === 2 && validationResult && (
          <div className="space-y-4">
            <p className="text-sm">
              {t('dictionary.upload.preview.summary', {
                success: validationResult.validCount,
                error: validationResult.errorCount,
                total: validationResult.totalCount,
              })}
            </p>

            <div className="max-h-[400px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]" />
                    <TableHead className="w-[50px]">{t('dictionary.upload.preview.row')}</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col}>{getColumnHeader(col)}</TableHead>
                    ))}
                    <TableHead className="w-[60px]">
                      {t('dictionary.upload.preview.status')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationResult.rows.map((row) => (
                    <TableRow
                      key={row.rowNumber}
                      className={!row.valid ? 'bg-destructive/10' : undefined}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.rowNumber)}
                          disabled={!row.valid}
                          onChange={() => toggleRow(row.rowNumber)}
                          aria-label={t('dictionary.upload.aria.selectRow', {
                            row: row.rowNumber,
                          })}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                      {columns.map((col) => (
                        <TableCell key={col} className="text-sm">
                          {row.data[col] ?? ''}
                        </TableCell>
                      ))}
                      <TableCell>
                        {row.valid ? (
                          <span className="text-primary">✓</span>
                        ) : (
                          <div>
                            <span className="text-destructive">✗</span>
                            {row.errors.map((err, i) => (
                              <p key={i} className="text-xs text-destructive">
                                {err}
                              </p>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {validationResult.errorCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('dictionary.upload.preview.errorNote')}
              </p>
            )}
          </div>
        )}

        {/* Step 2: 검증 로딩 */}
        {step === 1 && validateMutation.isPending && (
          <Spinner text={t('dictionary.upload.validating')} />
        )}

        {/* Step 3: 완료 */}
        {step === 3 && saveResult && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-success" />
            <p className="text-lg font-medium">
              {t('dictionary.upload.complete.success', { count: saveResult.savedCount })}
            </p>
            {saveResult.failedCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {t('dictionary.upload.complete.excluded', { count: saveResult.failedCount })}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <>
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('common.button.cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={!file || validateMutation.isPending}
              >
                {validateMutation.isPending
                  ? t('dictionary.upload.validating')
                  : t('common.button.next')}
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                {t('common.button.previous')}
              </Button>
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('common.button.cancel')}
              </Button>
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={selectedValidCount === 0 || saveMutation.isPending}
              >
                {saveMutation.isPending
                  ? t('common.button.processing')
                  : t('dictionary.upload.save', { count: selectedValidCount })}
              </Button>
            </>
          )}
          {step === 3 && (
            <Button type="button" onClick={handleClose}>
              {t('common.button.close')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
