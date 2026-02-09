import { QueryClient } from '@tanstack/react-query';

/**
 * 애플리케이션 공통 React Query 클라이언트.
 *
 * 쿼리 기본 옵션:
 * - staleTime 30초: 같은 페이지 내 재진입 시 불필요한 refetch 방지
 * - retry 1회: axiosInstance 인터셉터의 토큰 갱신과 분리
 * - refetchOnWindowFocus 비활성화: 탭 전환 시 자동 refetch 방지
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /** 데이터를 신선하게 유지하는 시간 (30초) */
      staleTime: 30_000,
      /** 쿼리 실패 시 재시도 횟수 */
      retry: 1,
      /** 탭 전환 시 자동 refetch 비활성화 */
      refetchOnWindowFocus: false,
    },
    mutations: {
      /** mutation은 재시도하지 않음 */
      retry: 0,
    },
  },
});
