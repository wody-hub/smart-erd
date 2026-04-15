import * as Y from 'yjs';
import type { ScreenDesignCollaborationBootstrap } from '@/collaboration/channel/document/screen-design-collaboration-bootstrap';
import type { YjsDocumentAdapter } from './yjs-document-adapter';
import { applyScreenDesignContentToDoc } from '@/pages/screendesign/screen-design-document';

/**
 * 화면기획 기본 shared document shape를 보장한다.
 */
export class ScreenSpecYjsDocumentAdapter implements YjsDocumentAdapter<ScreenDesignCollaborationBootstrap> {
  /**
   * bootstrap 정보 기준으로 화면기획 shared document 구조를 보장한다.
   *
   * @param doc 대상 Y.Doc
   * @param _bootstrap 화면기획 bootstrap 데이터
   * @param origin Yjs transaction origin
   * @returns 없음
   */
  applyBootstrapToDoc(
    doc: Y.Doc,
    bootstrap: ScreenDesignCollaborationBootstrap,
    origin: unknown,
  ): void {
    applyScreenDesignContentToDoc(doc, bootstrap.content, origin);
  }

  /**
   * 현재 Y.Doc 전체 상태 update를 추출한다.
   *
   * @param doc 대상 Y.Doc
   * @returns 전체 상태 update
   */
  extractFullStateUpdate(doc: Y.Doc): Uint8Array {
    return Y.encodeStateAsUpdate(doc);
  }
}
