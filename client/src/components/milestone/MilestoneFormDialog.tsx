import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CreateMilestonePayload, Milestone, MilestoneType } from '@/types/milestone';
import type { TeamMember } from '@/types/team';

const UNASSIGNED_VALUE = '__unassigned__';

/** MilestoneFormDialog 컴포넌트 props. */
interface MilestoneFormDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 생성/수정 제출 핸들러 */
  onSubmit: (payload: CreateMilestonePayload) => Promise<void>;
  /** 수정 대상 마일스톤 */
  initialData?: Milestone | null;
  /** 담당자 선택 목록 */
  members: TeamMember[];
  /** 담당자 목록 로딩 여부 */
  membersLoading?: boolean;
  /** 담당자 목록 에러 여부 */
  membersError?: boolean;
  /** 제출 중 여부 */
  loading?: boolean;
}

/**
 * 마일스톤 생성/수정 폼 다이얼로그.
 *
 * @param props MilestoneFormDialog props
 * @returns 마일스톤 폼 다이얼로그 JSX
 */
export default function MilestoneFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  members,
  membersLoading = false,
  membersError = false,
  loading = false,
}: MilestoneFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(initialData);

  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<MilestoneType>('DELIVERABLE');
  const [ownerUserId, setOwnerUserId] = useState(UNASSIGNED_VALUE);
  const [readinessNote, setReadinessNote] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(initialData?.name ?? '');
    setTargetDate(initialData?.targetDate ?? '');
    setDescription(initialData?.description ?? '');
    setType(initialData?.type ?? 'DELIVERABLE');
    setOwnerUserId(
      initialData?.ownerUserId != null ? String(initialData.ownerUserId) : UNASSIGNED_VALUE,
    );
    setReadinessNote(initialData?.readinessNote ?? '');
  }, [initialData, open]);

  /**
   * 마일스톤 폼을 제출한다.
   *
   * @param event submit 이벤트
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName || !targetDate) {
      return;
    }

    // onSubmit은 mutateAsync 기반 Promise 계약이어야 한다. 그래야 여기서 await로 성공/실패를 정확히 동기화할 수 있다.
    await onSubmit({
      name: trimmedName,
      targetDate,
      description: description.trim() || null,
      type,
      ownerUserId: ownerUserId === UNASSIGNED_VALUE ? null : Number(ownerUserId),
      readinessNote: readinessNote.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('milestone.form.editTitle') : t('milestone.form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t('milestone.form.editDescription') : t('milestone.form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="milestone-name">{t('milestone.form.name')}</Label>
            <Input
              id="milestone-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('milestone.form.namePlaceholder')}
              required
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="milestone-target-date">{t('milestone.form.targetDate')}</Label>
              <Input
                id="milestone-target-date"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="milestone-type">{t('milestone.form.type')}</Label>
              <Select value={type} onValueChange={(value) => setType(value as MilestoneType)}>
                <SelectTrigger id="milestone-type">
                  <SelectValue placeholder={t('milestone.form.typePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {(['DELIVERABLE', 'APPROVAL', 'RELEASE', 'HANDOFF', 'DECISION'] as const).map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {t(`milestone.type.${value}`)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="milestone-owner">{t('milestone.form.owner')}</Label>
            <Select
              value={ownerUserId}
              onValueChange={setOwnerUserId}
              disabled={membersLoading || membersError}
            >
              <SelectTrigger id="milestone-owner">
                <SelectValue
                  placeholder={
                    membersLoading
                      ? t('milestone.form.ownerLoading')
                      : t('milestone.form.ownerPlaceholder')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_VALUE}>{t('milestone.form.noOwner')}</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.userId} value={String(member.userId)}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {membersError ? (
              <p className="text-xs text-muted-foreground">
                {t('milestone.form.ownerUnavailable')}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="milestone-description">{t('milestone.form.description')}</Label>
            <Textarea
              id="milestone-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('milestone.form.descriptionPlaceholder')}
              rows={4}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="milestone-readiness-note">{t('milestone.form.readinessNote')}</Label>
            <Textarea
              id="milestone-readiness-note"
              value={readinessNote}
              onChange={(event) => setReadinessNote(event.target.value)}
              placeholder={t('milestone.form.readinessNotePlaceholder')}
              rows={3}
              maxLength={2000}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.button.cancel')}
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !targetDate}>
              {loading
                ? t('common.button.processing')
                : isEdit
                  ? t('common.button.save')
                  : t('common.button.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
