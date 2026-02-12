import { useQuery } from '@tanstack/react-query';
import { fetchMyRole } from '@/api/teamApi';
import { queryKeys } from '@/constants/query-keys';

/**
 * 현재 사용자의 팀 내 역할을 조회하는 훅.
 *
 * @param teamId 팀 ID
 * @returns { role, isAdmin, canEdit, isLoading }
 */
export function useTeamRole(teamId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.teams.myRole(teamId!),
    queryFn: () => fetchMyRole(teamId!),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000, // 5분 — 역할은 자주 변경되지 않음
  });

  const role = data?.role ?? null;

  return {
    /** 현재 역할 (null이면 로딩 중) */
    role,
    /** ADMIN 여부 — 팀 설정, 멤버 관리 표시 */
    isAdmin: role === 'ADMIN',
    /** 편집 가능 여부 (ADMIN 또는 MEMBER) — 생성/수정/삭제 버튼 표시 */
    canEdit: role === 'ADMIN' || role === 'MEMBER',
    /** 로딩 중 여부 */
    isLoading,
  };
}
