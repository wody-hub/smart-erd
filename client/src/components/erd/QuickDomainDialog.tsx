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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDomain } from '@/api/domainApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import { useErdDictionary } from './ErdDictionaryContext';
import type { Domain } from '@/types/dictionary';

/** QuickDomainDialog 컴포넌트 props */
interface QuickDomainDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 도메인 생성 완료 콜백 */
  onCreated: (domain: Domain) => void;
}

/**
 * 빠른 도메인 등록 다이얼로그.
 *
 * ERD 에디터에서 QuickTermDialog를 통해 새 도메인을 즉시 등록할 때 사용한다.
 * 등록 완료 시 도메인 캐시를 무효화하고, 생성된 도메인을 콜백으로 전달한다.
 *
 * @param props.open          다이얼로그 열림 상태
 * @param props.onOpenChange   열림 상태 변경 핸들러
 * @param props.onCreated      도메인 생성 완료 콜백
 */
export default function QuickDomainDialog({
  open,
  onOpenChange,
  onCreated,
}: QuickDomainDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { teamId, setId } = useErdDictionary();

  /** 논리명 입력값 */
  const [logicalName, setLogicalName] = useState('');
  /** 물리 타입 입력값 */
  const [physicalType, setPhysicalType] = useState('');
  /** 설명 입력값 */
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setLogicalName('');
      setPhysicalType('');
      setDescription('');
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      createDomain(teamId, setId, {
        logicalName,
        physicalType,
        description: description || undefined,
      }),
    onSuccess: (domain) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.domains(teamId, setId) });
      toast.success(t('erd.quickDomain.success'));
      onCreated(domain);
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('erd.quickDomain.failed'))),
  });

  /**
   * 폼 제출 핸들러.
   *
   * @param e 폼 이벤트
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('erd.quickDomain.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick-domain-logicalName">
              {t('dictionary.domain.form.logicalName')}
            </Label>
            <Input
              id="quick-domain-logicalName"
              value={logicalName}
              onChange={(e) => setLogicalName(e.target.value)}
              placeholder={t('dictionary.domain.form.logicalNamePlaceholder')}
              required
              maxLength={100}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-domain-physicalType">
              {t('dictionary.domain.form.physicalType')}
            </Label>
            <Input
              id="quick-domain-physicalType"
              value={physicalType}
              onChange={(e) => setPhysicalType(e.target.value)}
              placeholder={t('dictionary.domain.form.physicalTypePlaceholder')}
              required
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-domain-description">
              {t('dictionary.domain.form.description')}
            </Label>
            <Input
              id="quick-domain-description"
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
              disabled={mutation.isPending || !logicalName.trim() || !physicalType.trim()}
            >
              {mutation.isPending ? t('common.button.processing') : t('common.button.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
