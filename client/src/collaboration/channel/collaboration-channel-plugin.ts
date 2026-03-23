import * as Y from 'yjs';
import type { CollaborationBinding } from './collaboration-binding.js';
import type { CollaborationPreviewPolicy } from './collaboration-preview-policy.js';
import type { YjsDocumentAdapter } from '../yjs/yjs-document-adapter.js';
import type { WsTicketIssueResponse } from '../../types/collaboration.js';

/**
 * 프론트 채널 플러그인 계약.
 *
 * @typeParam TBootstrap bootstrap 데이터 타입
 */
export interface CollaborationChannelPlugin<TBootstrap> {
  /** 채널 타입 */
  readonly channelType: string;

  /**
   * WebSocket ticket을 요청한다.
   *
   * @returns 협업 연결용 ticket 응답
   */
  requestTicket(): Promise<WsTicketIssueResponse>;

  /**
   * Y.Doc을 화면/store에 바인딩한다.
   *
   * @param doc 대상 Y.Doc
   * @returns 바인딩 dispose 핸들
   */
  createBinding(doc: Y.Doc): CollaborationBinding;

  /**
   * bootstrap 기준 preview 정책을 생성한다.
   *
   * @param bootstrap bootstrap 데이터
   * @returns preview 정책
   */
  createPreviewPolicy(bootstrap: TBootstrap): CollaborationPreviewPolicy<TBootstrap>;

  /**
   * bootstrap/Y.Doc 변환 어댑터를 생성한다.
   *
   * @returns Y.Doc 어댑터
   */
  createDocumentAdapter(): YjsDocumentAdapter<TBootstrap>;
}
