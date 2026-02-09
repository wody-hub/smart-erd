import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchDomains } from '@/api/domainApi';
import { queryKeys } from '@/constants/query-keys';
import type { Term, TermFormData } from '@/types/dictionary';

/** "없음" 선택 시 사용하는 센티넬 값 */
const NONE_VALUE = '__none__';

/** TermFormDialog 컴포넌트 props */
interface TermFormDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 폼 제출 핸들러 */
  onSubmit: (data: TermFormData) => Promise<void>;
  /** 수정 대상 용어 (없으면 생성 모드) */
  initialData?: Term | null;
}

/**
 * 용어 생성/수정 다이얼로그.
 *
 * initialData가 있으면 수정 모드, 없으면 생성 모드로 동작한다.
 * 도메인 Select에서 팀의 도메인 목록을 로드한다.
 */
export default function TermFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: TermFormDialogProps) {
  const { teamId } = useParams<{ teamId: string }>();
  const { t } = useTranslation();

  /** 논리명 입력값 */
  const [logicalName, setLogicalName] = useState('');
  /** 물리명 입력값 */
  const [physicalName, setPhysicalName] = useState('');
  /** 연결 도메인 ID (문자열 — Select 호환) */
  const [domainId, setDomainId] = useState<string>(NONE_VALUE);
  /** 설명 입력값 */
  const [description, setDescription] = useState('');
  /** 제출 중 여부 */
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!initialData;

  const { data: domains = [] } = useQuery({
    queryKey: queryKeys.dictionary.domains(teamId!),
    queryFn: () => fetchDomains(teamId!),
    enabled: open && !!teamId,
  });

  useEffect(() => {
    if (open) {
      setLogicalName(initialData?.logicalName ?? '');
      setPhysicalName(initialData?.physicalName ?? '');
      setDomainId(initialData?.domainId != null ? String(initialData.domainId) : NONE_VALUE);
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
      await onSubmit({
        logicalName,
        physicalName,
        domainId: domainId !== NONE_VALUE ? Number(domainId) : null,
        description: description || undefined,
      });
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
            {isEdit ? t('dictionary.term.form.editTitle') : t('dictionary.term.form.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="term-logicalName">{t('dictionary.term.form.logicalName')}</Label>
            <Input
              id="term-logicalName"
              value={logicalName}
              onChange={(e) => setLogicalName(e.target.value)}
              placeholder={t('dictionary.term.form.logicalNamePlaceholder')}
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="term-physicalName">{t('dictionary.term.form.physicalName')}</Label>
            <Input
              id="term-physicalName"
              value={physicalName}
              onChange={(e) => setPhysicalName(e.target.value)}
              placeholder={t('dictionary.term.form.physicalNamePlaceholder')}
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="term-domain">{t('dictionary.term.form.domain')}</Label>
            <Select value={domainId} onValueChange={setDomainId}>
              <SelectTrigger id="term-domain">
                <SelectValue placeholder={t('dictionary.term.form.domainNone')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>{t('dictionary.term.form.domainNone')}</SelectItem>
                {domains.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.logicalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="term-description">{t('dictionary.term.form.description')}</Label>
            <Input
              id="term-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('dictionary.term.form.descriptionPlaceholder')}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.button.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={submitting || !logicalName.trim() || !physicalName.trim()}
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
