import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Domain, DomainFormData } from '@/types/dictionary';

/** DomainFormDialog 컴포넌트 props */
interface DomainFormDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 폼 제출 핸들러 */
  onSubmit: (data: DomainFormData) => Promise<void>;
  /** 수정 대상 도메인 (없으면 생성 모드) */
  initialData?: Domain | null;
}

/**
 * 도메인 생성/수정 다이얼로그.
 *
 * initialData가 있으면 수정 모드, 없으면 생성 모드로 동작한다.
 */
export default function DomainFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: DomainFormDialogProps) {
  const { t } = useTranslation();

  /** 논리명 입력값 */
  const [logicalName, setLogicalName] = useState('');
  /** 물리 타입 입력값 */
  const [physicalType, setPhysicalType] = useState('');
  /** 설명 입력값 */
  const [description, setDescription] = useState('');
  /** 제출 중 여부 */
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!initialData;

  useEffect(() => {
    if (open) {
      setLogicalName(initialData?.logicalName ?? '');
      setPhysicalType(initialData?.physicalType ?? '');
      setDescription(initialData?.description ?? '');
    }
  }, [open, initialData]);

  /**
   * 폼 제출 핸들러.
   *
   * @param e 폼 이벤트
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ logicalName, physicalType, description: description || undefined });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('dictionary.domain.form.editTitle')
              : t('dictionary.domain.form.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain-logicalName">{t('dictionary.domain.form.logicalName')}</Label>
            <Input
              id="domain-logicalName"
              value={logicalName}
              onChange={(e) => setLogicalName(e.target.value)}
              placeholder={t('dictionary.domain.form.logicalNamePlaceholder')}
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain-physicalType">{t('dictionary.domain.form.physicalType')}</Label>
            <Input
              id="domain-physicalType"
              value={physicalType}
              onChange={(e) => setPhysicalType(e.target.value)}
              placeholder={t('dictionary.domain.form.physicalTypePlaceholder')}
              required
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain-description">{t('dictionary.domain.form.description')}</Label>
            <Input
              id="domain-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('dictionary.domain.form.descriptionPlaceholder')}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.button.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={submitting || !logicalName.trim() || !physicalType.trim()}
            >
              {submitting
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
