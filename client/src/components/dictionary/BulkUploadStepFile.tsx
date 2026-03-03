import { Upload, FileUp, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** BulkUploadStepFile 컴포넌트 props */
interface BulkUploadStepFileProps {
  /** 선택된 파일 (null이면 미선택) */
  file: File | null;
  /** 드래그 오버 상태 */
  dragOver: boolean;
  /** 드래그 오버 상태 변경 핸들러 */
  onDragOverChange: (over: boolean) => void;
  /** 파일 드롭 핸들러 */
  onDrop: (e: React.DragEvent) => void;
  /** 파일 선택 핸들러 */
  onFileSelect: (f: File) => void;
  /** 템플릿 다운로드 핸들러 */
  onTemplateDownload: () => void;
  /** 파일 input ref */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * 대량 업로드 Step 1 — 파일 선택 + 드래그앤드롭 영역.
 *
 * @param props 파일 선택 관련 상태 및 콜백
 * @returns Step 1 JSX
 */
export default function BulkUploadStepFile({
  file,
  dragOver,
  onDragOverChange,
  onDrop,
  onFileSelect,
  onTemplateDownload,
  fileInputRef,
}: BulkUploadStepFileProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label={t('dictionary.upload.aria.dropzone')}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
          dragOver ? 'border-primary bg-accent' : 'border-border hover:border-primary/50',
        )}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOverChange(true);
        }}
        onDragLeave={() => onDragOverChange(false)}
        onDrop={onDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFileSelect(f);
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

      <Button variant="link" className="px-0" onClick={onTemplateDownload}>
        <Download className="h-4 w-4 mr-1" />
        {t('dictionary.upload.template')}
      </Button>
    </div>
  );
}
