import type { ExportProgressStage } from '@/hooks/useExportDiagram';
import { useTranslation } from 'react-i18next';
import type { ExportProgressState } from '@/hooks/useExportDiagram';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** ExportProgressDialog 컴포넌트의 props. */
interface ExportProgressDialogProps {
  /** 현재 export 진행 상태 */
  progress: ExportProgressState;
}

/**
 * 다이어그램 export 진행 상태를 표시하는 모달 다이얼로그.
 *
 * export 작업이 진행되는 동안 현재 단계와 진행률을 보여주고, 사용자의 추가 입력을 막는다.
 *
 * @param props.progress 현재 export 진행 상태
 * @returns export 진행 다이얼로그 JSX
 */
export default function ExportProgressDialog({ progress }: ExportProgressDialogProps) {
  const { t } = useTranslation();
  const progressWidth = Math.max(progress.progressPercent, 0);

  const resolveStep = (stage: ExportProgressStage | null) => {
    switch (stage) {
      case 'preparing':
        return 'preparing';
      case 'rendering':
        return 'rendering';
      case 'encoding':
      case 'assembling':
        return 'finalizing';
      case 'downloading':
        return 'downloading';
      default:
        return null;
    }
  };

  const currentStep = resolveStep(progress.currentStage);
  const steps = [
    { id: 'preparing', label: t('erd.export.progress.stepPreparing') },
    { id: 'rendering', label: t('erd.export.progress.stepRendering') },
    { id: 'finalizing', label: t('erd.export.progress.stepFinalizing') },
    { id: 'downloading', label: t('erd.export.progress.stepDownloading') },
  ] as const;
  const currentStepIndex = currentStep ? steps.findIndex((step) => step.id === currentStep) : -1;

  return (
    <Dialog open={progress.isExporting}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader className="gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-xs font-semibold tracking-wide">
              {progress.formatLabel}
            </div>
            <div className="space-y-1 text-left">
              <DialogTitle>{`${progress.formatLabel} ${t('erd.toolbar.export')}`}</DialogTitle>
              <DialogDescription>{progress.stageLabel}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3" aria-live="polite">
          <div className="grid grid-cols-4 gap-2">
            {steps.map((step, index) => {
              const isCompleted = currentStepIndex > index;
              const isCurrent = currentStepIndex === index;

              return (
                <div key={step.id} className="space-y-2">
                  <div
                    className={cn(
                      'h-2 rounded-full',
                      isCompleted && 'bg-primary',
                      isCurrent && 'bg-primary/60',
                      !isCompleted && !isCurrent && 'bg-muted',
                    )}
                  />
                  <p
                    className={cn(
                      'text-[11px] font-medium',
                      isCompleted && 'text-foreground',
                      isCurrent && 'text-primary',
                      !isCompleted && !isCurrent && 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>

          {progress.mode === 'determinate' ? (
            <>
              <div
                className="bg-muted h-3 overflow-hidden rounded-full"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.progressPercent}
                aria-label={`${progress.formatLabel} ${t('erd.toolbar.export')}`}
              >
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>{progress.detailLabel}</span>
                <span>{progress.progressPercent}%</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">{progress.detailLabel}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
