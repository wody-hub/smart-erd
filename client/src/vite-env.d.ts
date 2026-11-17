/// <reference types="vite/client" />

/** 내부 읽기 전용 DSL 투영의 빌드 플래그. */
interface ImportMetaEnv {
  /** 기본 off, 내부 검증 환경만 internal. */
  readonly VITE_ERD_UNIFIED_EDIT_MODE?: 'off' | 'internal';
  /** 다이어그램 ID CSV 또는 개발/E2E용 all. */
  readonly VITE_ERD_UNIFIED_EDIT_DIAGRAM_IDS?: string;
}
