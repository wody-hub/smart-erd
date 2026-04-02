import { useQuery } from '@tanstack/react-query';
import { fetchDiagramBootstrap } from '@/api/diagramApi';
import { queryKeys } from '@/constants/query-keys';

/**
 * 문서 편집기 호스트용 bootstrap 메타를 조회한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param diagramId 문서 ID
 * @returns bootstrap query result
 */
export function useDocumentEditorBootstrap(
  teamId: string | undefined,
  projectId: string | undefined,
  diagramId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.diagrams.bootstrap(teamId!, projectId!, diagramId!),
    queryFn: () => fetchDiagramBootstrap(teamId!, projectId!, diagramId!),
    enabled: !!teamId && !!projectId && !!diagramId,
  });
}
