import { useQuery } from '@tanstack/react-query';
import { fetchAiProviderStatus } from '@/api/aiProviderApi';
import { queryKeys } from '@/constants/query-keys';

export function useAiProviderStatus() {
  return useQuery({
    queryKey: queryKeys.aiProvider.status(),
    queryFn: fetchAiProviderStatus,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
