import * as Y from 'yjs';

/**
 * bootstrap 데이터와 Y.Doc 간 변환을 담당하는 포트.
 *
 * @typeParam TBootstrap bootstrap 데이터 타입
 */
export interface YjsDocumentAdapter<TBootstrap> {
  /**
   * bootstrap 데이터를 Y.Doc에 반영한다.
   *
   * @param doc       대상 Y.Doc
   * @param bootstrap 채널 bootstrap 데이터
   * @param origin    Yjs transaction origin
   */
  applyBootstrapToDoc(doc: Y.Doc, bootstrap: TBootstrap, origin: unknown): void;

  /**
   * 현재 Y.Doc을 저장용 전체 update로 추출한다.
   *
   * @param doc 대상 Y.Doc
   * @returns 저장 가능한 전체 Yjs update
   */
  extractFullStateUpdate(doc: Y.Doc): Uint8Array;
}
