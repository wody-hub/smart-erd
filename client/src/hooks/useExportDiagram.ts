import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useRef } from 'react';

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
/** 대형 다이어그램 PDF 타일 폭(px) */
const PDF_TILE_WIDTH = 6000;
/** 대형 다이어그램 PDF 타일 높이(px) */
const PDF_TILE_HEIGHT = 4000;
/** 단일 페이지 PDF를 유지할 최대 길이(px) */
const PDF_SINGLE_PAGE_MAX_DIMENSION = 8000;
/** 디자인 토큰 기반 export 배경색 fallback */
const EXPORT_BACKGROUND_FALLBACK = 'hsl(0 0% 100%)';

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
   * Data URL 또는 Blob URL을 파일로 다운로드한다.
   *
   * @param url 다운로드할 URL
   * @param filename 파일명
   */
  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  /** PNG 포맷으로 다이어그램을 내보낸다. */
  const exportPng = async () => {
    try {
      const opts = getCaptureOptions();
      if (!opts) {
        return;
      }
      const backgroundColor = getExportBackgroundColor();
      const pixelRatio = getSafePixelRatio(opts.imageWidth, opts.imageHeight);
      const { toPng } = await getHtmlToImageModule();

      const dataUrl = await toPng(opts.viewportEl, {
        width: opts.imageWidth,
        height: opts.imageHeight,
        style: getCaptureStyle(opts),
        backgroundColor,
        pixelRatio,
        skipAutoScale: true,
      });
      downloadFile(dataUrl, `${diagramName}.png`);
      toast.success(t('erd.export.success'));
      if (isCanvasLimited(opts.imageWidth, opts.imageHeight)) {
        toast.info(t('erd.export.largeDiagramHint'));
      }
    } catch {
      toast.error(t('erd.export.failed'));
    }
  };

  /** JPG 포맷으로 다이어그램을 내보낸다. */
  const exportJpg = async () => {
    try {
      const opts = getCaptureOptions();
      if (!opts) {
        return;
      }
      const backgroundColor = getExportBackgroundColor();
      const pixelRatio = getSafePixelRatio(opts.imageWidth, opts.imageHeight);
      const { toJpeg } = await getHtmlToImageModule();

      const dataUrl = await toJpeg(opts.viewportEl, {
        width: opts.imageWidth,
        height: opts.imageHeight,
        style: getCaptureStyle(opts),
        backgroundColor,
        quality: 0.95,
        pixelRatio,
        skipAutoScale: true,
      });
      downloadFile(dataUrl, `${diagramName}.jpg`);
      toast.success(t('erd.export.success'));
      if (isCanvasLimited(opts.imageWidth, opts.imageHeight)) {
        toast.info(t('erd.export.largeDiagramHint'));
      }
    } catch {
      toast.error(t('erd.export.failed'));
    }
  };

  /** SVG 포맷으로 다이어그램을 내보낸다. */
  const exportSvg = async () => {
    try {
      const opts = getCaptureOptions();
      if (!opts) {
        return;
      }
      const backgroundColor = getExportBackgroundColor();
      const { toSvg } = await getHtmlToImageModule();

      const dataUrl = await toSvg(opts.viewportEl, {
        width: opts.imageWidth,
        height: opts.imageHeight,
        style: getCaptureStyle(opts),
        backgroundColor,
      });
      downloadFile(dataUrl, `${diagramName}.svg`);
      toast.success(t('erd.export.success'));
    } catch {
      toast.error(t('erd.export.failed'));
    }
  };

  /** PDF 포맷으로 다이어그램을 내보낸다. PNG로 캡처 후 jsPDF로 변환한다. */
  const exportPdf = async () => {
    try {
      const opts = getCaptureOptions();
      if (!opts) {
        return;
      }
      const backgroundColor = getExportBackgroundColor();
      const [{ toPng }, { jsPDF }] = await Promise.all([getHtmlToImageModule(), getJsPdfModule()]);

      const useTiledPdf =
        opts.imageWidth > PDF_SINGLE_PAGE_MAX_DIMENSION ||
        opts.imageHeight > PDF_SINGLE_PAGE_MAX_DIMENSION ||
        isCanvasLimited(opts.imageWidth, opts.imageHeight);

      if (!useTiledPdf) {
        const pixelRatio = getSafePixelRatio(opts.imageWidth, opts.imageHeight);
        const dataUrl = await toPng(opts.viewportEl, {
          width: opts.imageWidth,
          height: opts.imageHeight,
          style: getCaptureStyle(opts),
          backgroundColor,
          pixelRatio,
          skipAutoScale: true,
        });

        const orientation = opts.imageWidth > opts.imageHeight ? 'landscape' : 'portrait';
        const doc = new jsPDF({
          orientation,
          unit: 'px',
          format: [opts.imageWidth, opts.imageHeight],
          compress: true,
        });
        doc.addImage(dataUrl, 'PNG', 0, 0, opts.imageWidth, opts.imageHeight);
        doc.save(`${diagramName}.pdf`);
        toast.success(t('erd.export.success'));
        return;
      }

      const cols = Math.ceil(opts.imageWidth / PDF_TILE_WIDTH);
      const rows = Math.ceil(opts.imageHeight / PDF_TILE_HEIGHT);
      const totalPages = cols * rows;

      let doc: {
        addPage: (format?: [number, number], orientation?: 'portrait' | 'landscape') => void;
        addImage: (
          imageData: string,
          format: string,
          x: number,
          y: number,
          width: number,
          height: number,
        ) => void;
        save: (filename: string) => void;
      } | null = null;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const offsetX = col * PDF_TILE_WIDTH;
          const offsetY = row * PDF_TILE_HEIGHT;
          const tileWidth = Math.min(PDF_TILE_WIDTH, opts.imageWidth - offsetX);
          const tileHeight = Math.min(PDF_TILE_HEIGHT, opts.imageHeight - offsetY);
          const tilePixelRatio = getSafePixelRatio(tileWidth, tileHeight);
          const tileDataUrl = await toPng(opts.viewportEl, {
            width: tileWidth,
            height: tileHeight,
            style: getCaptureStyle(opts, offsetX, offsetY),
            backgroundColor,
            pixelRatio: tilePixelRatio,
            skipAutoScale: true,
          });

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
          doc.addImage(tileDataUrl, 'PNG', 0, 0, tileWidth, tileHeight);
        }
      }

      if (!doc) {
        toast.error(t('erd.export.failed'));
        return;
      }

      doc.save(`${diagramName}.pdf`);
      toast.success(t('erd.export.success'));
      toast.info(t('erd.export.pdfTiled', { count: totalPages }));
    } catch {
      toast.error(t('erd.export.failed'));
    }
  };

  return { exportPng, exportJpg, exportSvg, exportPdf };
}
