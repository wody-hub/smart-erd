import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isDateOrderValid } from '@/lib/format';
import { hasAnyActualInput, isValidParticipation, validateActualInput } from './staffing-dialog-validation';
import type {
  CreateProjectStaffingPayload,
  ProjectStaffingResource,
  StaffingGrade,
  UpdateProjectStaffingPayload,
} from '@/types/staffing';
import type { TeamMember } from '@/types/team';

const NO_MEMBER_VALUE = '__none__';
const MAX_MONTHLY_RATE = 999_999_999;

interface StaffingResourceDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 수정 대상 리소스 (null이면 생성 모드) */
  initialData: ProjectStaffingResource | null;
  /** 팀 멤버 목록 */
  members: TeamMember[];
  /** 이미 인력 행이 존재하는 사용자 ID 목록 */
  staffedUserIds: Set<number>;
  /** 제출 핸들러 */
  onSubmit: (
    payload: CreateProjectStaffingPayload | UpdateProjectStaffingPayload,
    mode: 'create' | 'edit',
  ) => Promise<void>;
  /** 제출 중 여부 */
  loading?: boolean;
}

function parseOptionalDate(value: string): string | null {
  return value.trim() === '' ? null : value;
}

/**
 * 인력 투입 생성/수정 다이얼로그.
 *
 * @param props 다이얼로그 props
 * @returns 인력 투입 다이얼로그 JSX
 */
export default function StaffingResourceDialog({
  open,
  onOpenChange,
  initialData,
  members,
  staffedUserIds,
  onSubmit,
  loading = false,
}: StaffingResourceDialogProps) {
  const { t } = useTranslation();
  const isEdit = initialData != null;

  const [memberId, setMemberId] = useState(NO_MEMBER_VALUE);
  const [grade, setGrade] = useState<StaffingGrade>('JUNIOR');
  const [monthlyRate, setMonthlyRate] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [plannedParticipationRate, setPlannedParticipationRate] = useState('100');
  const [actualStartDate, setActualStartDate] = useState('');
  const [actualEndDate, setActualEndDate] = useState('');
  const [actualParticipationRate, setActualParticipationRate] = useState('');

  const memberTriggerRef = useRef<HTMLButtonElement | null>(null);
  const monthlyRateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialData) {
      setMemberId(String(initialData.userId));
      setGrade(initialData.grade);
      setMonthlyRate(String(initialData.monthlyRate));
      setPlannedStartDate(initialData.plannedStartDate);
      setPlannedEndDate(initialData.plannedEndDate);
      setPlannedParticipationRate(String(initialData.plannedParticipationRate));
      setActualStartDate(initialData.actualStartDate ?? '');
      setActualEndDate(initialData.actualEndDate ?? '');
      setActualParticipationRate(
        initialData.actualParticipationRate != null ? String(initialData.actualParticipationRate) : '',
      );
      return;
    }

    setMemberId(NO_MEMBER_VALUE);
    setGrade('JUNIOR');
    setMonthlyRate('');
    setPlannedStartDate('');
    setPlannedEndDate('');
    setPlannedParticipationRate('100');
    setActualStartDate('');
    setActualEndDate('');
    setActualParticipationRate('');
  }, [initialData, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (isEdit) {
        monthlyRateInputRef.current?.focus();
      } else {
        memberTriggerRef.current?.focus();
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isEdit, open]);

  const availableMembers = useMemo(() => {
    if (isEdit && initialData) {
      return members;
    }

    return members.filter((member) => !staffedUserIds.has(member.userId));
  }, [initialData, isEdit, members, staffedUserIds]);

  const selectedMember = useMemo(() => {
    if (!initialData) {
      return null;
    }
    return members.find((member) => member.userId === initialData.userId) ?? null;
  }, [initialData, members]);

  /**
   * 다이얼로그 제출을 처리한다.
   *
   * @param event 폼 submit 이벤트
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isEdit && memberId === NO_MEMBER_VALUE) {
      toast.error(t('staffing.validation.memberRequired'));
      return;
    }

    if (!plannedStartDate || !plannedEndDate) {
      toast.error(t('staffing.validation.plannedDatePair'));
      return;
    }

    if (!isDateOrderValid(plannedStartDate, plannedEndDate)) {
      toast.error(t('staffing.validation.plannedDateOrder'));
      return;
    }

    if (plannedParticipationRate.trim() === '') {
      toast.error(t('staffing.validation.plannedParticipation'));
      return;
    }

    const parsedPlannedParticipation = Number(plannedParticipationRate);
    if (!isValidParticipation(parsedPlannedParticipation)) {
      toast.error(t('staffing.validation.plannedParticipation'));
      return;
    }

    if (monthlyRate.trim() === '') {
      toast.error(t('staffing.validation.invalidRate'));
      return;
    }

    const parsedMonthlyRate = Number(monthlyRate);
    if (!Number.isInteger(parsedMonthlyRate) || parsedMonthlyRate < 0) {
      toast.error(t('staffing.validation.invalidRate'));
      return;
    }

    if (parsedMonthlyRate > MAX_MONTHLY_RATE) {
      toast.error(t('staffing.validation.rateOutOfRange'));
      return;
    }

    const actualInput = {
      actualStartDate,
      actualEndDate,
      actualParticipationRate,
    };

    const hasAnyActualField = hasAnyActualInput(actualInput);
    const actualValidationError = validateActualInput(actualInput);
    if (actualValidationError) {
      toast.error(t(`staffing.validation.${actualValidationError}`));
      return;
    }

    const payloadBase = {
      grade,
      monthlyRate: parsedMonthlyRate,
      plannedStartDate,
      plannedEndDate,
      plannedParticipationRate: parsedPlannedParticipation,
      actualStartDate: parseOptionalDate(actualStartDate),
      actualEndDate: parseOptionalDate(actualEndDate),
      actualParticipationRate: hasAnyActualField ? Number(actualParticipationRate) : null,
    };

    try {
      if (isEdit) {
        await onSubmit(payloadBase, 'edit');
      } else {
        await onSubmit(
          {
            userId: Number(memberId),
            ...payloadBase,
          },
          'create',
        );
      }
      onOpenChange(false);
    } catch {
      // mutateAsync error는 상위에서 toast 처리한다.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('staffing.form.editTitle') : t('staffing.form.createTitle')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('staffing.form.editDescription') : t('staffing.form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="staffing-member">{t('staffing.field.member')}</Label>
              {isEdit ? (
                <>
                  <Input
                    id="staffing-member"
                    value={selectedMember?.name ?? initialData?.memberName ?? ''}
                    readOnly
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">{t('staffing.form.memberLocked')}</p>
                </>
              ) : (
                <Select value={memberId} onValueChange={setMemberId}>
                  <SelectTrigger id="staffing-member" ref={memberTriggerRef}>
                    <SelectValue placeholder={t('staffing.form.memberPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_MEMBER_VALUE} disabled>
                      {t('staffing.form.memberPlaceholder')}
                    </SelectItem>
                    {availableMembers.map((member) => (
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
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="staffing-grade">{t('staffing.field.grade')}</Label>
              <Select value={grade} onValueChange={(nextValue) => setGrade(nextValue as StaffingGrade)}>
                <SelectTrigger id="staffing-grade">
                  <SelectValue placeholder={t('staffing.form.gradePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JUNIOR">{t('staffing.grade.junior')}</SelectItem>
                  <SelectItem value="MIDDLE">{t('staffing.grade.middle')}</SelectItem>
                  <SelectItem value="SENIOR">{t('staffing.grade.senior')}</SelectItem>
                  <SelectItem value="EXPERT">{t('staffing.grade.expert')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staffing-monthly-rate">{t('staffing.field.monthlyRate')}</Label>
              <Input
                id="staffing-monthly-rate"
                ref={monthlyRateInputRef}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_MONTHLY_RATE}
                step={1}
                placeholder={t('staffing.form.ratePlaceholder')}
                value={monthlyRate}
                onChange={(event) => setMonthlyRate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staffing-planned-start">{t('staffing.form.plannedStartDate')}</Label>
              <Input
                id="staffing-planned-start"
                type="date"
                value={plannedStartDate}
                onChange={(event) => setPlannedStartDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staffing-planned-end">{t('staffing.form.plannedEndDate')}</Label>
              <Input
                id="staffing-planned-end"
                type="date"
                value={plannedEndDate}
                onChange={(event) => setPlannedEndDate(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="staffing-planned-participation">
                {t('staffing.field.plannedParticipation')}
              </Label>
              <Input
                id="staffing-planned-participation"
                type="number"
                min={0}
                max={100}
                step={1}
                value={plannedParticipationRate}
                onChange={(event) => setPlannedParticipationRate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staffing-actual-start">{t('staffing.form.actualStartDate')}</Label>
              <Input
                id="staffing-actual-start"
                type="date"
                value={actualStartDate}
                onChange={(event) => setActualStartDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staffing-actual-end">{t('staffing.form.actualEndDate')}</Label>
              <Input
                id="staffing-actual-end"
                type="date"
                value={actualEndDate}
                onChange={(event) => setActualEndDate(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="staffing-actual-participation">
                {t('staffing.field.actualParticipation')}
              </Label>
              <Input
                id="staffing-actual-participation"
                type="number"
                min={0}
                max={100}
                step={1}
                value={actualParticipationRate}
                onChange={(event) => setActualParticipationRate(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t('staffing.form.close')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? t('staffing.form.saving')
                : isEdit
                  ? t('staffing.form.saveAction')
                  : t('staffing.form.createAction')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
