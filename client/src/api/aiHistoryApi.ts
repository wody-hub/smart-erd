import type { AiProjectHistoryResponse } from '@/types/ai-history';

export const AI_HISTORY_DEFAULT_LIMIT = 50;

interface AiHistoryHttpClient {
  get(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: unknown }>;
}

let testHttpClient: AiHistoryHttpClient | null = null;

/**
 * AI history API에서 사용할 HTTP 클라이언트를 가져온다.
 *
 * @returns axios 호환 HTTP 클라이언트
 */
async function resolveAiHistoryHttpClient(): Promise<AiHistoryHttpClient> {
  if (testHttpClient) {
    return testHttpClient;
  }
  const { default: axiosInstance } = await import('./axiosInstance');
  return axiosInstance;
}

/**
 * AI history API 테스트용 HTTP 클라이언트를 주입한다.
 *
 * @param client 테스트용 HTTP 클라이언트
 * @returns 기존 클라이언트 상태를 복원하는 함수
 */
export function setAiHistoryHttpClientForTesting(client: AiHistoryHttpClient | null): () => void {
  const previous = testHttpClient;
  testHttpClient = client;
  return () => {
    testHttpClient = previous;
  };
}

/**
 * 프로젝트 범위 AI 실행/제안 이력을 조회한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param limit 조회 개수 제한
 * @returns 프로젝트 AI history 응답
 */
export async function fetchProjectAiHistory(
  teamId: string,
  projectId: string,
  limit: number = AI_HISTORY_DEFAULT_LIMIT,
): Promise<AiProjectHistoryResponse> {
  const httpClient = await resolveAiHistoryHttpClient();
  const res = await httpClient.get(`/teams/${teamId}/projects/${projectId}/ai-history`, {
    params: { limit },
  });
  return res.data as AiProjectHistoryResponse;
}
