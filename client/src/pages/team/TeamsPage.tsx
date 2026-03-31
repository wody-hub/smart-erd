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
      <main className="flex-1 overflow-auto bg-muted p-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/50 px-6 py-8 md:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t('workspace.section.teams')}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t('team.list.title')}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t('workspace.teams.description')}
                </p>
              </div>
              <div className="shrink-0">
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('team.list.newButton')}
                </Button>
              </div>
            </div>
          </div>

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
                  className="cursor-pointer border-border/70 transition-all hover:border-foreground/20 hover:shadow-sm"
                  onClick={() => navigate(ROUTES.PROJECTS(team.id))}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{t('team.list.memberCount', { count: team.memberCount })}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('team.list.owner', { name: team.ownerName })}
                    </p>
                    <p className="text-xs font-medium text-foreground/80">
                      {t('workspace.teams.openWorkspace')}
                    </p>
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
