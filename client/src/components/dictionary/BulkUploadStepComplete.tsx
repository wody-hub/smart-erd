import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { BulkSaveResponse } from '@/types/dictionary';

/** BulkUploadStepComplete 컴포넌트 props */
interface BulkUploadStepCompleteProps {
  /** 저장 결과 */
  saveResult: BulkSaveResponse;
}

/**
 * 대량 업로드 Step 3 — 완료 결과 표시.
 *
 * @param props.saveResult 저장 결과
 * @returns Step 3 JSX
 */
export default function BulkUploadStepComplete({ saveResult }: BulkUploadStepCompleteProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center py-8 space-y-4">
      <CheckCircle2 className="h-16 w-16 text-success" aria-hidden="true" />
      <p className="text-lg font-medium">
        {t('dictionary.upload.complete.success', { count: saveResult.savedCount })}
      </p>
      {saveResult.failedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('dictionary.upload.complete.excluded', { count: saveResult.failedCount })}
        </p>
      )}
    </div>
  );
}
