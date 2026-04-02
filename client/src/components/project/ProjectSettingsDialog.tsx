import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateProject } from '@/api/projectApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import type { Project } from '@/types/project';

/** ProjectSettingsDialog 컴포넌트의 props. */
interface ProjectSettingsDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 프로젝트 정보 (초기값) */
  project: Project;
  /** 팀 ID (API 호출용) */
  teamId: string;
}

/**
 * 프로젝트 설정 다이얼로그.
 *
 * 프로젝트 이름과 설명을 편집할 수 있다.
 *
 * @param props.open         다이얼로그 열림 상태
 * @param props.onOpenChange 다이얼로그 열림 상태 변경 핸들러
 * @param props.project      프로젝트 정보
 * @param props.teamId       팀 ID
 */
export default function ProjectSettingsDialog({
  open,
  onOpenChange,
  project,
  teamId,
}: ProjectSettingsDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  /** 프로젝트 이름 입력값 */
  const [name, setName] = useState(project.name);
  /** 프로젝트 설명 입력값 */
  const [description, setDescription] = useState(project.description ?? '');

  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? '');
    }
  }, [open, project.name, project.description]);

  const updateProjectMutation = useMutation({
    mutationFn: () =>
      updateProject(teamId, project.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.byTeam(teamId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.detail(teamId, String(project.id)),
      });
      toast.success(t('project.toast.updated'));
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('project.toast.updateFailed'))),
  });

  /** 폼 제출 핸들러. */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateProjectMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('project.settings.title')}</DialogTitle>
          <DialogDescription>{t('project.settings.title')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="project-name">{t('project.settings.nameLabel')}</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="project-description">{t('project.settings.descriptionLabel')}</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('project.settings.descriptionPlaceholder')}
              maxLength={500}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.button.cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim() || updateProjectMutation.isPending}>
              {t('common.button.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
