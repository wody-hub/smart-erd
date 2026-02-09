import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { fetchMembers, inviteMember, removeMember } from '@/api/teamApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';

/** MembersDialog 컴포넌트의 props. */
interface MembersDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 대상 팀 ID */
  teamId: string;
  /** 멤버 변경(초대/제거) 시 호출되는 콜백 (팀 정보 갱신용) */
  onMembersChanged?: () => void;
}

/**
 * 팀 멤버 관리 다이얼로그. 멤버 목록 조회, 초대, 제거 기능을 제공한다.
 *
 * @param props.open             다이얼로그 열림 상태
 * @param props.onOpenChange     다이얼로그 열림 상태 변경 핸들러
 * @param props.teamId           대상 팀 ID
 * @param props.onMembersChanged 멤버 변경 시 호출되는 콜백 (팀 정보 갱신용)
 */
export default function MembersDialog({
  open,
  onOpenChange,
  teamId,
  onMembersChanged,
}: MembersDialogProps) {
  const queryClient = useQueryClient();
  /** 초대할 사용자 로그인 ID 입력값 */
  const [inviteLoginId, setInviteLoginId] = useState('');
  /** 초대할 멤버에게 부여할 역할 */
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'VIEWER'>('MEMBER');
  /** 초대 실패 시 에러 메시지 */
  const [inviteError, setInviteError] = useState('');

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.teams.members(teamId),
    queryFn: () => fetchMembers(teamId),
    enabled: open,
  });

  const inviteMutation = useMutation({
    mutationFn: ({ loginId, role }: { loginId: string; role: string }) =>
      inviteMember(teamId, loginId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.members(teamId) });
      onMembersChanged?.();
      setInviteLoginId('');
      setInviteError('');
    },
    onError: (err) => setInviteError(getErrorMessage(err, 'Failed to invite member')),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: number) => removeMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.members(teamId) });
      onMembersChanged?.();
      toast.success('Member removed');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to remove member')),
  });

  /** 멤버 초대 폼 제출 핸들러. @param e 폼 이벤트 */
  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteLoginId.trim()) return;
    setInviteError('');
    inviteMutation.mutate({ loginId: inviteLoginId.trim(), role: inviteRole });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Team Members</DialogTitle>
          <DialogDescription>Manage members of this team.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="invite-id" className="text-xs">
              Login ID
            </Label>
            <Input
              id="invite-id"
              placeholder="Login ID"
              value={inviteLoginId}
              onChange={(e) => setInviteLoginId(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-role" className="text-xs">
              Role
            </Label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'MEMBER' | 'VIEWER')}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="MEMBER">MEMBER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={inviteMutation.isPending || !inviteLoginId.trim()}
          >
            {inviteMutation.isPending ? '...' : 'Invite'}
          </Button>
        </form>
        {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}

        <div className="space-y-2 mt-4 max-h-64 overflow-auto">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between p-2 rounded-md bg-muted"
            >
              <div>
                <p className="text-sm font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.loginId}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-background border">
                  {member.role}
                </span>
                {member.role !== 'ADMIN' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeMutation.mutate(member.userId)}
                    aria-label={`Remove member ${member.name}`}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
