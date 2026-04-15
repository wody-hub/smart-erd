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
import { Textarea } from '@/components/ui/textarea';
import type { CreateMilestonePayload, Milestone } from '@/types/milestone';

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
  loading = false,
}: MilestoneFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(initialData);

  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(initialData?.name ?? '');
    setTargetDate(initialData?.targetDate ?? '');
    setDescription(initialData?.description ?? '');
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
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
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
