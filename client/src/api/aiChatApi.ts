import type { AiChatRequest, AiChatResponse } from '@/types/ai-chat';

export const AI_CHAT_BASE_PATH = '/ai/chat';

interface AiChatHttpClient {
  post(
    url: string,
    data?: unknown,
    config?: { signal?: AbortSignal },
  ): Promise<{ data: AiChatResponse }>;
}

let testHttpClient: AiChatHttpClient | null = null;

async function resolveAiChatHttpClient(): Promise<AiChatHttpClient> {
  if (testHttpClient) {
    return testHttpClient;
  }
  const { default: axiosInstance } = await import('./axiosInstance');
  return axiosInstance;
}

export function setAiChatHttpClientForTesting(client: AiChatHttpClient | null): () => void {
  testHttpClient = client;
  return () => {
    testHttpClient = null;
  };
}

export async function executeAiChat(
  request: AiChatRequest,
  signal?: AbortSignal,
): Promise<AiChatResponse> {
  const httpClient = await resolveAiChatHttpClient();
  const res = await httpClient.post(AI_CHAT_BASE_PATH, request, { signal });
  return res.data;
}
