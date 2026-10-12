import type {
  CaptureOptions,
  ExportQualityPreset,
  ExportQualityProfile,
  RenderConfigOptions,
} from './export-types';

/** 브라우저 캔버스 단일 축 최대 크기 (html-to-image 내부 제한과 동일) */
const MAX_CANVAS_DIMENSION = 16384;
/** export 품질 프리셋별 기본 설정 */
export const EXPORT_QUALITY_PRESETS: Record<ExportQualityPreset, ExportQualityProfile> = {
  fast: {
    imagePixelRatio: 2,
    pdfPixelRatio: 1.5,
    jpegQuality: 0.92,
    tileCssSize: 3072,
  },
  balanced: {
    imagePixelRatio: 3,
    pdfPixelRatio: 2,
    jpegQuality: 0.96,
    tileCssSize: 3072,
  },
  high: {
    imagePixelRatio: 4,
    pdfPixelRatio: 3,
    jpegQuality: 1,
    tileCssSize: 4096,
  },
};
/** 일반 export 메뉴의 기본 프리셋 */
export const DEFAULT_EXPORT_QUALITY_PRESET: ExportQualityPreset = 'balanced';
/** High quality fallback: slower exports are acceptable for readable ERD documents. */
export const DEFAULT_EXPORT_QUALITY_PROFILE: ExportQualityProfile = EXPORT_QUALITY_PRESETS.high;
/** 프리셋별 이미지 export 목표 최대 픽셀 면적 */
const IMAGE_OUTPUT_PIXEL_AREA_LIMIT: Record<ExportQualityPreset, number> = {
  fast: 60_000_000,
  balanced: 100_000_000,
  high: 140_000_000,
};
/** 프리셋별 PDF export 목표 최대 픽셀 면적 */
const PDF_OUTPUT_PIXEL_AREA_LIMIT: Record<ExportQualityPreset, number> = {
  fast: 45_000_000,
  balanced: 75_000_000,
  high: 110_000_000,
};
/** Blob URL 정리 지연 시간(ms) */
const OBJECT_URL_REVOKE_DELAY_MS = 1000;
/** 디자인 토큰 기반 export 배경색 fallback */
const EXPORT_BACKGROUND_FALLBACK = 'hsl(0 0% 100%)';

/** 현재 테마의 배경 토큰을 캡처용 배경색으로 변환한다. */
export const getExportBackgroundColor = (): string => {
  const token = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
  if (!token) {
    return EXPORT_BACKGROUND_FALLBACK;
  }
  return `hsl(${token})`;
};

/** React가 진행 UI를 먼저 그릴 수 있도록 다음 페인트까지 양보한다. */
export const waitForNextPaint = async (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      window.setTimeout(resolve, 0);
    });
  });

/** 지정한 시간만큼 비동기 대기한다. */
export const waitForDelay = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/** 캡처용 뷰포트 스타일을 생성한다. */
export const getCaptureStyle = (opts: CaptureOptions, offsetX = 0, offsetY = 0) => ({
  width: `${opts.imageWidth}px`,
  height: `${opts.imageHeight}px`,
  transform: `translate(${opts.viewport.x - offsetX}px, ${opts.viewport.y - offsetY}px) scale(${opts.viewport.zoom})`,
});

/** 대상 크기에서 사용할 안전한 픽셀 비율을 계산한다. */
export const getSafePixelRatio = (
  width: number,
  height: number,
  requestedPixelRatio = DEFAULT_EXPORT_QUALITY_PROFILE.imagePixelRatio,
): number => {
  const maxRatio = Math.min(
    MAX_CANVAS_DIMENSION / Math.max(1, width),
    MAX_CANVAS_DIMENSION / Math.max(1, height),
  );
  const normalizedRatio =
    Number.isFinite(requestedPixelRatio) && requestedPixelRatio > 0 ? requestedPixelRatio : 1;
  const ratio = Math.min(normalizedRatio, maxRatio);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
};

/** 캡처 면적 기준으로 요청 ratio를 자동 제한한다. */
const getAreaLimitedPixelRatio = (
  width: number,
  height: number,
  requestedPixelRatio: number,
  maxOutputPixelArea: number,
): number => {
  const boundedArea = Math.max(1, width) * Math.max(1, height);
  const areaLimitedPixelRatio = Math.sqrt(maxOutputPixelArea / boundedArea);
  return Math.min(requestedPixelRatio, areaLimitedPixelRatio);
};

/**
 * 선택한 품질 프리셋과 다이어그램 크기를 바탕으로 실제 export 설정을 계산한다.
 *
 * @param preset 사용자가 선택한 품질 프리셋
 * @param width 캡처 대상 CSS 너비
 * @param height 캡처 대상 CSS 높이
 * @returns 다이어그램 크기에 맞춰 보정된 export 품질 설정
 */
export const resolveExportQualityProfile = (
  preset: ExportQualityPreset,
  width: number,
  height: number,
): ExportQualityProfile => {
  const profile = EXPORT_QUALITY_PRESETS[preset];
  const imagePixelRatio = getSafePixelRatio(
    width,
    height,
    getAreaLimitedPixelRatio(
      width,
      height,
      profile.imagePixelRatio,
      IMAGE_OUTPUT_PIXEL_AREA_LIMIT[preset],
    ),
  );
  const pdfPixelRatio = getSafePixelRatio(
    width,
    height,
    getAreaLimitedPixelRatio(
      width,
      height,
      profile.pdfPixelRatio,
      PDF_OUTPUT_PIXEL_AREA_LIMIT[preset],
    ),
  );

  return {
    ...profile,
    imagePixelRatio,
    pdfPixelRatio,
  };
};

/** 캔버스 제한으로 인해 품질 하향이 필요한지 확인한다. */
export const isCanvasLimited = (width: number, height: number) =>
  getSafePixelRatio(width, height) < 1;

/**
 * URL을 파일로 다운로드한다.
 *
 * @param url 다운로드할 URL
 * @param filename 파일명
 * @param revokeAfterDownload 다운로드 후 URL revoke 여부
 */
export const downloadFile = (url: string, filename: string, revokeAfterDownload = false) => {
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
export const downloadBlobFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  downloadFile(url, filename, true);
};

/** SVG data URL을 Blob으로 변환한다. */
export const convertSvgDataUrlToBlob = (dataUrl: string): Blob => {
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
export const buildRenderConfig = (
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
export const renderCanvasBlob = async (
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
