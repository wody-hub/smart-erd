import { getSafePixelRatio } from '@/lib/export/export-core';
import type { ScreenDesignScreen } from './screen-design-document';

const INVALID_FILENAME_SEGMENT_PATTERN = /[<>:"/\\|?*]/g;
const TRAILING_DOT_PATTERN = /\.+$/g;
const WHITESPACE_PATTERN = /\s+/g;

const DEFAULT_DOCUMENT_EXPORT_NAME = 'screen-spec';
const DEFAULT_SCREEN_EXPORT_NAME = 'screen';

/**
 * 화면기획 export 파일명에 사용할 문자열을 정리한다.
 *
 * @param value 정리할 원본 문자열
 * @param fallback 정리 결과가 비면 사용할 fallback 문자열
 * @returns 파일명 세그먼트로 안전한 문자열
 */
export function sanitizeScreenDesignExportSegment(value: string, fallback: string): string {
  const normalized = stripControlCharacters(value).trim().replace(WHITESPACE_PATTERN, ' ');
  const sanitized = normalized
    .replace(INVALID_FILENAME_SEGMENT_PATTERN, '-')
    .replace(TRAILING_DOT_PATTERN, '')
    .trim();
  return sanitized.length > 0 ? sanitized : fallback;
}

/**
 * 현재 화면 PNG export 파일명을 생성한다.
 *
 * @param documentName 문서 이름
 * @param screenName 화면 이름
 * @returns PNG export 파일명
 */
export function buildScreenDesignPngFilename(documentName: string, screenName: string): string {
  const documentSegment = sanitizeScreenDesignExportSegment(
    documentName,
    DEFAULT_DOCUMENT_EXPORT_NAME,
  );
  const screenSegment = sanitizeScreenDesignExportSegment(screenName, DEFAULT_SCREEN_EXPORT_NAME);
  return `${documentSegment}-${screenSegment}.png`;
}

/**
 * 멀티 화면 PDF export 파일명을 생성한다.
 *
 * @param documentName 문서 이름
 * @returns PDF export 파일명
 */
export function buildScreenDesignPdfFilename(documentName: string): string {
  const documentSegment = sanitizeScreenDesignExportSegment(
    documentName,
    DEFAULT_DOCUMENT_EXPORT_NAME,
  );
  return `${documentSegment}.pdf`;
}

/**
 * 화면기획 export에 사용할 Konva pixel ratio를 계산한다.
 *
 * @param screen export 대상 화면 크기
 * @returns export에 사용할 pixel ratio
 */
export function getScreenDesignExportPixelRatio(
  screen: Pick<ScreenDesignScreen, 'width' | 'height'>,
): number {
  return getSafePixelRatio(screen.width, screen.height);
}

/**
 * jsPDF 페이지 방향과 크기를 계산한다.
 *
 * @param screen export 대상 화면 크기
 * @returns jsPDF 페이지 레이아웃 정보
 */
export function getScreenDesignPdfPageLayout(screen: Pick<ScreenDesignScreen, 'width' | 'height'>) {
  const pageWidth = Math.max(1, Math.ceil(screen.width));
  const pageHeight = Math.max(1, Math.ceil(screen.height));
  return {
    pageWidth,
    pageHeight,
    orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
  } as const;
}

/**
 * 파일명에 섞일 수 있는 제어 문자를 안전한 문자로 치환한다.
 *
 * @param value 정리할 문자열
 * @returns 제어 문자가 제거된 문자열
 */
function stripControlCharacters(value: string): string {
  return Array.from(value, (character) => (character.charCodeAt(0) < 32 ? '-' : character)).join(
    '',
  );
}
