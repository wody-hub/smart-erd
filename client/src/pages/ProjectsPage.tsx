import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, ArrowLeft, UserPlus, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateResourceDialog from '@/components/ui/create-resource-dialog';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import MembersDialog from '@/components/team/MembersDialog';
import { fetchTeam } from '@/api/teamApi';
import { fetchProjects, createProject, deleteProject } from '@/api/projectApi';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';

/**
 * 프로젝트 목록 페이지.
 *
 * 선택된 팀의 프로젝트 목록, 프로젝트 생성, 멤버 관리 기능을 제공한다.
 */
export default function ProjectsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /** 프로젝트 생성 다이얼로그 열림 상태 */
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  /** 멤버 관리 다이얼로그 열림 상태 */
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  /** 삭제 확인 대상 프로젝트 ID (null이면 다이얼로그 닫힘) */
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: team } = useQuery({
    queryKey: queryKeys.teams.detail(teamId!),
    queryFn: () => fetchTeam(teamId!),
    enabled: !!teamId,
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: queryKeys.projects.byTeam(teamId!),
    queryFn: () => fetchProjects(teamId!),
    enabled: !!teamId,
  });

  const createProjectMutation = useMutation({
    mutationFn: (name: string) => createProject(teamId!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.byTeam(teamId!) });
      toast.success('Project created');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to create project')),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: number) => deleteProject(teamId!, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.byTeam(teamId!) });
      setDeleteTarget(null);
      toast.success('Project deleted');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete project')),
  });

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-muted p-6">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(ROUTES.TEAMS)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Teams
          </Button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">{team?.name ?? 'Loading...'}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {team?.memberCount} member{team?.memberCount !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMembersDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Members
              </Button>
              <Button onClick={() => setProjectDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No projects yet. Create your first project.
                </p>
                <Button onClick={() => setProjectDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => navigate(ROUTES.DIAGRAMS(teamId!, project.id))}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(project.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(project.createdAt).toLocaleDateString()}
                    </p>
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
        title="Create New Project"
        inputLabel="Project Name"
        placeholder="Enter project name"
        onCreate={(name) => createProjectMutation.mutateAsync(name)}
      />

      <MembersDialog
        open={membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
        teamId={teamId!}
        onMembersChanged={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(teamId!) });
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Project"
        description="Are you sure you want to delete this project?"
        onConfirm={() => {
          if (deleteTarget !== null) deleteProjectMutation.mutate(deleteTarget);
        }}
        loading={deleteProjectMutation.isPending}
      />
    </div>
  );
}
