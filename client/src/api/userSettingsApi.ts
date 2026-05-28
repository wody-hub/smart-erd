import axiosInstance from './axiosInstance';
import type {
  ProjectWorkspaceTabOrderResponse,
  UpdateProjectWorkspaceTabOrderPayload,
} from '@/types/user-settings';

/**
 * 현재 사용자의 프로젝트 작업공간 탭 순서를 조회한다.
 *
 * @returns 저장된 탭 순서
 */
export async function fetchProjectWorkspaceTabOrder(): Promise<ProjectWorkspaceTabOrderResponse> {
  const res = await axiosInstance.get<ProjectWorkspaceTabOrderResponse>(
    '/settings/project-workspace-tabs',
  );
  return res.data;
}

/**
 * 현재 사용자의 프로젝트 작업공간 탭 순서를 저장한다.
 *
 * @param payload 저장할 탭 순서
 * @returns 저장된 탭 순서
 */
export async function updateProjectWorkspaceTabOrder(
  payload: UpdateProjectWorkspaceTabOrderPayload,
): Promise<ProjectWorkspaceTabOrderResponse> {
  const res = await axiosInstance.put<ProjectWorkspaceTabOrderResponse>(
    '/settings/project-workspace-tabs',
    payload,
  );
  return res.data;
}
