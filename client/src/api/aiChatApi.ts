import type {
  AiActionProposalCard,
  AiActionProposalDecisionResponse,
  AiChatRequest,
  AiChatResponse,
} from '@/types/ai-chat';

export const AI_CHAT_BASE_PATH = '/ai/chat';
export const AI_PROPOSAL_BASE_PATH = '/ai/proposals';

interface AiChatHttpClient {
  get(url: string): Promise<{ data: unknown }>;
  post(url: string, data?: unknown, config?: { signal?: AbortSignal }): Promise<{ data: unknown }>;
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
  return res.data as AiChatResponse;
}

export async function fetchAiProposal(proposalId: string): Promise<AiActionProposalCard> {
  const httpClient = await resolveAiChatHttpClient();
  const res = await httpClient.get(`${AI_PROPOSAL_BASE_PATH}/${proposalId}`);
  return res.data as AiActionProposalCard;
}

export async function approveAiProposal(
  proposalId: string,
): Promise<AiActionProposalDecisionResponse> {
  const httpClient = await resolveAiChatHttpClient();
  const res = await httpClient.post(`${AI_PROPOSAL_BASE_PATH}/${proposalId}/approve`);
  return res.data as AiActionProposalDecisionResponse;
}

export async function cancelAiProposal(
  proposalId: string,
): Promise<AiActionProposalDecisionResponse> {
  const httpClient = await resolveAiChatHttpClient();
  const res = await httpClient.post(`${AI_PROPOSAL_BASE_PATH}/${proposalId}/cancel`);
  return res.data as AiActionProposalDecisionResponse;
}
