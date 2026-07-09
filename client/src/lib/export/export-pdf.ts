/** jsPDF가 허용하는 PDF 페이지 한 변 최대 길이(px, user unit 기준) */
export const PDF_MAX_PAGE_DIMENSION = 14_400;
/** 단일 페이지 PDF 렌더에 허용할 최대 캔버스 면적(px^2) */
const PDF_SINGLE_PAGE_MAX_AREA = 67_000_000;

/** 단일 페이지 PDF 레이아웃 정보 */
export interface SinglePagePdfLayout {
  /** PDF 페이지 너비 */
  pageWidth: number;
  /** PDF 페이지 높이 */
  pageHeight: number;
}

/** PDF 고해상도 렌더링용 CSS 좌표 타일 */
export interface PdfTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** PDF 페이지에 삽입할 타일 배치 좌표 */
export interface PdfTilePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 단일 페이지 PDF에 맞는 페이지 크기를 계산한다. */
export const getSinglePagePdfLayout = (width: number, height: number): SinglePagePdfLayout => {
  const boundedWidth = Math.max(1, width);
  const boundedHeight = Math.max(1, height);
  const pageScale = Math.min(
    PDF_MAX_PAGE_DIMENSION / boundedWidth,
    PDF_MAX_PAGE_DIMENSION / boundedHeight,
    1,
  );

  return {
    pageWidth: boundedWidth * pageScale,
    pageHeight: boundedHeight * pageScale,
  };
};

/** 단일 페이지 PDF 렌더에 사용할 안전한 픽셀 비율을 계산한다. */
export const getSinglePagePdfPixelRatio = (
  width: number,
  height: number,
  safePixelRatio: number,
): number => {
  const boundedWidth = Math.max(1, width);
  const boundedHeight = Math.max(1, height);
  const boundedSafePixelRatio =
    Number.isFinite(safePixelRatio) && safePixelRatio > 0 ? safePixelRatio : 1;
  const areaLimitedPixelRatio = Math.sqrt(
    PDF_SINGLE_PAGE_MAX_AREA / (boundedWidth * boundedHeight),
  );

  if (!Number.isFinite(areaLimitedPixelRatio) || areaLimitedPixelRatio <= 0) {
    return boundedSafePixelRatio;
  }

  return Math.min(boundedSafePixelRatio, areaLimitedPixelRatio);
};

/** 전체 다이어그램 영역을 제한된 크기의 PDF 렌더 타일로 나눈다. */
export const buildPdfTilePlan = (width: number, height: number, tileCssSize: number): PdfTile[] => {
  const boundedWidth = Math.max(1, Math.ceil(width));
  const boundedHeight = Math.max(1, Math.ceil(height));
  const boundedTileSize = Math.max(1, Math.floor(tileCssSize));
  const tiles: PdfTile[] = [];

  for (let y = 0; y < boundedHeight; y += boundedTileSize) {
    for (let x = 0; x < boundedWidth; x += boundedTileSize) {
      tiles.push({
        x,
        y,
        width: Math.min(boundedTileSize, boundedWidth - x),
        height: Math.min(boundedTileSize, boundedHeight - y),
      });
    }
  }

  return tiles;
};

/** CSS 좌표계 타일을 축소/확대된 PDF 페이지 좌표계로 변환한다. */
export const getPdfTilePlacement = (
  tile: PdfTile,
  layout: SinglePagePdfLayout,
  imageWidth: number,
  imageHeight: number,
): PdfTilePlacement => {
  const scaleX = layout.pageWidth / Math.max(1, imageWidth);
  const scaleY = layout.pageHeight / Math.max(1, imageHeight);

  return {
    x: tile.x * scaleX,
    y: tile.y * scaleY,
    width: tile.width * scaleX,
    height: tile.height * scaleY,
  };
};
