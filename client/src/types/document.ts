import type { MarkdownTemplateKey } from '@/types/markdown';

/** 문서 플러그인 식별자. */
export type DocumentPluginId = 'erd' | 'markdown';

/** 문서 collaboration bootstrap 공통 헤더. */
export interface DocumentBootstrapHeader {
  /** 플러그인 스키마 버전 */
  pluginSchemaVersion: number;
  /** snapshot 포맷 버전 */
  snapshotFormatVersion: number;
  /** compatibility artifact 버전 */
  artifactVersion: number | null;
  /** bootstrap 기준 revision */
  revision: string;
  /** snapshot 존재 여부 */
  snapshotAvailable: boolean;
  /** content fallback artifact 존재 여부 */
  artifactAvailable: boolean;
}

/** 문서 collaboration bootstrap 응답 payload. */
export interface DocumentBootstrapPayload extends DocumentBootstrapHeader {
  /** 문서 플러그인 ID */
  pluginId: string;
  /** shared document engine ID */
  engineId: string;
}

/** markdown 문서 export 포맷. */
export type DocumentExportFormat = 'md' | 'html';

/** 프로젝트 문서 생성 입력값. */
export interface CreateProjectDocumentInput {
  /** 문서 이름 */
  name: string;
  /** 생성할 문서 플러그인 */
  pluginId: DocumentPluginId;
  /** ERD 문서용 사전 컨텍스트 ID */
  dictionarySetId?: number | null;
  /** markdown 문서용 템플릿 키 */
  templateKey?: MarkdownTemplateKey | null;
}
