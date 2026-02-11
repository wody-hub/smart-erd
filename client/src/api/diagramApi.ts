import axiosInstance from './axiosInstance';
import type { DiagramSummary, DiagramDetail } from '@/types/diagram';

export type { DiagramSummary, DiagramDetail };

/**
 * 프로젝트의 다이어그램 목록을 조회한다.
 *
 * @param teamId    팀 ID
 * @param projectId 프로젝트 ID
 * @returns 다이어그램 목록
 */
export async function fetchDiagrams(teamId: string, projectId: string): Promise<DiagramSummary[]> {
  const res = await axiosInstance.get(`/teams/${teamId}/projects/${projectId}/diagrams`);
  return res.data;
}

/**
 * 다이어그램 상세를 조회한다 (content 포함).
 *
 * @param teamId    팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 다이어그램 ID
 * @returns 다이어그램 상세
 */
export async function fetchDiagram(
  teamId: string,
  projectId: string,
  diagramId: string,
): Promise<DiagramDetail> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}`,
  );
  return res.data;
}

/**
 * 다이어그램을 생성한다.
 *
 * @param teamId    팀 ID
 * @param projectId 프로젝트 ID
 * @param name      다이어그램 이름
 * @returns 생성된 다이어그램
 */
export async function createDiagram(
  teamId: string,
  projectId: string,
  name: string,
): Promise<DiagramSummary> {
  const res = await axiosInstance.post(`/teams/${teamId}/projects/${projectId}/diagrams`, {
    name,
  });
  return res.data;
}

/**
 * 다이어그램 콘텐츠를 저장한다.
 *
 * @param teamId    팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 다이어그램 ID
 * @param content   직렬화된 React Flow JSON
 */
export async function saveDiagram(
  teamId: string,
  projectId: string,
  diagramId: string,
  content: string,
): Promise<void> {
  await axiosInstance.put(`/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}`, {
    content,
  });
}

/**
 * 다이어그램 이름을 변경한다.
 *
 * @param teamId    팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 다이어그램 ID
 * @param name      새 이름
 * @returns 변경된 다이어그램
 */
export async function renameDiagram(
  teamId: string,
  projectId: string,
  diagramId: string,
  name: string,
): Promise<DiagramSummary> {
  const res = await axiosInstance.patch(
    `/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}`,
    { name },
  );
  return res.data;
}

/**
 * WebSocket 연결을 위한 일회용 ticket을 발급받는다.
 *
 * @param diagramId 다이어그램 ID
 * @returns 일회용 ticket 문자열
 */
export async function requestWsTicket(diagramId: string): Promise<string> {
  const res = await axiosInstance.post<{ ticket: string }>('/ws-ticket', {
    diagramId: Number(diagramId),
  });
  return res.data.ticket;
}

/**
 * 다이어그램을 삭제한다.
 *
 * @param teamId    팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 다이어그램 ID
 */
export async function deleteDiagram(
  teamId: string,
  projectId: string,
  diagramId: string,
): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}`);
}
