import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import DictionaryWorkspace from '@/components/dictionary/DictionaryWorkspace';
import ProjectWorkspaceHero from '@/components/workspace/ProjectWorkspaceHero';
import { fetchProjects } from '@/api/projectApi';
import { fetchTeam } from '@/api/teamApi';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { useRecentProjectContext } from '@/hooks/useRecentProjectContext';
import { useTeamRole } from '@/hooks/useTeamRole';
import type { DictionaryWorkspaceRouteState } from '@/types/workspace';

/**
 * 데이터 사전 페이지.
 *
 * 사전 세트를 선택한 뒤 도메인/용어 탭을 세트 스코프로 관리한다.
 */
export default function DictionaryPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { canEdit } = useTeamRole(teamId);
  const { recentProjectContext, clearRecentProjectContext } = useRecentProjectContext(teamId);
  const dictionaryRouteState = location.state as DictionaryWorkspaceRouteState | undefined;

  const { data: team } = useQuery({
    queryKey: queryKeys.teams.detail(teamId!),
    queryFn: () => fetchTeam(teamId!),
    enabled: !!teamId,
  });

  const { data: projects = [], isSuccess: isProjectsLoaded } = useQuery({
    queryKey: queryKeys.projects.byTeam(teamId!),
    queryFn: () => fetchProjects(teamId!),
    enabled: !!teamId,
  });

  const hasStoredRecentProject = !!recentProjectContext?.projectId;
  const recentProjectExists =
    hasStoredRecentProject &&
    projects.some((project) => String(project.id) === recentProjectContext.projectId);
  const shouldUseRecentProjectBackLink =
    hasStoredRecentProject && (!isProjectsLoaded || recentProjectExists);
  const backTarget = shouldUseRecentProjectBackLink
    ? ROUTES.DIAGRAMS(teamId!, recentProjectContext!.projectId)
    : ROUTES.PROJECTS(teamId!);
  const backLabel = shouldUseRecentProjectBackLink
    ? t('dictionary.backToRecentProject')
    : t('dictionary.backToProjects');

  useEffect(() => {
    if (recentProjectContext && isProjectsLoaded && !recentProjectExists) {
      clearRecentProjectContext();
    }
  }, [clearRecentProjectContext, isProjectsLoaded, recentProjectContext, recentProjectExists]);

  return (
    <div className="h-screen flex flex-col">
      <Header
        workspaceContext={{
          team: team ? { id: teamId!, name: team.name } : undefined,
          section: 'dictionary',
        }}
      />
      <main className="workspace-shell flex-1 overflow-auto p-6">
        <div className="workspace-container">
          <ProjectWorkspaceHero
            eyebrow={t('workspace.section.dictionary')}
            title={t('dictionary.title')}
            description={t('workspace.dictionary.description')}
            tone="dictionary"
            meta={
              team ? (
                <span>{t('workspace.dictionary.teamContext', { name: team.name })}</span>
              ) : undefined
            }
            className="mb-6"
            primaryAction={
              <Button variant="outline" onClick={() => navigate(backTarget)}>
                <ArrowLeft className="mr-2 h-4 w-4 text-brand-secondary" />
                {backLabel}
              </Button>
            }
          />

          {teamId && (
            <DictionaryWorkspace
              teamId={teamId}
              canEdit={canEdit}
              fixedSetId={dictionaryRouteState?.fixedSetId}
              fixedSetLabel={dictionaryRouteState?.fixedSetLabel}
            />
          )}
        </div>
      </main>
    </div>
  );
}
