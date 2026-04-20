import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus } from 'lucide-react';
import { fetchProject } from '@/api/projectApi';
import { fetchTeam } from '@/api/teamApi';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import WbsWorkspaceContent, {
  type WbsWorkspaceContentHandle,
} from '@/components/wbs/WbsWorkspaceContent';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { useTeamRole } from '@/hooks/useTeamRole';

/**
 * dedicated WBS workspace 페이지.
 *
 * @returns ProjectWbsPage JSX
 */
export default function ProjectWbsPage() {
  const { teamId, projectId } = useParams<{ teamId: string; projectId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { canEdit } = useTeamRole(teamId);
  const workspaceRef = useRef<WbsWorkspaceContentHandle | null>(null);

  const { data: team } = useQuery({
    queryKey: queryKeys.teams.detail(teamId!),
    queryFn: () => fetchTeam(teamId!),
    enabled: Boolean(teamId),
  });

  const { data: project } = useQuery({
    queryKey: queryKeys.projects.detail(teamId!, projectId!),
    queryFn: () => fetchProject(teamId!, projectId!),
    enabled: Boolean(teamId) && Boolean(projectId),
  });

  return (
    <div className="flex h-screen flex-col">
      <Header
        workspaceContext={{
          team: team ? { id: teamId!, name: team.name } : undefined,
          project: project ? { id: projectId!, name: project.name } : undefined,
          section: 'projects',
        }}
      />

      <main className="workspace-shell flex-1 overflow-auto p-3 sm:p-6">
        <div className="workspace-container max-w-none space-y-6">
          <section className="surface-operational rounded-xl p-4 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 w-fit"
                  onClick={() =>
                    navigate(ROUTES.DIAGRAMS(teamId!, projectId!), {
                      state: { initialTab: 'wbs' as const },
                    })
                  }
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('wbs.workspace.backToProject')}
                </Button>

                <div className="space-y-2">
                  <p className="workspace-kicker">{t('wbs.workspace.title')}</p>
                  <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                    {project?.name ?? t('common.loading')}
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                    {t('wbs.workspace.description')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {team ? <span className="workspace-meta-chip">{team.name}</span> : null}
                  <span className="workspace-meta-chip">{t('workspace.projectHub.wbsMeta')}</span>
                </div>
              </div>

              {canEdit ? (
                <div className="shrink-0">
                  <Button onClick={() => workspaceRef.current?.openCreateDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('wbs.action.create')}
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          <WbsWorkspaceContent
            ref={workspaceRef}
            teamId={teamId!}
            projectId={projectId!}
            canEdit={canEdit}
            variant="page"
          />
        </div>
      </main>
    </div>
  );
}
