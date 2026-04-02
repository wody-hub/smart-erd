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

/** 단일 페이지 PDF에 맞는 페이지 크기를 계산한다. */
export const getSinglePagePdfLayout = (
  width: number,
  height: number,
): SinglePagePdfLayout => {
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
