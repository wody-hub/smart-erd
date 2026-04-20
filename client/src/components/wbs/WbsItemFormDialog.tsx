import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { isDateOrderValid } from '@/lib/format';
import type { Milestone } from '@/types/milestone';
import type { TeamMember } from '@/types/team';
import type { WbsItem } from '@/types/wbs';
import { collectDescendantIds } from './wbs-tree-utils';

const ROOT_VALUE = '__root__';
const NO_MILESTONE_VALUE = '__none__';
const UNASSIGNED_VALUE = '__unassigned__';

/**
 * WBS 항목 폼 값.
 */
export interface WbsItemFormValues {
  /** 항목명 */
  name: string;
  /** 부모 항목 ID */
  parentId: number | null;
  /** 담당자 사용자 ID */
  assigneeUserId: number | null;
  /** 시작일 */
  startDate: string | null;
  /** 종료일 */
  endDate: string | null;
  /** 진척률 */
  progressRate: number;
  /** 예상 M/M */
  estimatedMm: number | null;
  /** 마일스톤 ID */
  milestoneId: number | null;
}

/** WbsItemFormDialog 컴포넌트 props. */
interface WbsItemFormDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 제출 핸들러 */
  onSubmit: (values: WbsItemFormValues) => Promise<void>;
  /** 수정 대상 WBS 항목 */
  initialData?: WbsItem | null;
  /** 부모 선택용 전체 WBS 항목 */
  items: WbsItem[];
  /** 마일스톤 선택 목록 */
  milestones: Milestone[];
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
 * WBS 항목 생성/수정 다이얼로그.
 *
 * @param props WbsItemFormDialog props
 * @returns WBS 항목 폼 JSX
 */
export default function WbsItemFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  items,
  milestones,
  members,
  membersLoading = false,
  membersError = false,
  loading = false,
}: WbsItemFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(initialData);

  const [name, setName] = useState('');
  const [parentId, setParentId] = useState(ROOT_VALUE);
  const [assigneeUserId, setAssigneeUserId] = useState(UNASSIGNED_VALUE);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [progressRate, setProgressRate] = useState('0');
  const [estimatedMm, setEstimatedMm] = useState('');
  const [milestoneId, setMilestoneId] = useState(NO_MILESTONE_VALUE);

  /** 부모 후보에서 자기 자신과 하위 항목을 제외한다. (items는 이미 DFS 트리 순서) */
  const parentCandidates = useMemo(() => {
    if (!initialData) {
      return items;
    }

    const blockedIds = collectDescendantIds(initialData.id, items);
    blockedIds.add(initialData.id);
    return items.filter((item) => !blockedIds.has(item.id));
  }, [initialData, items]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(initialData?.name ?? '');
    setParentId(initialData?.parentId != null ? String(initialData.parentId) : ROOT_VALUE);
    setAssigneeUserId(
      initialData?.assigneeUserId != null ? String(initialData.assigneeUserId) : UNASSIGNED_VALUE,
    );
    setStartDate(initialData?.startDate ?? '');
    setEndDate(initialData?.endDate ?? '');
    setProgressRate(String(initialData?.progressRate ?? 0));
    setEstimatedMm(initialData?.estimatedMm != null ? String(initialData.estimatedMm) : '');
    setMilestoneId(
      initialData?.milestoneId != null ? String(initialData.milestoneId) : NO_MILESTONE_VALUE,
    );
  }, [initialData, open]);

  /**
   * 폼 제출을 처리한다.
   *
   * @param event submit 이벤트
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    if (!isDateOrderValid(startDate, endDate)) {
      toast.error(t('wbs.validation.dateOrder'));
      return;
    }

    const parsedProgressRate = Number(progressRate);
    if (Number.isNaN(parsedProgressRate) || parsedProgressRate < 0 || parsedProgressRate > 100) {
      toast.error(t('wbs.validation.progressRate'));
      return;
    }

    let parsedEstimatedMm: number | null = null;
    if (estimatedMm.trim() !== '') {
      parsedEstimatedMm = Number(estimatedMm);
      if (Number.isNaN(parsedEstimatedMm) || parsedEstimatedMm < 0) {
        toast.error(t('wbs.validation.estimatedMm'));
        return;
      }
    }

    // onSubmit은 mutateAsync 기반 Promise 계약이어야 한다. 그래야 여기서 await로 성공/실패를 정확히 동기화할 수 있다.
    await onSubmit({
      name: trimmedName,
      parentId: parentId === ROOT_VALUE ? null : Number(parentId),
      assigneeUserId: assigneeUserId === UNASSIGNED_VALUE ? null : Number(assigneeUserId),
      startDate: startDate || null,
      endDate: endDate || null,
      progressRate: parsedProgressRate,
      estimatedMm: parsedEstimatedMm,
      milestoneId: milestoneId === NO_MILESTONE_VALUE ? null : Number(milestoneId),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('wbs.form.editTitle') : t('wbs.form.createTitle')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('wbs.form.editDescription') : t('wbs.form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wbs-name">{t('wbs.form.name')}</Label>
            <Input
              id="wbs-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('wbs.form.namePlaceholder')}
              maxLength={200}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wbs-parent">{t('wbs.form.parent')}</Label>
              <Select value={parentId} onValueChange={setParentId} disabled={isEdit}>
                <SelectTrigger id="wbs-parent">
                  <SelectValue placeholder={t('wbs.form.parentPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_VALUE}>{t('wbs.form.parentRoot')}</SelectItem>
                  {parentCandidates.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {'\u00A0'.repeat(item.depth * 2)}
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wbs-assignee">{t('wbs.form.assignee')}</Label>
              <Select
                value={assigneeUserId}
                onValueChange={setAssigneeUserId}
                disabled={membersLoading || membersError}
              >
                <SelectTrigger id="wbs-assignee">
                  <SelectValue
                    placeholder={
                      membersLoading
                        ? t('wbs.form.assigneeLoading')
                        : t('wbs.form.assigneePlaceholder')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_VALUE}>{t('wbs.form.unassigned')}</SelectItem>
                  {members.map((member) => (
                    <SelectItem
                      key={member.userId}
                      value={String(member.userId)}
                      textValue={member.name}
                      secondaryText={member.loginId}
                    >
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {membersError ? (
                <p className="text-xs text-muted-foreground">{t('wbs.form.assigneeUnavailable')}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="wbs-milestone">{t('wbs.form.milestone')}</Label>
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger id="wbs-milestone">
                  <SelectValue placeholder={t('wbs.form.milestonePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MILESTONE_VALUE}>{t('wbs.form.noMilestone')}</SelectItem>
                  {milestones.map((milestone) => (
                    <SelectItem key={milestone.id} value={String(milestone.id)}>
                      {milestone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wbs-start-date">{t('wbs.form.startDate')}</Label>
              <Input
                id="wbs-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wbs-end-date">{t('wbs.form.endDate')}</Label>
              <Input
                id="wbs-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wbs-progress-rate">{t('wbs.form.progressRate')}</Label>
              <Input
                id="wbs-progress-rate"
                type="number"
                min={0}
                max={100}
                step={1}
                value={progressRate}
                onChange={(event) => setProgressRate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wbs-estimated-mm">{t('wbs.form.estimatedMm')}</Label>
              <Input
                id="wbs-estimated-mm"
                type="number"
                min={0}
                step="0.01"
                value={estimatedMm}
                onChange={(event) => setEstimatedMm(event.target.value)}
                placeholder={t('wbs.form.estimatedMmPlaceholder')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.button.cancel')}
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
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
