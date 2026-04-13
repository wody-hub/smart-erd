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
  /** export 시작 단계 제목 번역 키 */
  beginStageKey?: string;
  /** export 시작 단계 설명 번역 키 */
  beginDetailKey?: string;
  /** export 실패 단계 제목 번역 키 */
  failStageKey?: string;
  /** export 실패 단계 설명 번역 키 */
  failDetailKey?: string;
}

/**
 * 비활성 상태의 export 진행 정보를 만든다.
 *
 * @returns 초기 idle export 상태
 */
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

/**
 * export 진행 상태 제어기를 생성한다.
 *
 * @param options 진행 상태 제어기 생성 옵션
 * @returns export 진행 상태 제어기
 */
export const createExportProgressController = ({
  setExportProgress,
  exportInFlightRef,
  translateProgress,
  onAlreadyInProgress,
  beginStageKey = 'erd.export.progress.preparing',
  beginDetailKey = 'erd.export.progress.preparingDiagram',
  failStageKey = 'erd.export.progress.failed',
  failDetailKey = 'erd.export.progress.retryLater',
}: CreateExportProgressControllerOptions): ExportProgressController => {
  /**
   * export 포맷을 다이얼로그 표시용 라벨로 변환한다.
   *
   * @param format export 포맷
   * @returns 표시용 포맷 라벨
   */
  const getFormatLabel = (format: ExportFormat) => format.toUpperCase();

  /**
   * 현재 export 진행 상태를 갱신한다.
   *
   * @param options 갱신할 export 진행 상태 옵션
   * @returns 필요 시 다음 paint까지 대기한 뒤 종료한다
   */
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

  /**
   * export 진행 상태와 중복 실행 플래그를 초기화한다.
   *
   * @returns 없음
   */
  const resetExportProgress = () => {
    exportInFlightRef.current = false;
    setExportProgress(createIdleExportProgress());
  };

  /**
   * export를 시작하고 초기 진행 상태를 표시한다.
   *
   * @param format 시작할 export 포맷
   * @returns 실제로 export를 시작했는지 여부
   */
  const beginExport = async (format: ExportFormat) => {
    if (exportInFlightRef.current) {
      onAlreadyInProgress();
      return false;
    }

    exportInFlightRef.current = true;
    await updateExportProgress({
      format,
      stage: 'preparing',
      stageKey: beginStageKey,
      detailKey: beginDetailKey,
      yieldAfter: true,
    });
    return true;
  };

  /**
   * 완료 상태를 잠시 보여준 뒤 진행 상태를 초기화한다.
   *
   * @returns 없음
   */
  const finishExportProgress = async () => {
    await waitForDelay(EXPORT_PROGRESS_COMPLETE_DELAY_MS);
    resetExportProgress();
  };

  /**
   * 실패 상태를 표시한 뒤 진행 상태를 초기화한다.
   *
   * @param format 실패한 export 포맷
   * @returns 없음
   */
  const failExportProgress = async (format: ExportFormat) => {
    await updateExportProgress({
      format,
      stage: 'failed',
      stageKey: failStageKey,
      detailKey: failDetailKey,
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
