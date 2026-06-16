import axiosInstance from './axiosInstance';
import type {
  AiExecutionStatusResponse,
  AiProviderExecuteRequest,
  AiProviderExecuteResponse,
  AiProviderStatusResponse,
} from '@/types/ai-provider';

const AI_EXECUTION_BASE_PATH = '/ai/executions';
const AI_PROVIDER_STATUS_PATH = '/ai/providers/current/status';

export async function fetchAiProviderStatus(): Promise<AiProviderStatusResponse> {
  const res = await axiosInstance.get<AiProviderStatusResponse>(AI_PROVIDER_STATUS_PATH);
  return res.data;
}

export async function executeAiProvider(
  request: AiProviderExecuteRequest,
): Promise<AiProviderExecuteResponse> {
  const res = await axiosInstance.post<AiProviderExecuteResponse>(AI_EXECUTION_BASE_PATH, request);
  return res.data;
}

export async function fetchAiExecutionStatus(
  executionId: string,
): Promise<AiExecutionStatusResponse> {
  const res = await axiosInstance.get<AiExecutionStatusResponse>(
    `${AI_EXECUTION_BASE_PATH}/${executionId}`,
  );
  return res.data;
}

export async function cancelAiExecution(executionId: string): Promise<AiExecutionStatusResponse> {
  const res = await axiosInstance.post<AiExecutionStatusResponse>(
    `${AI_EXECUTION_BASE_PATH}/${executionId}/cancellation`,
  );
  return res.data;
}
