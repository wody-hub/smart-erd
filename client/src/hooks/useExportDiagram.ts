import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';
import {
  exportImageDiagram,
  exportPdfDiagram,
  exportSvgDiagram,
  type ImageExportResult,
  type PdfExportResult,
} from '@/lib/export/export-executors';
import { isCanvasLimited } from '@/lib/export/export-core';
import {
  createExportProgressController,
  createIdleExportProgress,
} from '@/lib/export/export-progress';
import type { CaptureOptions, ExportFormat, ExportProgressState } from '@/lib/export/export-types';

export type {
  ExportFormat,
  ExportProgressMode,
  ExportProgressStage,
  ExportProgressState,
} from '@/lib/export/export-types';

/** fitView 패딩 비율 */
const PADDING = 0.15;
/** 최소 줌 레벨 */
const MIN_ZOOM = 0.5;
/** 최대 줌 레벨 */
const MAX_ZOOM = 2;
/** 노드 바운드 주변 여백 (px) */
const BOUND_PADDING = 50;

/**
 * 다이어그램 Export 훅.
 *
 * React Flow의 노드 바운드를 계산하여 PNG/JPG/SVG/PDF로 내보낸다.
 * 현재 줌/팬 상태와 무관하게 모든 노드를 포함하는 이미지를 생성한다.
 *
 * @param diagramName 파일명에 사용할 다이어그램 이름
 * @returns export 함수 4종 (exportPng, exportJpg, exportSvg, exportPdf)
 */
export function useExportDiagram(diagramName: string) {
  const { t } = useTranslation();
  const { getNodes } = useReactFlow();
  const htmlToImageModulePromiseRef = useRef<Promise<typeof import('html-to-image')> | null>(null);
  const jsPdfModulePromiseRef = useRef<Promise<typeof import('jspdf')> | null>(null);
  const fontEmbedCssPromiseRef = useRef<Promise<string> | null>(null);
  const exportInFlightRef = useRef(false);
  const [exportProgress, setExportProgress] = useState<ExportProgressState>(
    createIdleExportProgress,
  );

  const translateProgress = (key: string, values?: Record<string, number | string>) =>
    String(t(key as never, values as never));

  const progress = createExportProgressController({
    setExportProgress,
    exportInFlightRef,
    translateProgress,
    onAlreadyInProgress: () => {
      toast.info(t('erd.export.inProgress'));
    },
  });

  const getHtmlToImageModule = async () => {
    if (!htmlToImageModulePromiseRef.current) {
      htmlToImageModulePromiseRef.current = import('html-to-image');
    }
    return htmlToImageModulePromiseRef.current;
  };

  const getJsPdfModule = async () => {
    if (!jsPdfModulePromiseRef.current) {
      jsPdfModulePromiseRef.current = import('jspdf');
    }
    return jsPdfModulePromiseRef.current;
  };

  /** export 대상에 사용할 폰트 임베드 CSS를 캐시한다. */
  const getFontEmbedCss = async (viewportEl: HTMLElement) => {
    if (!fontEmbedCssPromiseRef.current) {
      fontEmbedCssPromiseRef.current = getHtmlToImageModule().then(({ getFontEmbedCSS }) =>
        getFontEmbedCSS(viewportEl),
      );
    }

    try {
      return await fontEmbedCssPromiseRef.current;
    } catch (error) {
      fontEmbedCssPromiseRef.current = null;
      throw error;
    }
  };

  /**
   * 공통 캡처 옵션을 계산한다.
   *
   * 모든 노드의 바운드에 맞는 이미지 크기와 CSS transform을 반환한다.
   * 노드가 없거나 뷰포트 요소가 없으면 null을 반환한다.
   *
   * @returns 캡처 옵션 또는 null
   */
  const getCaptureOptions = (): CaptureOptions | null => {
    const nodes = getNodes();
    if (nodes.length === 0) {
      toast.error(t('erd.export.noNodes'));
      return null;
    }

    const nodesBounds = getNodesBounds(nodes);
    const imageWidth = Math.ceil(nodesBounds.width + BOUND_PADDING * 2);
    const imageHeight = Math.ceil(nodesBounds.height + BOUND_PADDING * 2);
    const viewport = getViewportForBounds(
      nodesBounds,
      imageWidth,
      imageHeight,
      MIN_ZOOM,
      MAX_ZOOM,
      PADDING,
    );

    const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport');
    if (!viewportEl) {
      return null;
    }

    return {
      viewportEl,
      imageWidth,
      imageHeight,
      viewport,
    };
  };

  /** 공통 이미지 export 후처리를 수행한다. */
  const handleImageExportSuccess = ({ imageWidth, imageHeight }: ImageExportResult) => {
    toast.success(t('erd.export.success'));
    if (isCanvasLimited(imageWidth, imageHeight)) {
      toast.info(t('erd.export.largeDiagramHint'));
    }
  };

  /** PDF export 후처리를 수행한다. */
  const handlePdfExportSuccess = ({ tiledPageCount }: PdfExportResult) => {
    toast.success(t('erd.export.success'));
    if (tiledPageCount > 0) {
      toast.info(t('erd.export.pdfTiled', { count: tiledPageCount }));
    }
  };

  /** 포맷별 export 실행과 공통 성공/실패 처리를 감싼다. */
  const runExport = async <Result,>(
    format: ExportFormat,
    execute: (opts: CaptureOptions) => Promise<Result>,
    onSuccess: (result: Result) => void,
  ) => {
    const opts = getCaptureOptions();
    if (!opts) {
      return;
    }

    try {
      const canStart = await progress.beginExport(format);
      if (!canStart) {
        return;
      }

      const result = await execute(opts);
      await progress.finishExportProgress();
      onSuccess(result);
    } catch {
      await progress.failExportProgress(format);
      toast.error(t('erd.export.failed'));
    }
  };

  /** PNG 포맷으로 다이어그램을 내보낸다. */
  const exportPng = async () =>
    runExport(
      'png',
      (opts) =>
        exportImageDiagram({
          filename: `${diagramName}.png`,
          opts,
          format: 'png',
          mimeType: 'image/png',
          progress,
          getHtmlToImageModule,
          getFontEmbedCss,
        }),
      handleImageExportSuccess,
    );

  /** JPG 포맷으로 다이어그램을 내보낸다. */
  const exportJpg = async () =>
    runExport(
      'jpg',
      (opts) =>
        exportImageDiagram({
          filename: `${diagramName}.jpg`,
          opts,
          format: 'jpg',
          mimeType: 'image/jpeg',
          quality: 0.95,
          progress,
          getHtmlToImageModule,
          getFontEmbedCss,
        }),
      handleImageExportSuccess,
    );

  /** SVG 포맷으로 다이어그램을 내보낸다. */
  const exportSvg = async () =>
    runExport(
      'svg',
      (opts) =>
        exportSvgDiagram({
          filename: `${diagramName}.svg`,
          opts,
          progress,
          getHtmlToImageModule,
          getFontEmbedCss,
        }),
      () => {
        toast.success(t('erd.export.success'));
      },
    );

  /** PDF 포맷으로 다이어그램을 내보낸다. */
  const exportPdf = async () =>
    runExport(
      'pdf',
      (opts) =>
        exportPdfDiagram({
          filename: `${diagramName}.pdf`,
          opts,
          progress,
          getHtmlToImageModule,
          getJsPdfModule,
          getFontEmbedCss,
        }),
      handlePdfExportSuccess,
    );

  return { exportPng, exportJpg, exportSvg, exportPdf, exportProgress };
}
