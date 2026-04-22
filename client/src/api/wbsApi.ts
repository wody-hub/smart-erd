import axiosInstance from './axiosInstance';
import type {
  CreateWbsItemPayload,
  ReorderWbsPayload,
  UpdateWbsItemPayload,
  WbsItem,
} from '@/types/wbs';

/**
 * 프로젝트 WBS 목록을 조회한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @returns WBS 항목 목록
 */
export async function fetchWbsItems(teamId: string, projectId: string): Promise<WbsItem[]> {
  const res = await axiosInstance.get<WbsItem[]>(`/teams/${teamId}/projects/${projectId}/wbs`);
  return res.data;
}

/**
 * WBS 항목을 생성한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param payload 생성 payload
 * @returns 생성된 WBS 항목
 */
export async function createWbsItem(
  teamId: string,
  projectId: string,
  payload: CreateWbsItemPayload,
): Promise<WbsItem> {
  const res = await axiosInstance.post<WbsItem>(
    `/teams/${teamId}/projects/${projectId}/wbs`,
    payload,
  );
  return res.data;
}

/**
 * WBS 항목을 수정한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param wbsId WBS 항목 ID
 * @param payload 수정 payload
 * @returns 수정된 WBS 항목
 */
export async function updateWbsItem(
  teamId: string,
  projectId: string,
  wbsId: number,
  payload: UpdateWbsItemPayload,
): Promise<WbsItem> {
  const res = await axiosInstance.put<WbsItem>(
    `/teams/${teamId}/projects/${projectId}/wbs/${wbsId}`,
    payload,
  );
  return res.data;
}

/**
 * WBS 항목을 삭제한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param wbsId WBS 항목 ID
 */
export async function deleteWbsItem(
  teamId: string,
  projectId: string,
  wbsId: number,
): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/projects/${projectId}/wbs/${wbsId}`);
}

/**
 * WBS 항목을 재정렬한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param payload 재정렬 payload
 */
export async function reorderWbsItems(
  teamId: string,
  projectId: string,
  payload: ReorderWbsPayload,
): Promise<WbsItem[]> {
  const res = await axiosInstance.patch<WbsItem[]>(
    `/teams/${teamId}/projects/${projectId}/wbs/reorder`,
    payload,
  );
  return res.data;
}
