import {
  buildRenderConfig,
  convertSvgDataUrlToBlob,
  downloadBlobFile,
  getExportBackgroundColor,
  getSafePixelRatio,
  getSinglePagePdfPixelRatio,
  PDF_TILE_HEIGHT,
  PDF_TILE_WIDTH,
  renderCanvasBlob,
} from './export-core';
import type { CaptureOptions, ExportFormat, ExportProgressController } from './export-types';

/** export 실행에 필요한 공통 의존성 */
interface SharedExportExecutionOptions {
  /** 저장할 파일명 */
  filename: string;
  /** 공통 캡처 옵션 */
  opts: CaptureOptions;
  /** 진행 상태 제어기 */
  progress: ExportProgressController;
  /** html-to-image 모듈 lazy loader */
  getHtmlToImageModule: () => Promise<typeof import('html-to-image')>;
  /** 재사용할 font embed CSS loader */
  getFontEmbedCss: (viewportEl: HTMLElement) => Promise<string>;
}

/** PNG/JPG image export 실행 옵션 */
interface ImageExportExecutionOptions extends SharedExportExecutionOptions {
  /** 현재 export 포맷 */
  format: Extract<ExportFormat, 'png' | 'jpg'>;
  /** 출력 MIME 타입 */
  mimeType: 'image/png' | 'image/jpeg';
  /** JPEG 품질 */
  quality?: number;
}

/** 이미지 export 결과 */
export interface ImageExportResult {
  /** export된 원본 이미지 너비 */
  imageWidth: number;
  /** export된 원본 이미지 높이 */
  imageHeight: number;
}

/** PDF export 실행 옵션 */
interface PdfExportExecutionOptions extends SharedExportExecutionOptions {
  /** jsPDF 모듈 lazy loader */
  getJsPdfModule: () => Promise<typeof import('jspdf')>;
}

/** PDF export 결과 */
export interface PdfExportResult {
  /** 타일 PDF로 처리한 페이지 수 */
  tiledPageCount: number;
}

/** PNG/JPG 포맷으로 다이어그램을 내보낸다. */
export const exportImageDiagram = async ({
  filename,
  opts,
  format,
  mimeType,
  quality,
  progress,
  getHtmlToImageModule,
  getFontEmbedCss,
}: ImageExportExecutionOptions): Promise<ImageExportResult> => {
  const backgroundColor = getExportBackgroundColor();
  const pixelRatio = getSafePixelRatio(opts.imageWidth, opts.imageHeight);
  await progress.updateExportProgress({
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

  await progress.updateExportProgress({
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

  await progress.updateExportProgress({
    format,
    stage: 'encoding',
    stageKey: 'erd.export.progress.encoding',
    detailKey: 'erd.export.progress.encodingImage',
    yieldAfter: true,
  });
  const blob = await renderCanvasBlob(canvas, mimeType, quality);

  await progress.updateExportProgress({
    format,
    stage: 'downloading',
    stageKey: 'erd.export.progress.downloading',
    detailKey: 'erd.export.progress.downloadReady',
    yieldAfter: true,
  });
  downloadBlobFile(blob, filename);

  return {
    imageWidth: opts.imageWidth,
    imageHeight: opts.imageHeight,
  };
};

/** SVG 포맷으로 다이어그램을 내보낸다. */
export const exportSvgDiagram = async ({
  filename,
  opts,
  progress,
  getHtmlToImageModule,
  getFontEmbedCss,
}: SharedExportExecutionOptions): Promise<void> => {
  const format: ExportFormat = 'svg';
  const backgroundColor = getExportBackgroundColor();
  await progress.updateExportProgress({
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

  await progress.updateExportProgress({
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

  await progress.updateExportProgress({
    format,
    stage: 'encoding',
    stageKey: 'erd.export.progress.encoding',
    detailKey: 'erd.export.progress.encodingSvg',
    yieldAfter: true,
  });
  const blob = convertSvgDataUrlToBlob(dataUrl);

  await progress.updateExportProgress({
    format,
    stage: 'downloading',
    stageKey: 'erd.export.progress.downloading',
    detailKey: 'erd.export.progress.downloadReady',
    yieldAfter: true,
  });
  downloadBlobFile(blob, filename);
};

/** PDF 포맷으로 다이어그램을 내보낸다. PNG로 캡처 후 jsPDF로 변환한다. */
export const exportPdfDiagram = async ({
  filename,
  opts,
  progress,
  getHtmlToImageModule,
  getJsPdfModule,
  getFontEmbedCss,
}: PdfExportExecutionOptions): Promise<PdfExportResult> => {
  const format: ExportFormat = 'pdf';
  const backgroundColor = getExportBackgroundColor();
  await progress.updateExportProgress({
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
    await progress.updateExportProgress({
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

    await progress.updateExportProgress({
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

    await progress.updateExportProgress({
      format,
      stage: 'downloading',
      stageKey: 'erd.export.progress.downloading',
      detailKey: 'erd.export.progress.downloadReady',
      yieldAfter: true,
    });
    doc.save(filename);
    return { tiledPageCount: 0 };
  }

  const cols = Math.ceil(opts.imageWidth / PDF_TILE_WIDTH);
  const rows = Math.ceil(opts.imageHeight / PDF_TILE_HEIGHT);
  const totalPages = cols * rows;

  let doc: InstanceType<typeof jsPDF> | null = null;
  await progress.updateExportProgress({
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
        await progress.updateExportProgress({
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
    throw new Error('PDF document was not created');
  }

  await progress.updateExportProgress({
    format,
    mode: 'determinate',
    stage: 'assembling',
    progressPercent: 100,
    stageKey: 'erd.export.progress.assembling',
    detailKey: 'erd.export.progress.assemblingPdf',
    yieldAfter: true,
  });
  await progress.updateExportProgress({
    format,
    mode: 'determinate',
    stage: 'downloading',
    progressPercent: 100,
    stageKey: 'erd.export.progress.downloading',
    detailKey: 'erd.export.progress.downloadReady',
    yieldAfter: true,
  });
  doc.save(filename);
  return { tiledPageCount: totalPages };
};
