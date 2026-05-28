/**
 * 프로젝트 작업공간 탭 순서 응답.
 */
export interface ProjectWorkspaceTabOrderResponse {
  /** 사용자별 저장된 탭 순서 */
  tabOrder: string[];
}

/**
 * 프로젝트 작업공간 탭 순서 저장 payload.
 */
export interface UpdateProjectWorkspaceTabOrderPayload {
  /** 저장할 탭 순서 */
  tabOrder: string[];
}
