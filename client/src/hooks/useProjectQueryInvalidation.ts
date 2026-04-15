import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/constants/query-keys';

/**
 * 프로젝트 관련 쿼리(WBS, 마일스톤, 사업 개요)를 일괄 무효화하는 훅.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @returns invalidateRelatedQueries 함수
 */
export function useProjectQueryInvalidation(teamId: string, projectId: string) {
  const queryClient = useQueryClient();

  /**
   * WBS, 마일스톤, 사업 개요 쿼리를 무효화한다.
   *
   * @param options.includeWbs WBS 쿼리 무효화 포함 여부 (기본 true)
   * @param options.includeMilestones 마일스톤 쿼리 무효화 포함 여부 (기본 true)
   */
  const invalidateRelatedQueries = useCallback(
    ({ includeWbs = true, includeMilestones = true } = {}) => {
      if (includeWbs) {
        queryClient.invalidateQueries({ queryKey: queryKeys.wbs.all(teamId, projectId) });
      }
      if (includeMilestones) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.milestones.all(teamId, projectId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.businessOverview(teamId, projectId),
      });
    },
    [queryClient, teamId, projectId],
  );

  return invalidateRelatedQueries;
}
