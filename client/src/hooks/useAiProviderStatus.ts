import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/constants/query-keys';

async function loadAiProviderStatus() {
  const { fetchAiProviderStatus } = await import('@/api/aiProviderApi');
  return fetchAiProviderStatus();
}

export function useAiProviderStatus() {
  return useQuery({
    queryKey: queryKeys.aiProvider.status(),
    queryFn: loadAiProviderStatus,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
