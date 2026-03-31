/**
 * 협업 문서와 화면/store 바인딩 수명주기를 표현하는 계약.
 */
export interface CollaborationBinding {
  /**
   * 바인딩을 해제하고 관련 observer를 정리한다.
   */
  dispose(): void;
}
