import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';

/** fitView 패딩 비율 */
const PADDING = 0.15;
/** 최소 줌 레벨 */
const MIN_ZOOM = 0.5;
/** 최대 줌 레벨 */
const MAX_ZOOM = 2;
/** 노드 바운드 주변 여백 (px) */
const BOUND_PADDING = 50;
/** 브라우저 캔버스 단일 축 최대 크기 (html-to-image 내부 제한과 동일) */
const MAX_CANVAS_DIMENSION = 16384;
/** 기본 목표 해상도 배율 */
const TARGET_PIXEL_RATIO = 2;
/** Blob URL 정리 지연 시간(ms) */
const OBJECT_URL_REVOKE_DELAY_MS = 1000;
/** 대형 다이어그램 PDF 타일 폭(px) */
const PDF_TILE_WIDTH = 6000;
/** 대형 다이어그램 PDF 타일 높이(px) */
const PDF_TILE_HEIGHT = 4000;
/** 단일 페이지 PDF를 유지하기 위한 최소 렌더 배율 */
const PDF_SINGLE_PAGE_MIN_PIXEL_RATIO = 1.25;
/** 단일 페이지 PDF 렌더에 허용할 최대 캔버스 면적(px^2) */
const PDF_SINGLE_PAGE_MAX_AREA = 67_000_000;
/** 디자인 토큰 기반 export 배경색 fallback */
const EXPORT_BACKGROUND_FALLBACK = 'hsl(0 0% 100%)';
/** 완료 상태를 잠시 보여줄 시간(ms) */
const EXPORT_PROGRESS_COMPLETE_DELAY_MS = 240;

/** 지원하는 export 포맷 */
export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf';
/** export 진행 표시 방식 */
export type ExportProgressMode = 'indeterminate' | 'determinate';
/** export 진행 단계 */
export type ExportProgressStage =
  | 'preparing'
  | 'rendering'
  | 'encoding'
  | 'assembling'
  | 'downloading'
  | 'failed';

/** 현재 export 진행 상태 */
export interface ExportProgressState {
  /** export 진행 여부 */
  isExporting: boolean;
  /** 현재 export 포맷 */
  format: ExportFormat | null;
  /** 화면 표시에 사용할 포맷 라벨 */
  formatLabel: string;
  /** 진행 표시 방식 */
  mode: ExportProgressMode;
  /** 진행률(0~100) */
  progressPercent: number;
  /** 현재 진행 단계 */
  currentStage: ExportProgressStage | null;
  /** 현재 단계 제목 */
  stageLabel: string;
  /** 현재 단계 상세 설명 */
  detailLabel: string;
}

/** export 진행 상태 갱신 옵션 */
interface UpdateExportProgressOptions {
  /** 현재 export 포맷 */
  format: ExportFormat;
  /** 진행 표시 방식 */
  mode?: ExportProgressMode;
  /** 현재 진행 단계 */
  stage: ExportProgressStage;
  /** 진행률(0~100) */
  progressPercent?: number;
  /** 단계 제목 번역 키 */
  stageKey: string;
  /** 단계 설명 번역 키 */
  detailKey?: string;
  /** 단계 설명 보간 값 */
  detailValues?: Record<string, number | string>;
  /** 상태 반영 후 다음 페인트까지 대기할지 여부 */
  yieldAfter?: boolean;
}

/** 현재 테마의 배경 토큰을 캡처용 배경색으로 변환한다. */
const getExportBackgroundColor = (): string => {
  const token = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
  if (!token) {
    return EXPORT_BACKGROUND_FALLBACK;
  }
  return `hsl(${token})`;
};

/** 캡처 옵션 (뷰포트 요소 + 이미지 크기 + CSS transform) */
interface CaptureOptions {
  /** .react-flow__viewport DOM 요소 */
  viewportEl: HTMLElement;
  /** 이미지 너비 */
  imageWidth: number;
  /** 이미지 높이 */
  imageHeight: number;
  /** 뷰포트 transform 스타일 */
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

/** html-to-image 공통 렌더 옵션 구성값 */
interface RenderConfigOptions {
  /** 렌더 대상 너비 */
  width: number;
  /** 렌더 대상 높이 */
  height: number;
  /** 캡처 시 X 오프셋 */
  offsetX?: number;
  /** 캡처 시 Y 오프셋 */
  offsetY?: number;
  /** 출력 픽셀 비율 */
  pixelRatio?: number;
  /** JPEG 품질 */
  quality?: number;
  /** 강제 이미지 타입 */
  type?: string;
}

const createIdleExportProgress = (): ExportProgressState => ({
  isExporting: false,
  format: null,
  formatLabel: '',
  mode: 'indeterminate',
  progressPercent: 0,
  currentStage: null,
  stageLabel: '',
  detailLabel: '',
});

/** React가 진행 UI를 먼저 그릴 수 있도록 다음 페인트까지 양보한다. */
const waitForNextPaint = async (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      window.setTimeout(resolve, 0);
    });
  });

/** 지정한 시간만큼 비동기 대기한다. */
const waitForDelay = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

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

  const getFormatLabel = (format: ExportFormat) => format.toUpperCase();
  const translateProgress = (key: string, values?: Record<string, number | string>) =>
    String(t(key as never, values as never));

  /** 진행 상태를 갱신하고 필요하면 다음 페인트까지 기다린다. */
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

  /** 현재 export 진행 상태를 초기화한다. */
  const resetExportProgress = () => {
    exportInFlightRef.current = false;
    setExportProgress(createIdleExportProgress());
  };

  /** export를 시작하고 진행 UI를 먼저 그린다. */
  const beginExport = async (format: ExportFormat) => {
    if (exportInFlightRef.current) {
      toast.info(t('erd.export.inProgress'));
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

  /** 완료 상태를 잠깐 보여준 뒤 진행 UI를 정리한다. */
  const finishExportProgress = async () => {
    await waitForDelay(EXPORT_PROGRESS_COMPLETE_DELAY_MS);
    resetExportProgress();
  };

  /** 실패 상태를 표시하고 진행 UI를 정리한다. */
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

  /** 캡처용 뷰포트 스타일을 생성한다. */
  const getCaptureStyle = (opts: CaptureOptions, offsetX = 0, offsetY = 0) => ({
    width: `${opts.imageWidth}px`,
    height: `${opts.imageHeight}px`,
    transform: `translate(${opts.viewport.x - offsetX}px, ${opts.viewport.y - offsetY}px) scale(${opts.viewport.zoom})`,
  });

  /** 대상 크기에서 사용할 안전한 픽셀 비율을 계산한다. */
  const getSafePixelRatio = (width: number, height: number): number => {
    const maxRatio = Math.min(
      MAX_CANVAS_DIMENSION / Math.max(1, width),
      MAX_CANVAS_DIMENSION / Math.max(1, height),
    );
    const ratio = Math.min(TARGET_PIXEL_RATIO, maxRatio);
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  };

  /** 캔버스 제한으로 인해 품질 하향이 필요한지 확인한다. */
  const isCanvasLimited = (width: number, height: number) => getSafePixelRatio(width, height) < 1;

  /**
   * 현재 크기를 단일 페이지 PDF로 처리할 수 있는 안전한 픽셀 비율을 반환한다.
   *
   * 너무 큰 경우 null을 반환해 타일 PDF 경로로 보낸다.
   */
  const getSinglePagePdfPixelRatio = (width: number, height: number): number | null => {
    const pixelRatio = getSafePixelRatio(width, height);
    const scaledWidth = Math.ceil(width * pixelRatio);
    const scaledHeight = Math.ceil(height * pixelRatio);

    if (pixelRatio < PDF_SINGLE_PAGE_MIN_PIXEL_RATIO) {
      return null;
    }
    if (scaledWidth * scaledHeight > PDF_SINGLE_PAGE_MAX_AREA) {
      return null;
    }

    return pixelRatio;
  };

  /**
   * URL을 파일로 다운로드한다.
   *
   * @param url 다운로드할 URL
   * @param filename 파일명
   * @param revokeAfterDownload 다운로드 후 URL revoke 여부
   */
  const downloadFile = (url: string, filename: string, revokeAfterDownload = false) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (revokeAfterDownload) {
      window.setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS);
    }
  };

  /**
   * Blob을 object URL로 변환해 파일로 다운로드한다.
   *
   * @param blob 다운로드할 Blob
   * @param filename 파일명
   */
  const downloadBlobFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    downloadFile(url, filename, true);
  };

  /** SVG data URL을 Blob으로 변환한다. */
  const convertSvgDataUrlToBlob = (dataUrl: string): Blob => {
    const separatorIndex = dataUrl.indexOf(',');
    if (separatorIndex === -1) {
      throw new Error('Invalid SVG data URL');
    }

    const header = dataUrl.slice(0, separatorIndex);
    const body = dataUrl.slice(separatorIndex + 1);

    if (header.includes(';base64')) {
      const binary = window.atob(body);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new Blob([bytes], { type: 'image/svg+xml;charset=utf-8' });
    }

    return new Blob([decodeURIComponent(body)], {
      type: 'image/svg+xml;charset=utf-8',
    });
  };

  /**
   * html-to-image 렌더 옵션을 구성한다.
   *
   * @param opts 공통 캡처 옵션
   * @param backgroundColor 캡처 배경색
   * @param fontEmbedCSS 재사용할 폰트 임베드 CSS
   * @param render 렌더 세부 옵션
   * @returns html-to-image 옵션
   */
  const buildRenderConfig = (
    opts: CaptureOptions,
    backgroundColor: string,
    fontEmbedCSS: string,
    render: RenderConfigOptions,
  ) => ({
    width: render.width,
    height: render.height,
    style: getCaptureStyle(opts, render.offsetX ?? 0, render.offsetY ?? 0),
    backgroundColor,
    fontEmbedCSS,
    skipAutoScale: true,
    ...(render.pixelRatio ? { pixelRatio: render.pixelRatio } : {}),
    ...(render.quality ? { quality: render.quality } : {}),
    ...(render.type ? { type: render.type } : {}),
  });

  /** 공통 이미지 export 후처리를 수행한다. */
  const handleImageExportSuccess = (imageWidth: number, imageHeight: number) => {
    toast.success(t('erd.export.success'));
    if (isCanvasLimited(imageWidth, imageHeight)) {
      toast.info(t('erd.export.largeDiagramHint'));
    }
  };

  /**
   * 캔버스를 지정한 이미지 타입의 Blob으로 변환한다.
   *
   * `html-to-image.toBlob()`는 내부 구현상 JPEG 타입을 전달하지 못하므로
   * export 훅에서 직접 Blob 변환을 제어한다.
   *
   * @param canvas 변환 대상 캔버스
   * @param type 출력 MIME 타입
   * @param quality JPEG/WebP 품질
   * @returns 변환된 Blob
   */
  const renderCanvasBlob = async (
    canvas: HTMLCanvasElement,
    type: string,
    quality?: number,
  ): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          reject(new Error(`Canvas blob export failed for ${type}`));
        },
        type,
        quality,
      );
    });

  /** PNG 포맷으로 다이어그램을 내보낸다. */
  const exportPng = async () => {
    const format: ExportFormat = 'png';
    try {
      const opts = getCaptureOptions();
      if (!opts) {
        return;
      }
      const canStart = await beginExport(format);
      if (!canStart) {
        return;
      }

      const backgroundColor = getExportBackgroundColor();
      const pixelRatio = getSafePixelRatio(opts.imageWidth, opts.imageHeight);
      await updateExportProgress({
        format,
        stage: 'preparing',
        stageKey: 'erd.export.progress.preparing',
        detailKey: 'erd.export.progress.loadingResources',
        yieldAfter: true,
      });
      const [{ toCanvas }, fontEmbedCSS] = await Promise.all([
        getHtmlToImageModule(),
        getFontEmbedCss(opts.viewportEl),
      ]);

      await updateExportProgress({
        format,
        stage: 'rendering',
        stageKey: 'erd.export.progress.rendering',
        detailKey: 'erd.export.progress.renderingDiagram',
        yieldAfter: true,
      });
      const canvas = await toCanvas(
        opts.viewportEl,
        buildRenderConfig(opts, backgroundColor, fontEmbedCSS, {
          width: opts.imageWidth,
          height: opts.imageHeight,
          pixelRatio,
        }),
      );
      await updateExportProgress({
        format,
        stage: 'encoding',
        stageKey: 'erd.export.progress.encoding',
        detailKey: 'erd.export.progress.encodingImage',
        yieldAfter: true,
      });
      const blob = await renderCanvasBlob(canvas, 'image/png');
      await updateExportProgress({
        format,
        stage: 'downloading',
        stageKey: 'erd.export.progress.downloading',
        detailKey: 'erd.export.progress.downloadReady',
        yieldAfter: true,
      });
      downloadBlobFile(blob, `${diagramName}.png`);
      await finishExportProgress();
      handleImageExportSuccess(opts.imageWidth, opts.imageHeight);
    } catch {
      await failExportProgress(format);
      toast.error(t('erd.export.failed'));
    }
  };

  /** JPG 포맷으로 다이어그램을 내보낸다. */
  const exportJpg = async () => {
    const format: ExportFormat = 'jpg';
    try {
      const opts = getCaptureOptions();
      if (!opts) {
        return;
      }
      const canStart = await beginExport(format);
      if (!canStart) {
        return;
      }

      const backgroundColor = getExportBackgroundColor();
      const pixelRatio = getSafePixelRatio(opts.imageWidth, opts.imageHeight);
      await updateExportProgress({
        format,
        stage: 'preparing',
        stageKey: 'erd.export.progress.preparing',
        detailKey: 'erd.export.progress.loadingResources',
        yieldAfter: true,
      });
      const [{ toCanvas }, fontEmbedCSS] = await Promise.all([
        getHtmlToImageModule(),
        getFontEmbedCss(opts.viewportEl),
      ]);

      await updateExportProgress({
        format,
        stage: 'rendering',
        stageKey: 'erd.export.progress.rendering',
        detailKey: 'erd.export.progress.renderingDiagram',
        yieldAfter: true,
      });
      const canvas = await toCanvas(
        opts.viewportEl,
        buildRenderConfig(opts, backgroundColor, fontEmbedCSS, {
          width: opts.imageWidth,
          height: opts.imageHeight,
          pixelRatio,
        }),
      );
      await updateExportProgress({
        format,
        stage: 'encoding',
        stageKey: 'erd.export.progress.encoding',
        detailKey: 'erd.export.progress.encodingImage',
        yieldAfter: true,
      });
      const blob = await renderCanvasBlob(canvas, 'image/jpeg', 0.95);
      await updateExportProgress({
        format,
        stage: 'downloading',
        stageKey: 'erd.export.progress.downloading',
        detailKey: 'erd.export.progress.downloadReady',
        yieldAfter: true,
      });
      downloadBlobFile(blob, `${diagramName}.jpg`);
      await finishExportProgress();
      handleImageExportSuccess(opts.imageWidth, opts.imageHeight);
    } catch {
      await failExportProgress(format);
      toast.error(t('erd.export.failed'));
    }
  };

  /** SVG 포맷으로 다이어그램을 내보낸다. */
  const exportSvg = async () => {
    const format: ExportFormat = 'svg';
    try {
      const opts = getCaptureOptions();
      if (!opts) {
        return;
      }
      const canStart = await beginExport(format);
      if (!canStart) {
        return;
      }

      const backgroundColor = getExportBackgroundColor();
      await updateExportProgress({
        format,
        stage: 'preparing',
        stageKey: 'erd.export.progress.preparing',
        detailKey: 'erd.export.progress.loadingResources',
        yieldAfter: true,
      });
      const [{ toSvg }, fontEmbedCSS] = await Promise.all([
        getHtmlToImageModule(),
        getFontEmbedCss(opts.viewportEl),
      ]);

      await updateExportProgress({
        format,
        stage: 'rendering',
        stageKey: 'erd.export.progress.rendering',
        detailKey: 'erd.export.progress.renderingDiagram',
        yieldAfter: true,
      });
      const dataUrl = await toSvg(
        opts.viewportEl,
        buildRenderConfig(opts, backgroundColor, fontEmbedCSS, {
          width: opts.imageWidth,
          height: opts.imageHeight,
        }),
      );
      await updateExportProgress({
        format,
        stage: 'encoding',
        stageKey: 'erd.export.progress.encoding',
        detailKey: 'erd.export.progress.encodingSvg',
        yieldAfter: true,
      });
      const blob = convertSvgDataUrlToBlob(dataUrl);
      await updateExportProgress({
        format,
        stage: 'downloading',
        stageKey: 'erd.export.progress.downloading',
        detailKey: 'erd.export.progress.downloadReady',
        yieldAfter: true,
      });
      downloadBlobFile(blob, `${diagramName}.svg`);
      await finishExportProgress();
      toast.success(t('erd.export.success'));
    } catch {
      await failExportProgress(format);
      toast.error(t('erd.export.failed'));
    }
  };

  /** PDF 포맷으로 다이어그램을 내보낸다. PNG로 캡처 후 jsPDF로 변환한다. */
  const exportPdf = async () => {
    const format: ExportFormat = 'pdf';
    try {
      const opts = getCaptureOptions();
      if (!opts) {
        return;
      }
      const canStart = await beginExport(format);
      if (!canStart) {
        return;
      }

      const backgroundColor = getExportBackgroundColor();
      await updateExportProgress({
        format,
        stage: 'preparing',
        stageKey: 'erd.export.progress.preparing',
        detailKey: 'erd.export.progress.loadingResources',
        yieldAfter: true,
      });
      const [{ toCanvas }, { jsPDF }, fontEmbedCSS] = await Promise.all([
        getHtmlToImageModule(),
        getJsPdfModule(),
        getFontEmbedCss(opts.viewportEl),
      ]);

      const singlePagePixelRatio = getSinglePagePdfPixelRatio(opts.imageWidth, opts.imageHeight);
      const useTiledPdf = singlePagePixelRatio == null;

      if (!useTiledPdf) {
        await updateExportProgress({
          format,
          stage: 'rendering',
          stageKey: 'erd.export.progress.rendering',
          detailKey: 'erd.export.progress.renderingDiagram',
          yieldAfter: true,
        });
        const canvas = await toCanvas(
          opts.viewportEl,
          buildRenderConfig(opts, backgroundColor, fontEmbedCSS, {
            width: opts.imageWidth,
            height: opts.imageHeight,
            pixelRatio: singlePagePixelRatio,
          }),
        );

        await updateExportProgress({
          format,
          stage: 'assembling',
          stageKey: 'erd.export.progress.assembling',
          detailKey: 'erd.export.progress.assemblingPdf',
          yieldAfter: true,
        });
        const orientation = opts.imageWidth > opts.imageHeight ? 'landscape' : 'portrait';
        const doc = new jsPDF({
          orientation,
          unit: 'px',
          format: [opts.imageWidth, opts.imageHeight],
          compress: true,
        });
        doc.addImage(canvas, 'PNG', 0, 0, opts.imageWidth, opts.imageHeight);
        await updateExportProgress({
          format,
          stage: 'downloading',
          stageKey: 'erd.export.progress.downloading',
          detailKey: 'erd.export.progress.downloadReady',
          yieldAfter: true,
        });
        doc.save(`${diagramName}.pdf`);
        await finishExportProgress();
        toast.success(t('erd.export.success'));
        return;
      }

      const cols = Math.ceil(opts.imageWidth / PDF_TILE_WIDTH);
      const rows = Math.ceil(opts.imageHeight / PDF_TILE_HEIGHT);
      const totalPages = cols * rows;

      let doc: InstanceType<typeof jsPDF> | null = null;
      await updateExportProgress({
        format,
        mode: 'determinate',
        stage: 'rendering',
        progressPercent: 0,
        stageKey: 'erd.export.progress.rendering',
        detailKey: 'erd.export.progress.pdfPage',
        detailValues: { current: 1, total: totalPages },
        yieldAfter: true,
      });
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const offsetX = col * PDF_TILE_WIDTH;
          const offsetY = row * PDF_TILE_HEIGHT;
          const tileWidth = Math.min(PDF_TILE_WIDTH, opts.imageWidth - offsetX);
          const tileHeight = Math.min(PDF_TILE_HEIGHT, opts.imageHeight - offsetY);
          const tilePixelRatio = getSafePixelRatio(tileWidth, tileHeight);
          const tileCanvas = await toCanvas(
            opts.viewportEl,
            buildRenderConfig(opts, backgroundColor, fontEmbedCSS, {
              width: tileWidth,
              height: tileHeight,
              offsetX,
              offsetY,
              pixelRatio: tilePixelRatio,
            }),
          );

          const orientation = tileWidth > tileHeight ? 'landscape' : 'portrait';
          if (!doc) {
            doc = new jsPDF({
              orientation,
              unit: 'px',
              format: [tileWidth, tileHeight],
              compress: true,
            });
          } else {
            doc.addPage([tileWidth, tileHeight], orientation);
          }
          doc.addImage(tileCanvas, 'PNG', 0, 0, tileWidth, tileHeight);

          const completedPages = row * cols + col + 1;
          if (completedPages < totalPages) {
            await updateExportProgress({
              format,
              mode: 'determinate',
              stage: 'rendering',
              progressPercent: (completedPages / totalPages) * 100,
              stageKey: 'erd.export.progress.rendering',
              detailKey: 'erd.export.progress.pdfPage',
              detailValues: {
                current: completedPages + 1,
                total: totalPages,
              },
              yieldAfter: true,
            });
          }
        }
      }

      if (!doc) {
        await failExportProgress(format);
        toast.error(t('erd.export.failed'));
        return;
      }

      await updateExportProgress({
        format,
        mode: 'determinate',
        stage: 'assembling',
        progressPercent: 100,
        stageKey: 'erd.export.progress.assembling',
        detailKey: 'erd.export.progress.assemblingPdf',
        yieldAfter: true,
      });
      await updateExportProgress({
        format,
        mode: 'determinate',
        stage: 'downloading',
        progressPercent: 100,
        stageKey: 'erd.export.progress.downloading',
        detailKey: 'erd.export.progress.downloadReady',
        yieldAfter: true,
      });
      doc.save(`${diagramName}.pdf`);
      await finishExportProgress();
      toast.success(t('erd.export.success'));
      toast.info(t('erd.export.pdfTiled', { count: totalPages }));
    } catch {
      await failExportProgress(format);
      toast.error(t('erd.export.failed'));
    }
  };

  return { exportPng, exportJpg, exportSvg, exportPdf, exportProgress };
}
