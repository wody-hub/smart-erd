import axiosInstance from './axiosInstance';
import type { CreateMilestonePayload, Milestone, UpdateMilestonePayload } from '@/types/milestone';

/**
 * 프로젝트 마일스톤 목록을 조회한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @returns 마일스톤 목록
 */
export async function fetchMilestones(teamId: string, projectId: string): Promise<Milestone[]> {
  const res = await axiosInstance.get<Milestone[]>(
    `/teams/${teamId}/projects/${projectId}/milestones`,
  );
  return res.data;
}

/**
 * 마일스톤을 생성한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param payload 생성 payload
 * @returns 생성된 마일스톤
 */
export async function createMilestone(
  teamId: string,
  projectId: string,
  payload: CreateMilestonePayload,
): Promise<Milestone> {
  const res = await axiosInstance.post<Milestone>(
    `/teams/${teamId}/projects/${projectId}/milestones`,
    payload,
  );
  return res.data;
}

/**
 * 마일스톤을 수정한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param milestoneId 마일스톤 ID
 * @param payload 수정 payload
 * @returns 수정된 마일스톤
 */
export async function updateMilestone(
  teamId: string,
  projectId: string,
  milestoneId: number,
  payload: UpdateMilestonePayload,
): Promise<Milestone> {
  const res = await axiosInstance.put<Milestone>(
    `/teams/${teamId}/projects/${projectId}/milestones/${milestoneId}`,
    payload,
  );
  return res.data;
}

/**
 * 마일스톤을 삭제한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param milestoneId 마일스톤 ID
 */
export async function deleteMilestone(
  teamId: string,
  projectId: string,
  milestoneId: number,
): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/projects/${projectId}/milestones/${milestoneId}`);
}
