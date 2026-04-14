import { useQuery } from '@tanstack/react-query';
import { fetchDiagram, fetchDiagramBootstrap } from '@/api/diagramApi';
import { fetchProject } from '@/api/projectApi';
import { fetchTeam } from '@/api/teamApi';
import { useDocumentPageHost } from '@/collaboration/core/session/use-document-page-host';
import { SCREEN_SPEC_DOCUMENT_ENGINE_ID } from '@/collaboration/plugins/screen-spec/screen-spec-document-plugin';
import { queryKeys } from '@/constants/query-keys';
import { SCREEN_SPEC_DOCUMENT_PLUGIN_ID } from '@/types/document';
import { useScreenDesignDocument } from './use-screen-design-document';
import { useScreenDesignSession } from './use-screen-design-session';

interface UseScreenDesignInteractivePageDataParams {
  teamId: string;
  projectId: string;
  diagramId: string;
}

/**
 * 화면기획 편집기에 필요한 query/collaboration/document 초기화 계층을 묶는다.
 *
 * @param params 팀/프로젝트/다이어그램 식별자
 * @returns 편집기 데이터와 협업 상태, 문서 액션
 */
export function useScreenDesignInteractivePageData({
  teamId,
  projectId,
  diagramId,
}: UseScreenDesignInteractivePageDataParams) {
  const { data: team } = useQuery({
    queryKey: queryKeys.teams.detail(teamId),
    queryFn: () => fetchTeam(teamId),
    enabled: Boolean(teamId),
  });
  const { data: project } = useQuery({
    queryKey: queryKeys.projects.detail(teamId, projectId),
    queryFn: () => fetchProject(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });
  const { documentBootstrap, documentDetail, isLoading, isError, retryDocumentSetup } =
    useDocumentPageHost({
      bootstrapQueryKey: queryKeys.diagrams.bootstrap(teamId, projectId, diagramId),
      bootstrapQueryFn: () => fetchDiagramBootstrap(teamId, projectId, diagramId),
      detailQueryKey: queryKeys.diagrams.detail(teamId, projectId, diagramId),
      detailQueryFn: () => fetchDiagram(teamId, projectId, diagramId),
      expectedPluginId: SCREEN_SPEC_DOCUMENT_PLUGIN_ID,
      expectedEngineId: SCREEN_SPEC_DOCUMENT_ENGINE_ID,
      enabled: Boolean(teamId) && Boolean(projectId) && Boolean(diagramId),
    });
  const {
    collaborationReady,
    collaborationError,
    sharedDocumentEngine,
    documentMutationSession,
    projectionVersion,
    lastDocumentChangeSummary,
  } = useScreenDesignSession({
    teamId,
    projectId,
    diagramId,
    documentDetail,
    documentBootstrap,
  });
  const documentState = useScreenDesignDocument({
    sharedDocumentEngine,
    documentMutationSession,
    projectionVersion,
  });

  return {
    team,
    project,
    documentBootstrap,
    documentDetail,
    isLoading,
    isError,
    retryDocumentSetup,
    collaborationReady,
    collaborationError,
    sharedDocumentEngine,
    lastDocumentChangeSummary,
    ...documentState,
  };
}
