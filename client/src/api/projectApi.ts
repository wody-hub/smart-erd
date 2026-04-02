import axiosInstance from './axiosInstance';
import type { Project } from '@/types/project';

/**
 * 팀의 프로젝트 목록을 조회한다.
 *
 * @param teamId 조회할 팀 ID
 * @returns 프로젝트 목록
 */
export async function fetchProjects(teamId: string): Promise<Project[]> {
  const res = await axiosInstance.get<Project[]>(`/teams/${teamId}/projects`);
  return res.data;
}

/**
 * 프로젝트 상세를 조회한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @returns 프로젝트 상세
 */
export async function fetchProject(teamId: string, projectId: string): Promise<Project> {
  const res = await axiosInstance.get<Project>(`/teams/${teamId}/projects/${projectId}`);
  return res.data;
}

/**
 * 새 프로젝트를 생성한다.
 *
 * @param teamId 프로젝트를 생성할 팀 ID
 * @param name   프로젝트 이름
 * @returns 생성된 프로젝트
 */
export async function createProject(teamId: string, name: string): Promise<Project> {
  const res = await axiosInstance.post<Project>(`/teams/${teamId}/projects`, { name });
  return res.data;
}

/**
 * 프로젝트를 삭제한다.
 *
 * @param teamId    프로젝트가 속한 팀 ID
 * @param projectId 삭제할 프로젝트 ID
 */
export async function deleteProject(teamId: string, projectId: number): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/projects/${projectId}`);
}

/**
 * 프로젝트를 수정한다.
 *
 * @param teamId    팀 ID
 * @param projectId 프로젝트 ID
 * @param data      수정 데이터 (name, description)
 * @returns 수정된 프로젝트 응답
 */
export async function updateProject(
  teamId: string,
  projectId: number,
  data: { name: string; description?: string },
): Promise<Project> {
  const res = await axiosInstance.put<Project>(`/teams/${teamId}/projects/${projectId}`, data);
  return res.data;
}
