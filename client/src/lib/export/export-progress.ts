import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { waitForDelay, waitForNextPaint } from './export-core';
import type {
  ExportFormat,
  ExportProgressController,
  ExportProgressState,
  UpdateExportProgressOptions,
} from './export-types';

/** 완료 상태를 잠시 보여줄 시간(ms) */
const EXPORT_PROGRESS_COMPLETE_DELAY_MS = 240;

/** 진행 상태 번역기 */
type TranslateProgress = (key: string, values?: Record<string, number | string>) => string;

/** 진행 상태 제어기 생성 옵션 */
interface CreateExportProgressControllerOptions {
  /** React state setter */
  setExportProgress: Dispatch<SetStateAction<ExportProgressState>>;
  /** 현재 export 중복 실행 제어 ref */
  exportInFlightRef: MutableRefObject<boolean>;
  /** 번역 함수 래퍼 */
  translateProgress: TranslateProgress;
  /** 이미 export 중일 때 호출할 핸들러 */
  onAlreadyInProgress: () => void;
}

/** 비활성 상태의 export 진행 정보를 만든다. */
export const createIdleExportProgress = (): ExportProgressState => ({
  isExporting: false,
  format: null,
  formatLabel: '',
  mode: 'indeterminate',
  progressPercent: 0,
  currentStage: null,
  stageLabel: '',
  detailLabel: '',
});

/** 진행 상태 제어기를 생성한다. */
export const createExportProgressController = ({
  setExportProgress,
  exportInFlightRef,
  translateProgress,
  onAlreadyInProgress,
}: CreateExportProgressControllerOptions): ExportProgressController => {
  const getFormatLabel = (format: ExportFormat) => format.toUpperCase();

  const updateExportProgress = async ({
    format,
    mode = 'indeterminate',
    stage,
    progressPercent = 0,
    stageKey,
    detailKey,
    detailValues,
    yieldAfter = false,
  }: UpdateExportProgressOptions) => {
    setExportProgress({
      isExporting: true,
      format,
      formatLabel: getFormatLabel(format),
      mode,
      progressPercent:
        mode === 'determinate' ? Math.max(0, Math.min(100, Math.round(progressPercent))) : 0,
      currentStage: stage,
      stageLabel: translateProgress(stageKey),
      detailLabel: detailKey ? translateProgress(detailKey, detailValues) : '',
    });

    if (yieldAfter) {
      await waitForNextPaint();
    }
  };

  const resetExportProgress = () => {
    exportInFlightRef.current = false;
    setExportProgress(createIdleExportProgress());
  };

  const beginExport = async (format: ExportFormat) => {
    if (exportInFlightRef.current) {
      onAlreadyInProgress();
      return false;
    }

    exportInFlightRef.current = true;
    await updateExportProgress({
      format,
      stage: 'preparing',
      stageKey: 'erd.export.progress.preparing',
      detailKey: 'erd.export.progress.preparingDiagram',
      yieldAfter: true,
    });
    return true;
  };

  const finishExportProgress = async () => {
    await waitForDelay(EXPORT_PROGRESS_COMPLETE_DELAY_MS);
    resetExportProgress();
  };

  const failExportProgress = async (format: ExportFormat) => {
    await updateExportProgress({
      format,
      stage: 'failed',
      stageKey: 'erd.export.progress.failed',
      detailKey: 'erd.export.progress.retryLater',
      yieldAfter: true,
    });
    await finishExportProgress();
  };

  return {
    beginExport,
    updateExportProgress,
    finishExportProgress,
    failExportProgress,
    resetExportProgress,
  };
};
