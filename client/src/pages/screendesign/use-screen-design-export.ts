import { useRef, useState } from 'react';
import type Konva from 'konva';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  createExportProgressController,
  createIdleExportProgress,
} from '@/lib/export/export-progress';
import { downloadFile, waitForNextPaint } from '@/lib/export/export-core';
import type { ExportProgressState } from '@/lib/export/export-types';
import type { ScreenDesignScreen } from './screen-design-document';
import {
  buildScreenDesignPdfFilename,
  buildScreenDesignPngFilename,
  getScreenDesignExportPixelRatio,
  getScreenDesignPdfPageLayout,
} from './screen-design-export';

interface UseScreenDesignExportParams {
  /** 파일명에 사용할 문서 이름 */
  documentName: string;
  /** 문서에 포함된 화면 목록 */
  screens: ScreenDesignScreen[];
  /** 현재 선택된 화면 */
  selectedScreen: ScreenDesignScreen | null;
  /** 화면별 offscreen export stage 조회기 */
  getStage: (screenId: string) => Konva.Stage | null;
}

interface UseScreenDesignExportResult {
  /** 현재 화면 PNG export */
  exportPng: () => Promise<void>;
  /** 전체 화면 PDF export */
  exportPdf: () => Promise<void>;
  /** export 진행 상태 */
  exportProgress: ExportProgressState;
}

/**
 * 화면기획 문서의 PNG/PDF export 동작을 제공한다.
 *
 * @param params 화면기획 export 파라미터
 * @returns PNG/PDF export 액션과 진행 상태
 */
export function useScreenDesignExport({
  documentName,
  screens,
  selectedScreen,
  getStage,
}: UseScreenDesignExportParams): UseScreenDesignExportResult {
  const { t } = useTranslation();
  const jsPdfModulePromiseRef = useRef<Promise<typeof import('jspdf')> | null>(null);
  const exportInFlightRef = useRef(false);
  const [exportProgress, setExportProgress] =
    useState<ExportProgressState>(createIdleExportProgress);

  /**
   * export 진행 메시지 번역 함수를 래핑한다.
   *
   * @param key 번역 키
   * @param values 번역 변수
   * @returns 번역된 문자열
   */
  const translateProgress = (key: string, values?: Record<string, number | string>) =>
    String(t(key as never, values as never));

  const progress = createExportProgressController({
    setExportProgress,
    exportInFlightRef,
    translateProgress,
    onAlreadyInProgress: () => {
      toast.info(t('screenSpec.export.inProgress'));
    },
    beginStageKey: 'screenSpec.export.progress.preparing',
    beginDetailKey: 'screenSpec.export.progress.preparingDocument',
    failStageKey: 'screenSpec.export.progress.failed',
    failDetailKey: 'screenSpec.export.progress.retryLater',
  });

  /**
   * jsPDF 모듈을 lazy import하고 재사용한다.
   *
   * @returns jsPDF 모듈 promise
   */
  const getJsPdfModule = async () => {
    if (!jsPdfModulePromiseRef.current) {
      jsPdfModulePromiseRef.current = import('jspdf');
    }
    return jsPdfModulePromiseRef.current;
  };

  /**
   * export용 offscreen stage가 준비될 때까지 잠시 재시도한다.
   *
   * @param screenId stage를 기다릴 screen id
   * @returns 찾은 Konva stage 또는 null
   */
  const waitForStage = async (screenId: string): Promise<Konva.Stage | null> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const stage = getStage(screenId);
      if (stage) {
        return stage;
      }
      await waitForNextPaint();
    }
    return null;
  };

  /**
   * 현재 선택 화면을 PNG로 export한다.
   *
   * @returns 없음
   */
  const exportPng = async () => {
    if (!selectedScreen) {
      toast.error(t('screenSpec.export.noScreens'));
      return;
    }

    try {
      const canStart = await progress.beginExport('png');
      if (!canStart) {
        return;
      }

      await progress.updateExportProgress({
        format: 'png',
        stage: 'rendering',
        stageKey: 'screenSpec.export.progress.rendering',
        detailKey: 'screenSpec.export.progress.renderingScreen',
        detailValues: {
          screen: selectedScreen.name,
        },
        yieldAfter: true,
      });
      const stage = await waitForStage(selectedScreen.id);
      if (!stage) {
        throw new Error('Missing screen export stage');
      }
      const dataUrl = stage.toDataURL({
        pixelRatio: getScreenDesignExportPixelRatio(selectedScreen),
      });

      await progress.updateExportProgress({
        format: 'png',
        stage: 'downloading',
        stageKey: 'screenSpec.export.progress.downloading',
        detailKey: 'screenSpec.export.progress.downloadReady',
        yieldAfter: true,
      });
      downloadFile(dataUrl, buildScreenDesignPngFilename(documentName, selectedScreen.name), false);
      await progress.finishExportProgress();
      toast.success(t('screenSpec.export.pngSuccess', { screen: selectedScreen.name }));
    } catch {
      await progress.failExportProgress('png');
      toast.error(t('screenSpec.export.failed'));
    }
  };

  /**
   * 전체 화면을 PDF로 export한다.
   *
   * @returns 없음
   */
  const exportPdf = async () => {
    if (screens.length === 0) {
      toast.error(t('screenSpec.export.noScreens'));
      return;
    }

    try {
      const canStart = await progress.beginExport('pdf');
      if (!canStart) {
        return;
      }

      await progress.updateExportProgress({
        format: 'pdf',
        mode: 'determinate',
        stage: 'preparing',
        progressPercent: 0,
        stageKey: 'screenSpec.export.progress.preparing',
        detailKey: 'screenSpec.export.progress.collectingScreens',
        detailValues: {
          count: screens.length,
        },
        yieldAfter: true,
      });

      const { jsPDF } = await getJsPdfModule();
      let doc: InstanceType<typeof jsPDF> | null = null;

      for (const [index, screen] of screens.entries()) {
        const current = index + 1;
        const renderProgress = Math.round(((current - 1) / screens.length) * 100);
        await progress.updateExportProgress({
          format: 'pdf',
          mode: 'determinate',
          stage: 'rendering',
          progressPercent: renderProgress,
          stageKey: 'screenSpec.export.progress.rendering',
          detailKey: 'screenSpec.export.progress.renderingPage',
          detailValues: {
            current,
            total: screens.length,
            screen: screen.name,
          },
          yieldAfter: true,
        });

        const stage = await waitForStage(screen.id);
        if (!stage) {
          throw new Error(`Missing export stage for ${screen.id}`);
        }
        const dataUrl = stage.toDataURL({
          pixelRatio: getScreenDesignExportPixelRatio(screen),
        });
        const { pageWidth, pageHeight, orientation } = getScreenDesignPdfPageLayout(screen);

        if (!doc) {
          doc = new jsPDF({
            orientation,
            unit: 'px',
            format: [pageWidth, pageHeight],
            compress: true,
          });
        } else {
          doc.addPage([pageWidth, pageHeight], orientation);
        }

        await progress.updateExportProgress({
          format: 'pdf',
          mode: 'determinate',
          stage: 'assembling',
          progressPercent: Math.round((current / screens.length) * 100),
          stageKey: 'screenSpec.export.progress.assembling',
          detailKey: 'screenSpec.export.progress.pdfPage',
          detailValues: {
            current,
            total: screens.length,
          },
          yieldAfter: true,
        });
        doc.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
      }

      if (!doc) {
        throw new Error('PDF document was not initialized');
      }

      await progress.updateExportProgress({
        format: 'pdf',
        stage: 'downloading',
        stageKey: 'screenSpec.export.progress.downloading',
        detailKey: 'screenSpec.export.progress.downloadReady',
        yieldAfter: true,
      });
      doc.save(buildScreenDesignPdfFilename(documentName));
      await progress.finishExportProgress();
      toast.success(t('screenSpec.export.pdfSuccess', { count: screens.length }));
    } catch {
      await progress.failExportProgress('pdf');
      toast.error(t('screenSpec.export.failed'));
    }
  };

  return {
    exportPng,
    exportPdf,
    exportProgress,
  };
}
