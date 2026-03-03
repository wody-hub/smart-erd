import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import BulkUploadStepFile from './BulkUploadStepFile';
import BulkUploadStepPreview from './BulkUploadStepPreview';
import BulkUploadStepComplete from './BulkUploadStepComplete';
import {
  validateDomainUpload,
  bulkSaveDomains,
  downloadDomainTemplate,
  downloadDomainUploadErrors,
} from '@/api/domainApi';
import {
  validateTermUpload,
  bulkSaveTerms,
  downloadTermTemplate,
  downloadTermUploadErrors,
} from '@/api/termApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import type { BulkValidationResponse, BulkSaveResponse } from '@/types/dictionary';

/** 최대 파일 크기 (50MB) */
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

/** 대량 업로드에서 미리보기 렌더링 최대 행 수 */
const PREVIEW_ROW_LIMIT = 2000;

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
  /** 저장에서 제외할 행 번호 Set (valid row만 토글 가능) */
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  /** 오류 행만 보기 토글 */
  const [showErrorOnly, setShowErrorOnly] = useState(false);
  /** 저장 결과 */
  const [saveResult, setSaveResult] = useState<BulkSaveResponse | null>(null);
  /** 오류가 있는 상태에서 저장이 완료되었는지 여부 */
  const [saveCompletedWithErrors, setSaveCompletedWithErrors] = useState(false);
  /** 오류 엑셀 다운로드 진행 여부 */
  const [downloadingErrors, setDownloadingErrors] = useState(false);
  /** 드래그 오버 상태 */
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateMutation = useMutation({
    mutationFn: (f: File) =>
      mode === 'domain'
        ? validateDomainUpload(teamId!, setId, f)
        : validateTermUpload(teamId!, setId, f),
    onSuccess: (result) => {
      setValidationResult(result);
      setExcludedRows(new Set());
      setShowErrorOnly(false);
      setSaveResult(null);
      setSaveCompletedWithErrors(false);
      setStep(2);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.upload.toast.failed'))),
  });

  const saveMutation = useMutation({
    mutationFn: (): Promise<BulkSaveResponse> => {
      if (!validationResult) return Promise.reject(new Error('No validation result'));
      const excludedRowNumbers = Array.from(excludedRows.values());
      if (mode === 'domain') {
        return bulkSaveDomains(
          teamId!,
          setId,
          validationResult.validationToken,
          excludedRowNumbers,
        );
      } else {
        return bulkSaveTerms(teamId!, setId, validationResult.validationToken, excludedRowNumbers);
      }
    },
    onSuccess: (result) => {
      setSaveResult(result);
      if ((validationResult?.errorCount ?? 0) > 0) {
        setShowErrorOnly(true);
        setSaveCompletedWithErrors(true);
        toast.success(
          t('dictionary.upload.toast.partialSaved', {
            count: result.savedCount,
          }),
        );
      } else {
        setStep(3);
        toast.success(t('dictionary.upload.toast.success'));
      }
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
      toast.error(t('dictionary.upload.error.fileTooLarge', { max: MAX_FILE_SIZE_MB }));
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

  /** 오류 엑셀 다운로드 */
  const handleErrorDownload = async () => {
    if (!validationResult) return;
    setDownloadingErrors(true);
    try {
      if (mode === 'domain') {
        await downloadDomainUploadErrors(teamId!, setId, validationResult.validationToken);
      } else {
        await downloadTermUploadErrors(teamId!, setId, validationResult.validationToken);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, t('dictionary.upload.toast.errorDownloadFailed')));
    } finally {
      setDownloadingErrors(false);
    }
  };

  /** 행 체크박스 토글 */
  const toggleRow = (rowNumber: number) => {
    setExcludedRows((prev) => {
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
    if (saveResult) {
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
      setExcludedRows(new Set());
      setShowErrorOnly(false);
      setSaveResult(null);
      setSaveCompletedWithErrors(false);
      setDownloadingErrors(false);
    }, 200);
  };

  const selectedValidCount = validationResult
    ? Math.max(0, validationResult.validCount - excludedRows.size)
    : 0;

  const dialogTitle =
    mode === 'domain'
      ? t('dictionary.upload.dialogTitle.domain')
      : t('dictionary.upload.dialogTitle.term');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={
          step === 2
            ? 'w-[calc(100vw-2rem)] max-w-[1100px] overflow-hidden sm:max-w-[1100px]'
            : 'sm:max-w-[500px]'
        }
      >
        <DialogHeader>
          <DialogTitle>
            {dialogTitle}
            {step === 2 && ` — ${t('dictionary.upload.preview.title')}`}
            {step === 3 && ` — ${t('dictionary.upload.complete.title')}`}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: 파일 선택 */}
        {step === 1 && (
          <BulkUploadStepFile
            file={file}
            dragOver={dragOver}
            onDragOverChange={setDragOver}
            onDrop={handleDrop}
            onFileSelect={handleFileSelect}
            onTemplateDownload={handleTemplateDownload}
            fileInputRef={fileInputRef}
          />
        )}

        {/* Step 2: 미리보기 */}
        {step === 2 && validationResult && (
          <BulkUploadStepPreview
            mode={mode}
            validationResult={validationResult}
            excludedRows={excludedRows}
            onToggleRow={toggleRow}
            showErrorOnly={showErrorOnly}
            onShowErrorOnlyChange={setShowErrorOnly}
            onErrorDownload={handleErrorDownload}
            downloadingErrors={downloadingErrors}
            saveCompletedWithErrors={saveCompletedWithErrors}
            saveResult={saveResult}
            previewRowLimit={PREVIEW_ROW_LIMIT}
          />
        )}

        {/* Step 2: 검증 로딩 */}
        {step === 1 && validateMutation.isPending && (
          <Spinner text={t('dictionary.upload.validating')} />
        )}

        {/* Step 3: 완료 */}
        {step === 3 && saveResult && <BulkUploadStepComplete saveResult={saveResult} />}

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
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={saveCompletedWithErrors}
              >
                {t('common.button.previous')}
              </Button>
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('common.button.cancel')}
              </Button>
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={
                  selectedValidCount === 0 || saveMutation.isPending || saveCompletedWithErrors
                }
              >
                {saveMutation.isPending
                  ? t('common.button.processing')
                  : saveCompletedWithErrors
                    ? t('dictionary.upload.saved')
                    : t('dictionary.upload.saveExcludingErrors', { count: selectedValidCount })}
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
