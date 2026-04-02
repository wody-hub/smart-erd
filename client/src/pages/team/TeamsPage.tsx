import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, Users } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateResourceDialog from '@/components/ui/create-resource-dialog';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import ProjectWorkspaceHero from '@/components/workspace/ProjectWorkspaceHero';
import { fetchTeams, createTeam } from '@/api/teamApi';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';
import Spinner from '@/components/ui/spinner';

/**
 * 팀 목록 페이지.
 *
 * 사용자가 속한 팀 목록을 표시하고, 새 팀 생성 기능을 제공한다.
 * 팀 카드를 클릭하면 해당 팀의 프로젝트 목록으로 이동한다.
 */
export default function TeamsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  /** 팀 생성 다이얼로그 열림 상태 */
  const [dialogOpen, setDialogOpen] = useState(false);

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.all,
    queryFn: fetchTeams,
  });
  const { data: teams = [], isLoading, isError } = teamsQuery;

  const createTeamMutation = useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
      toast.success(t('team.toast.created'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('team.toast.createFailed'))),
  });

  return (
    <div className="h-screen flex flex-col">
      <Header workspaceContext={{ section: 'teams' }} />
      <main className="workspace-shell flex-1 overflow-auto p-6">
        <div className="workspace-container">
          <ProjectWorkspaceHero
            eyebrow={t('workspace.section.teams')}
            title={t('team.list.title')}
            description={t('workspace.teams.description')}
            tone="teams"
            meta={<span>{t('workspace.teams.teamCount', { count: teams.length })}</span>}
            primaryAction={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('team.list.newButton')}
              </Button>
            }
          />

          {isLoading ? (
            <Spinner text={t('common.loading')} />
          ) : isError ? (
            <div className="mt-6">
              <WorkspaceEmptyState
                icon={<AlertTriangle className="h-10 w-10" />}
                title={t('workspace.status.loadFailedTitle')}
                description={t('workspace.status.teamsLoadFailed')}
                tone="error"
                role="alert"
                action={
                  <Button variant="outline" onClick={() => void teamsQuery.refetch()}>
                    {t('workspace.status.retry')}
                  </Button>
                }
              />
            </div>
          ) : teams.length === 0 ? (
            <div className="mt-6">
              <WorkspaceEmptyState
                icon={<Users className="h-10 w-10" />}
                title={t('workspace.teams.emptyTitle')}
                description={t('team.list.empty')}
                action={
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('team.list.createButton')}
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {teams.map((team) => (
                <Card
                  key={team.id}
                  className="workspace-grid-card group cursor-pointer"
                  onClick={() => navigate(ROUTES.PROJECTS(team.id))}
                >
                  <CardHeader className="space-y-4 pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-secondary/12 text-brand-secondary">
                        <Users className="h-5 w-5" />
                      </span>
                      <span className="workspace-kicker">{t('workspace.section.teams')}</span>
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate font-sans text-[1.66rem] tracking-[-0.035em]">
                        {team.name}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-ink-secondary">
                      <Users className="h-4 w-4 text-brand-secondary" />
                      <span>{t('team.list.memberCount', { count: team.memberCount })}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('team.list.owner', { name: team.ownerName })}
                    </p>
                    <div className="flex items-center justify-between border-t border-border/70 pt-4">
                      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {t('workspace.section.teams')}
                      </span>
                      <p className="text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                        {t('workspace.teams.openWorkspace')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <CreateResourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={t('team.create.dialogTitle')}
        inputLabel={t('team.create.inputLabel')}
        placeholder={t('team.create.placeholder')}
        onCreate={(name) => createTeamMutation.mutateAsync(name)}
      />
    </div>
  );
}
