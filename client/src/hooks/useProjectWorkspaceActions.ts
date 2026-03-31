import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { createProject, deleteProject } from '@/api/projectApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import type { Project } from '@/types/project';

interface ProjectWorkspaceActionsResult {
  projectDialogOpen: boolean;
  setProjectDialogOpen: (open: boolean) => void;
  membersDialogOpen: boolean;
  setMembersDialogOpen: (open: boolean) => void;
  deleteTarget: number | null;
  setDeleteTarget: (projectId: number | null) => void;
  teamSettingsOpen: boolean;
  setTeamSettingsOpen: (open: boolean) => void;
  projectSettingsTarget: Project | null;
  setProjectSettingsTarget: (project: Project | null) => void;
  createProject: (name: string) => Promise<unknown>;
  confirmDeleteProject: () => void;
  deleteProjectPending: boolean;
  handleMembersChanged: () => void;
}

/** ProjectsPage의 생성/삭제/설정 다이얼로그 상태와 액션을 모은다. */
export function useProjectWorkspaceActions(teamId?: string): ProjectWorkspaceActionsResult {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [teamSettingsOpen, setTeamSettingsOpen] = useState(false);
  const [projectSettingsTarget, setProjectSettingsTarget] = useState<Project | null>(null);

  const invalidateProjects = useCallback(() => {
    if (!teamId) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.byTeam(teamId) });
  }, [queryClient, teamId]);

  const createProjectMutation = useMutation({
    mutationFn: (name: string) => createProject(teamId!, name),
    onSuccess: () => {
      invalidateProjects();
      toast.success(t('project.toast.created'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('project.toast.createFailed'))),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: number) => deleteProject(teamId!, projectId),
    onSuccess: () => {
      invalidateProjects();
      setDeleteTarget(null);
      toast.success(t('project.toast.deleted'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('project.toast.deleteFailed'))),
  });

  const handleMembersChanged = useCallback(() => {
    if (!teamId) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(teamId) });
  }, [queryClient, teamId]);

  const confirmDeleteProject = useCallback(() => {
    if (deleteTarget === null) {
      return;
    }
    deleteProjectMutation.mutate(deleteTarget);
  }, [deleteProjectMutation, deleteTarget]);

  return {
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
    createProject: createProjectMutation.mutateAsync,
    confirmDeleteProject,
    deleteProjectPending: deleteProjectMutation.isPending,
    handleMembersChanged,
  };
}
