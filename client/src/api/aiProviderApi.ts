import axiosInstance from './axiosInstance';
import type {
  AiExecutionStatusResponse,
  AiProviderExecuteRequest,
  AiProviderExecuteResponse,
  AiProviderStatusResponse,
} from '@/types/ai-provider';

const AI_PROVIDER_BASE_PATH = '/ai/provider';

export async function fetchAiProviderStatus(): Promise<AiProviderStatusResponse> {
  const res = await axiosInstance.get<AiProviderStatusResponse>(
    `${AI_PROVIDER_BASE_PATH}/status`,
  );
  return res.data;
}

export async function executeAiProvider(
  request: AiProviderExecuteRequest,
): Promise<AiProviderExecuteResponse> {
  const res = await axiosInstance.post<AiProviderExecuteResponse>(
    `${AI_PROVIDER_BASE_PATH}/execute`,
    request,
  );
  return res.data;
}

export async function fetchAiExecutionStatus(
  executionId: string,
): Promise<AiExecutionStatusResponse> {
  const res = await axiosInstance.get<AiExecutionStatusResponse>(
    `${AI_PROVIDER_BASE_PATH}/executions/${executionId}`,
  );
  return res.data;
}

export async function cancelAiExecution(executionId: string): Promise<AiExecutionStatusResponse> {
  const res = await axiosInstance.post<AiExecutionStatusResponse>(
    `${AI_PROVIDER_BASE_PATH}/executions/${executionId}/cancel`,
  );
  return res.data;
}
