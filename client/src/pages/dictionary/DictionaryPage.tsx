import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import DictionaryWorkspace from '@/components/dictionary/DictionaryWorkspace';
import { fetchProjects } from '@/api/projectApi';
import { fetchTeam } from '@/api/teamApi';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { useRecentProjectContext } from '@/hooks/useRecentProjectContext';
import { useTeamRole } from '@/hooks/useTeamRole';

/**
 * 데이터 사전 페이지.
 *
 * 사전 세트를 선택한 뒤 도메인/용어 탭을 세트 스코프로 관리한다.
 */
export default function DictionaryPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { canEdit } = useTeamRole(teamId);
  const { recentProjectContext, clearRecentProjectContext } = useRecentProjectContext(teamId);

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
      <main className="flex-1 overflow-auto bg-muted p-6">
        <div className="mx-auto w-full max-w-[1400px]">
          <Card className="mb-6 border-border/70 bg-gradient-to-br from-background via-background to-muted/50">
            <CardContent className="flex flex-col gap-5 p-6 md:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {t('workspace.section.dictionary')}
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                    {t('dictionary.title')}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {t('workspace.dictionary.description')}
                  </p>
                  {team && (
                    <p className="mt-4 text-sm text-muted-foreground">
                      {t('workspace.dictionary.teamContext', { name: team.name })}
                    </p>
                  )}
                </div>
                <Button variant="outline" onClick={() => navigate(backTarget)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {backLabel}
                </Button>
              </div>
            </CardContent>
          </Card>

          {teamId && <DictionaryWorkspace teamId={teamId} canEdit={canEdit} />}
        </div>
      </main>
    </div>
  );
}
