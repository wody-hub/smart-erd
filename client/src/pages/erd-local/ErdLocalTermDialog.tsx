import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { analyzeWordComposition, buildWordMatchIndex } from '@/lib/word-composition';
import type { Domain, Term, TermFormData, Word } from '@/types/dictionary';

/** 도메인 미선택 값. */
const NONE_VALUE = '__none__';

/** ErdLocalTermDialog 컴포넌트 props. */
interface ErdLocalTermDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 폼 제출 핸들러 */
  onSubmit: (data: TermFormData) => Promise<void>;
  /** 수정 대상 용어 (없으면 생성 모드) */
  initialData?: Term | null;
  /** 도메인 선택용 로컬 도메인 목록 */
  domains: Domain[];
  /** 물리명 파생용 로컬 단어 목록 */
  words: Word[];
}

/**
 * ERD 로컬 모드용 용어 생성/수정 다이얼로그.
 *
 * 서버 바인딩된 `TermFormDialog` 대신 로컬 저장소용으로 동작하며,
 * 제출 데이터는 호출자가 로컬 스토어 mutation으로 처리한다.
 * 물리명은 단어 조합 파생값으로 미리 채워지고 직접 수정할 수 있다.
 *
 * @param props.open 열림 상태
 * @param props.onOpenChange 열림 상태 변경 핸들러
 * @param props.onSubmit 폼 제출 핸들러
 * @param props.initialData 수정 대상 용어
 * @param props.domains 도메인 선택용 목록
 * @param props.words 물리명 파생용 단어 목록
 * @returns 용어 다이얼로그 JSX
 */
export function ErdLocalTermDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  domains,
  words,
}: ErdLocalTermDialogProps) {
  const { t } = useTranslation();

  /** 논리명 입력값 */
  const [logicalName, setLogicalName] = useState('');
  /** 물리명 입력값 */
  const [physicalName, setPhysicalName] = useState('');
  /** 물리명 직접 수정 여부 (true면 파생값으로 덮어쓰지 않는다) */
  const [physicalTouched, setPhysicalTouched] = useState(false);
  /** 도메인 선택값 */
  const [domainId, setDomainId] = useState<string>(NONE_VALUE);
  /** 설명 입력값 */
  const [description, setDescription] = useState('');
  /** 제출 중 여부 */
  const [submitting, setSubmitting] = useState(false);

  /** 수정 모드 여부 */
  const isEdit = !!initialData;

  /** 단어 매칭 인덱스 */
  const wordMatchIndex = useMemo(() => buildWordMatchIndex(words), [words]);
  /** 논리명 단어 조합 분석 */
  const composition = useMemo(
    () => analyzeWordComposition(logicalName, wordMatchIndex),
    [logicalName, wordMatchIndex],
  );

  /**
   * 다이얼로그가 열릴 때 폼을 초기화한다.
   */
  useEffect(() => {
    if (open) {
      setLogicalName(initialData?.logicalName ?? '');
      setPhysicalName(initialData?.physicalName ?? '');
      setPhysicalTouched(!!initialData);
      setDomainId(initialData?.domainId != null ? String(initialData.domainId) : NONE_VALUE);
      setDescription(initialData?.description ?? '');
    }
  }, [open, initialData]);

  /**
   * 생성 모드에서 완전 매칭 파생값을 물리명에 미리 채운다.
   *
   * 사용자가 직접 수정했으면 덮어쓰지 않는다.
   */
  useEffect(() => {
    if (!open || isEdit || physicalTouched) {
      return;
    }
    if (composition.isCompleteMatch) {
      setPhysicalName(composition.derivedPhysicalName);
    }
  }, [open, isEdit, physicalTouched, composition]);

  /**
   * 폼 제출 핸들러.
   *
   * @param event 폼 이벤트
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        logicalName: logicalName.trim(),
        physicalName: physicalName.trim(),
        domainId: domainId !== NONE_VALUE ? Number(domainId) : null,
        description: description.trim() || undefined,
        wordIds: composition.matchedWordIds,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  /** 제출 가능 여부 */
  const canSubmit = !submitting && !!logicalName.trim() && !!physicalName.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('dictionary.term.form.editTitle') : t('dictionary.term.form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('dictionary.term.form.editDescription')
              : t('dictionary.term.form.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="erd-local-term-logicalName">
              {t('dictionary.term.form.logicalName')}
            </Label>
            <Input
              id="erd-local-term-logicalName"
              value={logicalName}
              onChange={(event) => setLogicalName(event.target.value)}
              placeholder={t('dictionary.term.form.logicalNamePlaceholder')}
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="erd-local-term-physicalName">
              {t('dictionary.term.form.physicalName')}
            </Label>
            <Input
              id="erd-local-term-physicalName"
              value={physicalName}
              onChange={(event) => {
                setPhysicalName(event.target.value);
                setPhysicalTouched(true);
              }}
              placeholder={t('dictionary.term.form.physicalNamePlaceholder')}
              required
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              {t('dictionary.term.form.physicalNameDerivedHint')}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="erd-local-term-domain">{t('dictionary.term.form.domain')}</Label>
            <select
              id="erd-local-term-domain"
              value={domainId}
              onChange={(event) => setDomainId(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value={NONE_VALUE}>{t('dictionary.term.form.domainNone')}</option>
              {domains.map((domain) => (
                <option key={domain.id} value={String(domain.id)}>
                  {domain.logicalName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="erd-local-term-description">
              {t('dictionary.term.form.description')}
            </Label>
            <Input
              id="erd-local-term-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('dictionary.term.form.descriptionPlaceholder')}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.button.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
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
