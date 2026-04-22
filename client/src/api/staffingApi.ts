import axiosInstance from './axiosInstance';
import type {
  CreateProjectStaffingPayload,
  ProjectStaffingList,
  ProjectStaffingResource,
  UpdateProjectStaffingPayload,
} from '@/types/staffing';

/**
 * 프로젝트 인력 투입 목록/요약을 조회한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @returns 인력 투입 목록 응답
 */
export async function fetchProjectStaffing(
  teamId: string,
  projectId: string,
): Promise<ProjectStaffingList> {
  const res = await axiosInstance.get<ProjectStaffingList>(
    `/teams/${teamId}/projects/${projectId}/staffing`,
  );
  return res.data;
}

/**
 * 프로젝트 인력 투입 행을 생성한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param payload 생성 payload
 * @returns 생성된 인력 투입 행
 */
export async function createProjectStaffing(
  teamId: string,
  projectId: string,
  payload: CreateProjectStaffingPayload,
): Promise<ProjectStaffingResource> {
  const res = await axiosInstance.post<ProjectStaffingResource>(
    `/teams/${teamId}/projects/${projectId}/staffing`,
    payload,
  );
  return res.data;
}

/**
 * 프로젝트 인력 투입 행을 수정한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param staffingId 인력 투입 행 ID
 * @param payload 수정 payload
 * @returns 수정된 인력 투입 행
 */
export async function updateProjectStaffing(
  teamId: string,
  projectId: string,
  staffingId: number,
  payload: UpdateProjectStaffingPayload,
): Promise<ProjectStaffingResource> {
  const res = await axiosInstance.put<ProjectStaffingResource>(
    `/teams/${teamId}/projects/${projectId}/staffing/${staffingId}`,
    payload,
  );
  return res.data;
}

/**
 * 프로젝트 인력 투입 행을 삭제한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param staffingId 인력 투입 행 ID
 */
export async function deleteProjectStaffing(
  teamId: string,
  projectId: string,
  staffingId: number,
): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/projects/${projectId}/staffing/${staffingId}`);
}
