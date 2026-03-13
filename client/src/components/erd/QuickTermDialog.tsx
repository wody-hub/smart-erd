import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Lightbulb, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTerm } from '@/api/termApi';
import { createWord } from '@/api/wordApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import { buildColumnUpdatesFromTerm } from '@/components/erd/erdDictionaryData';
import { useDictionarySuggest } from '@/hooks/useDictionarySuggest';
import { useErdDictionary } from './ErdDictionaryContext';
import type { Column } from '@/types/erd';
import type { Domain, Word } from '@/types/dictionary';
import QuickDomainDialog from './QuickDomainDialog';
import WordComposer from '@/components/dictionary/WordComposer';
import WordFormDialog from '@/components/dictionary/WordFormDialog';

/** "없음" 선택 시 사용하는 센티넬 값 */
const NONE_VALUE = '__none__';

/** QuickTermDialog 컴포넌트 props */
interface QuickTermDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 자동완성에서 입력 중이던 논리명 초기값 */
  initialLogicalName: string;
  /** 등록 완료 후 컬럼 업데이트 콜백 */
  onApply: (updates: Partial<Column>) => void;
}

/**
 * 빠른 용어 등록 다이얼로그.
 *
 * ERD 에디터에서 자동완성 중 매칭 결과가 없거나 원하는 Term이 없을 때
 * 새 용어를 즉시 등록하고 컬럼에 적용한다.
 * Suggest API를 통해 물리명/도메인을 자동 추천한다.
 *
 * @param props.open               다이얼로그 열림 상태
 * @param props.onOpenChange        열림 상태 변경 핸들러
 * @param props.initialLogicalName  초기 논리명 값
 * @param props.onApply             등록 후 컬럼 업데이트 콜백
 */
export default function QuickTermDialog({
  open,
  onOpenChange,
  initialLogicalName,
  onApply,
}: QuickTermDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { teamId, setId, domains, words, findDomainById } = useErdDictionary();

  /** 연결 도메인 ID (문자열 — Select 호환) */
  const [domainId, setDomainId] = useState<string>(NONE_VALUE);
  /** 설명 입력값 */
  const [description, setDescription] = useState('');
  /** 조합에 사용한 단어 ID 목록 */
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  /** 추가할 단어 ID */
  const [wordToAdd, setWordToAdd] = useState('');
  /** 도메인 사용자 수동 입력 플래그 */
  const [domainDirty, setDomainDirty] = useState(false);
  /** 빠른 도메인 등록 다이얼로그 열림 상태 */
  const [quickDomainOpen, setQuickDomainOpen] = useState(false);
  /** 빠른 단어 등록 다이얼로그 열림 상태 */
  const [quickWordOpen, setQuickWordOpen] = useState(false);

  const selectedWords = useMemo(
    () =>
      selectedWordIds
        .map((wordId) => words.find((word) => String(word.id) === wordId))
        .filter((word): word is Word => !!word),
    [selectedWordIds, words],
  );
  const logicalName = useMemo(
    () => selectedWords.map((word) => word.logicalName).join(' '),
    [selectedWords],
  );
  const physicalName = useMemo(
    () => selectedWords.map((word) => word.physicalName).join('_'),
    [selectedWords],
  );

  const { suggestion, isLoading: suggestLoading } = useDictionarySuggest(
    teamId,
    setId,
    logicalName,
    open,
  );

  useEffect(() => {
    if (open) {
      setDomainId(NONE_VALUE);
      setDescription('');
      setSelectedWordIds([]);
      setWordToAdd('');
      setDomainDirty(false);
      setQuickWordOpen(false);
    }
  }, [open, initialLogicalName]);

  // 추천 결과로 도메인 자동 채움 (다이얼로그가 열려 있을 때만)
  useEffect(() => {
    if (!open || !suggestion) {
      return;
    }

    if (!domainDirty && suggestion.domainId != null) {
      setDomainId(String(suggestion.domainId));
    }
  }, [open, suggestion, domainDirty]);

  const createTermMutation = useMutation({
    mutationFn: () =>
      createTerm(teamId, setId, {
        logicalName,
        physicalName,
        domainId: domainId !== NONE_VALUE ? Number(domainId) : null,
        description: description || undefined,
      }),
    onSuccess: (term) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.terms(teamId, setId) });
      onApply(buildColumnUpdatesFromTerm(term, findDomainById));
      toast.success(t('erd.quickTerm.success'));
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('erd.quickTerm.failed'))),
  });

  const createWordMutation = useMutation({
    mutationFn: (data: { logicalName: string; physicalName: string; description?: string }) =>
      createWord(teamId, setId, data),
    onSuccess: async (word) => {
      queryClient.setQueryData<Word[]>(queryKeys.dictionary.words(teamId, setId), (current = []) => {
        if (current.some((item) => item.id === word.id)) {
          return current;
        }
        return [...current, word];
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.words(teamId, setId) });
      setSelectedWordIds((prev) => [...prev, String(word.id)]);
      setWordToAdd('');
      toast.success(t('erd.quickTerm.wordCreated'));
      setQuickWordOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('erd.quickTerm.wordCreateFailed'))),
  });

  /**
   * 폼 제출 핸들러.
   *
   * @param e 폼 이벤트
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedWords.length === 0) {
      return;
    }
    createTermMutation.mutate();
  };

  /**
   * 빠른 도메인 생성 완료 핸들러.
   *
   * @param domain 생성된 도메인
   */
  const handleDomainCreated = (domain: Domain) => {
    setDomainId(String(domain.id));
    setDomainDirty(true);
  };

  /**
   * 추천 힌트 텍스트를 생성한다.
   *
   * @returns 매칭 근거 텍스트 또는 null
   */
  const getSuggestHintText = (): string | null => {
    if (!suggestion?.matches || suggestion.matches.length === 0) {
      return null;
    }
    const matchedDetails = suggestion.matches
      .filter((m) => m.matched)
      .map((m) =>
        t('dictionary.suggest.matchDetail', {
          keyword: m.keyword,
          physical: m.physicalName ?? '',
        }),
      );
    if (matchedDetails.length === 0) {
      return null;
    }
    return matchedDetails.join(', ');
  };

  const hintText = getSuggestHintText();
  const handleAddWord = (wordId: string) => {
    if (!wordId || selectedWordIds.includes(wordId)) {
      return;
    }

    setSelectedWordIds((prev) => [...prev, wordId]);
    setWordToAdd('');
  };

  const handleRemoveWord = (wordId: string) => {
    setSelectedWordIds((prev) => prev.filter((selectedId) => selectedId !== wordId));
  };

  const handleClearWords = () => {
    setSelectedWordIds([]);
    setWordToAdd('');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('erd.quickTerm.title')}</DialogTitle>
            <DialogDescription>
              {t('erd.quickTerm.description')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <WordComposer
              words={words}
              selectedWordIds={selectedWordIds}
              wordToAdd={wordToAdd}
              onWordToAddChange={setWordToAdd}
              onAddWord={handleAddWord}
              onRemoveWord={handleRemoveWord}
              onClear={handleClearWords}
              title={t('dictionary.term.form.wordBuilder')}
              description={t('dictionary.term.form.wordBuilderDescription')}
              placeholder={t('dictionary.term.form.wordBuilderPlaceholder')}
              addLabel={t('dictionary.term.form.addWord')}
              clearLabel={t('dictionary.term.form.clearWords')}
              sequenceLabel={t('dictionary.term.form.wordSequence')}
              logicalPreviewLabel={t('dictionary.term.form.logicalPreview')}
              physicalPreviewLabel={t('dictionary.term.form.physicalPreview')}
              removeWordLabel={(logicalName) =>
                t('dictionary.term.form.removeWord', { name: logicalName })
              }
            />
            <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border/70 bg-muted/30 px-3 py-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t('erd.quickTerm.wordRequiredTitle')}</p>
                <p className="text-xs text-muted-foreground">
                  {initialLogicalName.trim()
                    ? t('erd.quickTerm.wordRequiredDescriptionWithInitial', {
                        name: initialLogicalName.trim(),
                      })
                    : t('erd.quickTerm.wordRequiredDescription')}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickWordOpen(true)}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t('erd.quickTerm.createWord')}
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-term-logicalName">
                {t('dictionary.term.form.logicalName')}
              </Label>
              <Input
                id="quick-term-logicalName"
                value={logicalName}
                readOnly
                placeholder={t('dictionary.term.form.logicalNamePlaceholder')}
                required
                maxLength={100}
              />
              {/* 추천 힌트 */}
              {logicalName.trim().length >= 2 && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  {suggestLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : hintText ? (
                    <>
                      <Lightbulb className="h-3 w-3" />
                      <span>{t('dictionary.suggest.hint', { details: hintText })}</span>
                    </>
                  ) : suggestion ? (
                    <span>{t('dictionary.suggest.noMatch')}</span>
                  ) : null}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-term-physicalName">
                {t('dictionary.term.form.physicalName')}
              </Label>
              <Input
                id="quick-term-physicalName"
                value={physicalName}
                readOnly
                placeholder={t('dictionary.term.form.physicalNamePlaceholder')}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-term-domain">{t('dictionary.term.form.domain')}</Label>
              <div className="flex gap-2">
                <Select
                  value={domainId}
                  onValueChange={(val) => {
                    setDomainId(val);
                    setDomainDirty(true);
                  }}
                >
                  <SelectTrigger id="quick-term-domain" className="flex-1">
                    <SelectValue placeholder={t('dictionary.term.form.domainNone')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>
                      {t('dictionary.term.form.domainNone')}
                    </SelectItem>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.logicalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuickDomainOpen(true)}
                  aria-label={t('erd.quickTerm.createDomain')}
                  title={t('erd.quickTerm.createDomain')}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-term-description">
                {t('dictionary.term.form.description')}
              </Label>
              <Input
                id="quick-term-description"
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
                disabled={createTermMutation.isPending || selectedWords.length === 0}
              >
                {createTermMutation.isPending
                  ? t('erd.quickTerm.submitting')
                  : t('erd.quickTerm.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <QuickDomainDialog
        open={quickDomainOpen}
        onOpenChange={setQuickDomainOpen}
        onCreated={handleDomainCreated}
      />

      <WordFormDialog
        open={quickWordOpen}
        onOpenChange={setQuickWordOpen}
        onSubmit={(data) => createWordMutation.mutateAsync(data).then(() => undefined)}
      />
    </>
  );
}
