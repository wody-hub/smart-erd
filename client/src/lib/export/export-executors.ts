import {
  DEFAULT_EXPORT_QUALITY_PROFILE,
  buildRenderConfig,
  convertSvgDataUrlToBlob,
  downloadBlobFile,
  getExportBackgroundColor,
  getSafePixelRatio,
  renderCanvasBlob,
} from './export-core';
import { buildPdfTilePlan, getPdfTilePlacement, getSinglePagePdfLayout } from './export-pdf';
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
  /** 타일 렌더링으로 처리한 경우 렌더링 타일 수 */
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
  const pixelRatio = getSafePixelRatio(
    opts.imageWidth,
    opts.imageHeight,
    DEFAULT_EXPORT_QUALITY_PROFILE.imagePixelRatio,
  );
  const renderQuality =
    format === 'jpg' ? quality ?? DEFAULT_EXPORT_QUALITY_PROFILE.jpegQuality : undefined;
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
      quality: renderQuality,
      type: mimeType,
    }),
  );

  await progress.updateExportProgress({
    format,
    stage: 'encoding',
    stageKey: 'erd.export.progress.encoding',
    detailKey: 'erd.export.progress.encodingImage',
    yieldAfter: true,
  });
  const blob = await renderCanvasBlob(canvas, mimeType, renderQuality);

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

/** PDF 포맷으로 다이어그램을 고해상도 타일로 내보낸다. */
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
  const layout = getSinglePagePdfLayout(opts.imageWidth, opts.imageHeight);
  const { pageWidth, pageHeight } = layout;
  const tiles = buildPdfTilePlan(
    opts.imageWidth,
    opts.imageHeight,
    DEFAULT_EXPORT_QUALITY_PROFILE.tileCssSize,
  );
  const tilePixelRatio = getSafePixelRatio(
    Math.min(opts.imageWidth, DEFAULT_EXPORT_QUALITY_PROFILE.tileCssSize),
    Math.min(opts.imageHeight, DEFAULT_EXPORT_QUALITY_PROFILE.tileCssSize),
    DEFAULT_EXPORT_QUALITY_PROFILE.pdfPixelRatio,
  );

  await progress.updateExportProgress({
    format,
    stage: 'assembling',
    stageKey: 'erd.export.progress.assembling',
    detailKey: 'erd.export.progress.assemblingPdf',
    yieldAfter: true,
  });
  const orientation = pageWidth > pageHeight ? 'landscape' : 'portrait';
  const doc = new jsPDF({
    orientation,
    unit: 'px',
    format: [pageWidth, pageHeight],
    compress: true,
  });

  for (const [index, tile] of tiles.entries()) {
    await progress.updateExportProgress({
      format,
      stage: 'rendering',
      stageKey: 'erd.export.progress.rendering',
      detailKey: 'erd.export.progress.renderingTile',
      detailValues: { current: index + 1, total: tiles.length },
      progressPercent: Math.round(((index + 1) / tiles.length) * 80),
      yieldAfter: true,
    });

    const canvas = await toCanvas(
      opts.viewportEl,
      buildRenderConfig(opts, backgroundColor, fontEmbedCSS, {
        width: tile.width,
        height: tile.height,
        offsetX: tile.x,
        offsetY: tile.y,
        pixelRatio: tilePixelRatio,
        type: 'image/png',
      }),
    );
    const placement = getPdfTilePlacement(tile, layout, opts.imageWidth, opts.imageHeight);
    doc.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      placement.x,
      placement.y,
      placement.width,
      placement.height,
    );
  }

  await progress.updateExportProgress({
    format,
    stage: 'downloading',
    stageKey: 'erd.export.progress.downloading',
    detailKey: 'erd.export.progress.downloadReady',
    yieldAfter: true,
  });
  doc.save(filename);
  return { tiledPageCount: tiles.length > 1 ? tiles.length : 0 };
};
