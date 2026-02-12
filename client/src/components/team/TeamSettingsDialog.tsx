import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateTeam, deleteTeam } from '@/api/teamApi';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api-error';
import type { Team } from '@/types/team';

/** TeamSettingsDialog 컴포넌트의 props. */
interface TeamSettingsDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 팀 정보 (이름 초기값, 삭제 확인용) */
  team: Team;
  /** 팀 ID (API 호출용) */
  teamId: string;
}

/**
 * 팀 설정 다이얼로그.
 *
 * 팀 이름 변경과 팀 삭제(위험 구역) 기능을 제공한다.
 * 삭제 시 팀 이름을 정확히 입력해야 삭제 버튼이 활성화된다.
 *
 * @param props.open         다이얼로그 열림 상태
 * @param props.onOpenChange 다이얼로그 열림 상태 변경 핸들러
 * @param props.team         팀 정보
 * @param props.teamId       팀 ID
 */
export default function TeamSettingsDialog({
  open,
  onOpenChange,
  team,
  teamId,
}: TeamSettingsDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  /** 팀 이름 입력값 */
  const [name, setName] = useState(team.name);
  /** 삭제 확인 입력값 */
  const [deleteConfirmValue, setDeleteConfirmValue] = useState('');

  useEffect(() => {
    if (open) {
      setName(team.name);
      setDeleteConfirmValue('');
    }
  }, [open, team.name]);

  const updateTeamMutation = useMutation({
    mutationFn: (newName: string) => updateTeam(teamId, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(teamId) });
      toast.success(t('team.toast.updated'));
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('team.toast.updateFailed'))),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: () => deleteTeam(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
      toast.success(t('team.toast.deleted'));
      onOpenChange(false);
      navigate(ROUTES.TEAMS);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('team.toast.deleteFailed'))),
  });

  /** 팀 이름 변경 폼 제출 핸들러. */
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateTeamMutation.mutate(name.trim());
  };

  /** 팀 삭제 핸들러. */
  const handleDelete = () => {
    deleteTeamMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('team.settings.title')}</DialogTitle>
          <DialogDescription>{t('team.settings.description')}</DialogDescription>
        </DialogHeader>

        {/* Team name form */}
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="team-name">{t('team.settings.nameLabel')}</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || name.trim() === team.name || updateTeamMutation.isPending}
            >
              {t('team.settings.save')}
            </Button>
          </div>
        </form>

        {/* Danger zone */}
        <div className="mt-4 border-t border-destructive/30 pt-4">
          <h3 className="text-sm font-semibold text-destructive mb-2">
            {t('team.settings.dangerZone')}
          </h3>
          <p className="text-sm text-muted-foreground mb-3">{t('team.settings.deleteWarning')}</p>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm" className="text-sm">
              {t('team.settings.deleteConfirmDescription', { name: team.name })}
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmValue}
              onChange={(e) => setDeleteConfirmValue(e.target.value)}
              placeholder={t('team.settings.deleteConfirmPlaceholder')}
              className="h-9"
            />
            <div className="flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteConfirmValue !== team.name || deleteTeamMutation.isPending}
              >
                {t('team.settings.deleteButton')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
