import type { AxiosResponse } from 'axios';
import { buildProjectIssueQueryParams } from '@/lib/project-issues';
import type {
  CreateProjectIssuePayload,
  ProjectIssue,
  ProjectIssueFilters,
  ProjectIssueList,
  UpdateProjectIssuePayload,
  UpdateProjectIssueStatusPayload,
} from '@/types/issues';
import axiosInstance from './axiosInstance';

/**
 * 프로젝트 이슈 목록과 상태 요약을 조회한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param filters 조회 필터
 * @returns 프로젝트 이슈 목록 응답
 */
export async function fetchProjectIssues(
  teamId: string,
  projectId: string,
  filters: ProjectIssueFilters = {},
): Promise<ProjectIssueList> {
  const res = await axiosInstance.get<ProjectIssueList>(
    `/teams/${teamId}/projects/${projectId}/issues`,
    {
      params: buildProjectIssueQueryParams(filters),
    },
  );
  return res.data;
}

/**
 * 프로젝트 이슈를 생성한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param payload 생성 payload
 * @returns 생성된 프로젝트 이슈
 */
export async function createProjectIssue(
  teamId: string,
  projectId: string,
  payload: CreateProjectIssuePayload,
): Promise<ProjectIssue> {
  const res = await axiosInstance.post<ProjectIssue>(
    `/teams/${teamId}/projects/${projectId}/issues`,
    payload,
  );
  return res.data;
}

/**
 * 프로젝트 이슈를 수정한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param issueId 프로젝트 이슈 ID
 * @param payload 수정 payload
 * @returns 수정된 프로젝트 이슈
 */
export async function updateProjectIssue(
  teamId: string,
  projectId: string,
  issueId: number,
  payload: UpdateProjectIssuePayload,
): Promise<ProjectIssue> {
  const res = await axiosInstance.put<ProjectIssue>(
    `/teams/${teamId}/projects/${projectId}/issues/${issueId}`,
    payload,
  );
  return res.data;
}

/**
 * 프로젝트 이슈 상태를 변경한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param issueId 프로젝트 이슈 ID
 * @param payload 상태 변경 payload
 * @returns 상태가 변경된 프로젝트 이슈
 */
export async function updateProjectIssueStatus(
  teamId: string,
  projectId: string,
  issueId: number,
  payload: UpdateProjectIssueStatusPayload,
): Promise<ProjectIssue> {
  const res = await axiosInstance.patch<ProjectIssue>(
    `/teams/${teamId}/projects/${projectId}/issues/${issueId}/status`,
    payload,
  );
  return res.data;
}

/**
 * 현재 필터 기준으로 프로젝트 이슈 Excel 파일을 다운로드한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param filters 조회 필터
 * @returns blob 응답
 */
export async function downloadProjectIssuesExcel(
  teamId: string,
  projectId: string,
  filters: ProjectIssueFilters = {},
): Promise<AxiosResponse<Blob>> {
  return axiosInstance.get<Blob>(`/teams/${teamId}/projects/${projectId}/issues/exports/excel`, {
    params: buildProjectIssueQueryParams(filters),
    responseType: 'blob',
  });
}
