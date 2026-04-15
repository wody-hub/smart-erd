import axiosInstance from './axiosInstance';
import { STORAGE_KEYS } from '@/constants/storage';
import { downloadBlob } from '@/lib/download';
import { getApiBaseUrl } from '@/lib/platform';
import {
  normalizeDocumentPluginId,
  type CreateProjectDocumentInput,
  type DocumentBootstrapPayload,
} from '@/types/document';
import type {
  DiagramSummary,
  DiagramDetail,
  SaveDiagramResult,
  UpdateDiagramDictionaryContextResult,
} from '@/types/diagram';
import type { WsTicketIssueResponse } from '@/types/collaboration';

export type { DiagramSummary, DiagramDetail };

/**
 * 서버 다이어그램 요약 응답의 plugin id를 canonical 값으로 정규화한다.
 *
 * @param summary 서버에서 받은 다이어그램 요약
 * @returns plugin id가 정규화된 다이어그램 요약
 */
function normalizeDiagramSummary(summary: DiagramSummary): DiagramSummary {
  return {
    ...summary,
    pluginId: normalizeDocumentPluginId(summary.pluginId),
  };
}

/**
 * 서버 다이어그램 상세 응답의 plugin id를 canonical 값으로 정규화한다.
 *
 * @param detail 서버에서 받은 다이어그램 상세
 * @returns plugin id가 정규화된 다이어그램 상세
 */
function normalizeDiagramDetail(detail: DiagramDetail): DiagramDetail {
  return {
    ...detail,
    pluginId: normalizeDocumentPluginId(detail.pluginId),
  };
}

/**
 * 문서 bootstrap 응답의 plugin id를 canonical 값으로 정규화한다.
 *
 * @param bootstrap 서버에서 받은 문서 bootstrap
 * @returns plugin id가 정규화된 문서 bootstrap
 */
function normalizeDocumentBootstrap(bootstrap: DocumentBootstrapPayload): DocumentBootstrapPayload {
  return {
    ...bootstrap,
    pluginId: normalizeDocumentPluginId(bootstrap.pluginId),
  };
}

/**
 * Uint8Array를 base64 문자열로 인코딩한다.
 *
 * @param bytes 인코딩할 바이트 배열
 * @returns base64 문자열
 */
function encodeBytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
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
  return res.data.map(normalizeDiagramSummary);
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
  return normalizeDiagramDetail(res.data);
}

/**
 * 다이어그램 collaboration bootstrap 메타를 조회한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 다이어그램 ID
 * @returns bootstrap payload
 */
export async function fetchDiagramBootstrap(
  teamId: string,
  projectId: string,
  diagramId: string,
): Promise<DocumentBootstrapPayload> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}/bootstrap`,
  );
  return normalizeDocumentBootstrap(res.data);
}

/**
 * 다이어그램을 생성한다.
 *
 * @param teamId    팀 ID
 * @param projectId 프로젝트 ID
 * @param input     생성할 문서 입력값
 * @returns 생성된 다이어그램
 */
export async function createDiagram(
  teamId: string,
  projectId: string,
  input: CreateProjectDocumentInput,
): Promise<DiagramSummary> {
  const res = await axiosInstance.post(`/teams/${teamId}/projects/${projectId}/diagrams`, {
    name: input.name,
    pluginId: input.pluginId,
    dictionarySetId: input.dictionarySetId ?? null,
    templateKey: input.templateKey ?? null,
  });
  return normalizeDiagramSummary(res.data);
}

/**
 * 다이어그램 콘텐츠를 저장한다.
 *
 * @param teamId    팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 다이어그램 ID
 * @param content   직렬화된 React Flow JSON
 * @param ydocSnapshot 저장할 선택적 Y.Doc 스냅샷
 * @returns 최신 저장 상태
 */
export async function saveDiagram(
  teamId: string,
  projectId: string,
  diagramId: string,
  content: string,
  ydocSnapshot?: Uint8Array | null,
): Promise<SaveDiagramResult> {
  const res = await axiosInstance.put(
    `/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}`,
    {
      content,
      ydocSnapshot:
        ydocSnapshot && ydocSnapshot.length > 0 ? encodeBytesToBase64(ydocSnapshot) : undefined,
    },
  );
  return res.data;
}

/**
 * 현재 Y.Doc 스냅샷을 서버에 즉시 저장한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 다이어그램 ID
 * @param expectedContentRevision 현재 콘텐츠 revision 기대값
 * @param ydocSnapshot 현재 Y.Doc 전체 상태 update
 * @param options 스냅샷 저장 정책 옵션
 * @returns 실제로 스냅샷이 저장됐는지 여부
 */
export async function persistDiagramYdocSnapshot(
  teamId: string,
  projectId: string,
  diagramId: string,
  expectedContentRevision: string,
  ydocSnapshot: Uint8Array,
  options?: {
    persistOnlyIfMissing?: boolean;
  },
): Promise<boolean> {
  const response = await axiosInstance.post(
    `/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}/ydoc-snapshot`,
    {
      expectedContentRevision,
      ydocSnapshot: encodeBytesToBase64(ydocSnapshot),
      persistOnlyIfMissing: options?.persistOnlyIfMissing === true,
    },
  );
  return Boolean(response.data?.persisted);
}

/**
 * 현재 Y.Doc 스냅샷을 keepalive fetch로 서버에 저장한다.
 *
 * 페이지 이탈 직전에도 draft가 남을 수 있도록 `pagehide` 경로에서 사용한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 다이어그램 ID
 * @param expectedContentRevision 현재 콘텐츠 revision 기대값
 * @param ydocSnapshot 현재 Y.Doc 전체 상태 update
 * @returns 요청 시작 여부
 */
export function persistDiagramYdocSnapshotKeepalive(
  teamId: string,
  projectId: string,
  diagramId: string,
  expectedContentRevision: string,
  ydocSnapshot: Uint8Array,
): boolean {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const language = localStorage.getItem(STORAGE_KEYS.LANGUAGE) || navigator.language || 'en';
  const requestUrl = `${getApiBaseUrl()}/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}/ydoc-snapshot`;
  const requestBody = JSON.stringify({
    expectedContentRevision,
    ydocSnapshot: encodeBytesToBase64(ydocSnapshot),
  });

  void fetch(requestUrl, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': language,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: requestBody,
  }).catch(() => undefined);

  return true;
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
 * 다이어그램 적용 사전 세트를 변경한다.
 *
 * @param teamId          팀 ID
 * @param projectId       프로젝트 ID
 * @param diagramId       다이어그램 ID
 * @param dictionarySetId 변경할 사전 세트 ID
 * @returns 변경된 사전 컨텍스트 바인딩 결과
 */
export async function updateDiagramDictionaryContext(
  teamId: string,
  projectId: string,
  diagramId: string,
  dictionarySetId: number,
): Promise<UpdateDiagramDictionaryContextResult> {
  const res = await axiosInstance.patch<UpdateDiagramDictionaryContextResult>(
    `/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}/dictionary-set`,
    {
      dictionarySetId,
    },
  );
  return res.data;
}

/** @deprecated `updateDiagramDictionaryContext` 사용 */
export const updateDiagramDictionarySet = updateDiagramDictionaryContext;

/**
 * WebSocket 연결을 위한 일회용 ticket을 발급받는다.
 *
 * @param diagramId 다이어그램 ID
 * @returns 티켓 + presence 프로토콜 메타데이터
 */
export async function requestWsTicket(diagramId: string): Promise<WsTicketIssueResponse> {
  const res = await axiosInstance.post<WsTicketIssueResponse>('/ws-ticket', {
    diagramId: Number(diagramId),
  });
  return res.data;
}

/**
 * 다이어그램을 삭제한다.
 *
 * @param teamId    팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 다이어그램 ID
 * @returns 없음
 */
export async function deleteDiagram(
  teamId: string,
  projectId: string,
  diagramId: string,
): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}`);
}

/**
 * 현재 다이어그램 기준 테이블 정의서 엑셀을 다운로드한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 다이어그램 ID
 * @param content 현재 캔버스 기준 직렬화된 다이어그램 JSON
 * @returns 없음
 */
export async function downloadDiagramTableDefinition(
  teamId: string,
  projectId: string,
  diagramId: string,
  content: string,
): Promise<void> {
  const response = await axiosInstance.post(
    `/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}/table-definition`,
    { content },
    { responseType: 'blob' },
  );
  downloadBlob(response, 'table-definition.xlsx');
}

/**
 * 현재 다이어그램 기준 컬럼 정의서 엑셀을 다운로드한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 다이어그램 ID
 * @param content 현재 캔버스 기준 직렬화된 다이어그램 JSON
 * @returns 없음
 */
export async function downloadDiagramColumnDefinition(
  teamId: string,
  projectId: string,
  diagramId: string,
  content: string,
): Promise<void> {
  const response = await axiosInstance.post(
    `/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}/column-definition`,
    { content },
    { responseType: 'blob' },
  );
  downloadBlob(response, 'column-definition.xlsx');
}

/**
 * 현재 다이어그램 기준 인덱스 정의서 엑셀을 다운로드한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 다이어그램 ID
 * @param content 현재 캔버스 기준 직렬화된 다이어그램 JSON
 * @returns 없음
 */
export async function downloadDiagramIndexDefinition(
  teamId: string,
  projectId: string,
  diagramId: string,
  content: string,
): Promise<void> {
  const response = await axiosInstance.post(
    `/teams/${teamId}/projects/${projectId}/diagrams/${diagramId}/index-definition`,
    { content },
    { responseType: 'blob' },
  );
  downloadBlob(response, 'index-definition.xlsx');
}
