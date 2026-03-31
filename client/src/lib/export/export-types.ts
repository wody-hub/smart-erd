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
export interface UpdateExportProgressOptions {
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

/** 캡처 옵션 (뷰포트 요소 + 이미지 크기 + CSS transform) */
export interface CaptureOptions {
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
export interface RenderConfigOptions {
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

/** export 진행 상태 제어기 */
export interface ExportProgressController {
  /** export 시작 처리 */
  beginExport: (format: ExportFormat) => Promise<boolean>;
  /** 진행 상태 갱신 */
  updateExportProgress: (options: UpdateExportProgressOptions) => Promise<void>;
  /** 완료 상태 정리 */
  finishExportProgress: () => Promise<void>;
  /** 실패 상태 정리 */
  failExportProgress: (format: ExportFormat) => Promise<void>;
  /** 현재 진행 상태 초기화 */
  resetExportProgress: () => void;
}
