import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Plus,
  FolderOpen,
  ArrowLeft,
  UserPlus,
  Trash2,
  BookOpen,
  Settings,
  MoreHorizontal,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateResourceDialog from '@/components/ui/create-resource-dialog';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import MembersDialog from '@/components/team/MembersDialog';
import TeamSettingsDialog from '@/components/team/TeamSettingsDialog';
import ProjectSettingsDialog from '@/components/project/ProjectSettingsDialog';
import { fetchTeam } from '@/api/teamApi';
import { fetchProjects } from '@/api/projectApi';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { useRecentProjectContext } from '@/hooks/useRecentProjectContext';
import { useTeamRole } from '@/hooks/useTeamRole';
import ProjectWorkspaceHero from '@/components/workspace/ProjectWorkspaceHero';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { useProjectWorkspaceActions } from '@/hooks/useProjectWorkspaceActions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Spinner from '@/components/ui/spinner';

/**
 * 프로젝트 목록 페이지.
 *
 * 선택된 팀의 프로젝트 목록, 프로젝트 생성, 멤버 관리 기능을 제공한다.
 * 역할에 따라 버튼을 조건부 렌더링한다.
 */
export default function ProjectsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { clearRecentProjectContext } = useRecentProjectContext(teamId);
  const { isAdmin, canEdit } = useTeamRole(teamId);
  const {
    projectDialogOpen,
    setProjectDialogOpen,
    membersDialogOpen,
    setMembersDialogOpen,
    deleteTarget,
    setDeleteTarget,
    teamSettingsOpen,
    setTeamSettingsOpen,
    projectSettingsTarget,
    setProjectSettingsTarget,
    createProject,
    confirmDeleteProject,
    deleteProjectPending,
    handleMembersChanged,
  } = useProjectWorkspaceActions(teamId);

  const { data: team } = useQuery({
    queryKey: queryKeys.teams.detail(teamId!),
    queryFn: () => fetchTeam(teamId!),
    enabled: !!teamId,
  });

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.byTeam(teamId!),
    queryFn: () => fetchProjects(teamId!),
    enabled: !!teamId,
  });
  const { data: projects = [], isLoading, isError } = projectsQuery;

  return (
    <div className="h-screen flex flex-col">
      <Header
        workspaceContext={{
          team: team ? { id: teamId!, name: team.name } : undefined,
          section: 'projects',
        }}
      />
      <main className="workspace-shell flex-1 overflow-auto p-6">
        <div className="workspace-container">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(ROUTES.TEAMS)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('project.list.backToTeams')}
          </Button>

          <ProjectWorkspaceHero
            eyebrow={t('workspace.section.projects')}
            title={team?.name ?? t('common.loading')}
            description={t('workspace.projects.description')}
            tone="projects"
            meta={
              <>
                {team?.memberCount != null && (
                  <span>{t('team.list.memberCount', { count: team.memberCount })}</span>
                )}
                <span>{t('workspace.projects.projectCount', { count: projects.length })}</span>
              </>
            }
            primaryAction={
              canEdit ? (
                <Button onClick={() => setProjectDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('project.list.newButton')}
                </Button>
              ) : undefined
            }
            utilityActions={
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    clearRecentProjectContext();
                    navigate(ROUTES.DICTIONARY(teamId!));
                  }}
                >
                  <BookOpen className="mr-2 h-4 w-4 text-brand-secondary" />
                  {t('project.list.dictionaryButton')}
                </Button>
                <Button variant="outline" onClick={() => setMembersDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4 text-primary" />
                  {t('project.list.membersButton')}
                </Button>
                {isAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => setTeamSettingsOpen(true)}
                    aria-label={t('team.aria.settings')}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {t('workspace.section.settings')}
                  </Button>
                )}
              </>
            }
          />

          {isLoading ? (
            <Spinner text={t('common.loading')} />
          ) : isError ? (
            <div className="mt-6">
              <WorkspaceEmptyState
                icon={<AlertTriangle className="h-10 w-10" />}
                title={t('workspace.status.loadFailedTitle')}
                description={t('workspace.status.projectsLoadFailed')}
                tone="error"
                role="alert"
                action={
                  <Button variant="outline" onClick={() => void projectsQuery.refetch()}>
                    {t('workspace.status.retry')}
                  </Button>
                }
              />
            </div>
          ) : projects.length === 0 ? (
            <div className="mt-6">
              <WorkspaceEmptyState
                icon={<FolderOpen className="h-10 w-10" />}
                title={t('workspace.projects.emptyTitle')}
                description={t('project.list.empty')}
                action={
                  canEdit ? (
                    <Button onClick={() => setProjectDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('project.list.createButton')}
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="workspace-grid-card group cursor-pointer"
                  onClick={() => navigate(ROUTES.DIAGRAMS(teamId!, project.id))}
                >
                  <CardHeader className="space-y-4 pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="workspace-kicker">{t('workspace.section.projects')}</p>
                        <CardTitle className="mt-3 truncate font-display text-[1.72rem] tracking-[-0.03em]">
                          {project.name}
                        </CardTitle>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                          {project.description || t('project.list.noDescription')}
                        </p>
                      </div>
                      {canEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                              aria-label={t('workspace.action.projectActions')}
                            >
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => setProjectSettingsTarget(project)}
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              {t('project.settings.title')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => setDeleteTarget(project.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('common.button.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4 text-xs uppercase tracking-[0.12em] text-ink-secondary">
                      <span className="truncate">
                        {t('project.list.createdAt', {
                          date: new Date(project.createdAt).toLocaleDateString(
                            i18n.resolvedLanguage ?? i18n.language,
                          ),
                        })}
                      </span>
                      <span className="font-medium text-foreground transition-colors group-hover:text-primary">
                        {t('workspace.projects.openProject')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <CreateResourceDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        title={t('project.create.dialogTitle')}
        inputLabel={t('project.create.inputLabel')}
        placeholder={t('project.create.placeholder')}
        onCreate={createProject}
      />

      <MembersDialog
        open={membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
        teamId={teamId!}
        isAdmin={isAdmin}
        onMembersChanged={handleMembersChanged}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('project.delete.dialogTitle')}
        description={t('project.delete.dialogDescription')}
        onConfirm={confirmDeleteProject}
        loading={deleteProjectPending}
      />

      {team && (
        <TeamSettingsDialog
          open={teamSettingsOpen}
          onOpenChange={setTeamSettingsOpen}
          team={team}
          teamId={teamId!}
        />
      )}

      {projectSettingsTarget && (
        <ProjectSettingsDialog
          open={!!projectSettingsTarget}
          onOpenChange={(open) => {
            if (!open) setProjectSettingsTarget(null);
          }}
          project={projectSettingsTarget}
          teamId={teamId!}
        />
      )}
    </div>
  );
}
