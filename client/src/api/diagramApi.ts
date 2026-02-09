import axiosInstance from './axiosInstance';

/** 다이어그램 목록 응답 인터페이스. */
export interface DiagramSummary {
  /** 다이어그램 ID */
  id: number;
  /** 다이어그램 이름 */
  name: string;
  /** 소속 프로젝트 ID */
  projectId: number;
  /** 생성 일시 (ISO 8601) */
  createdAt: string;
  /** 수정 일시 (ISO 8601) */
  updatedAt: string;
}

/** 다이어그램 상세 응답 인터페이스 (content 포함). */
export interface DiagramDetail extends DiagramSummary {
  /** 직렬화된 React Flow JSON (노드 + 엣지) */
  content: string | null;
}

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
 * @returns 저장된 다이어그램 상세
 */
export async function saveDiagram(
  teamId: string,
  projectId: string,
  diagramId: string,
  content: string,
): Promise<DiagramDetail> {
  const res = await axiosInstance.put(
    `/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}`,
    { content },
  );
  return res.data;
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
