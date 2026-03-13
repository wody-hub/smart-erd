import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Lightbulb, Loader2 } from 'lucide-react';
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
import { fetchDomains } from '@/api/domainApi';
import { fetchWords } from '@/api/wordApi';
import { queryKeys } from '@/constants/query-keys';
import { useDictionarySuggest } from '@/hooks/useDictionarySuggest';
import type { Term, TermFormData, Word } from '@/types/dictionary';
import WordComposer from '@/components/dictionary/WordComposer';

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
  /** 선택된 사전 세트 ID */
  setId: string;
}

/**
 * 용어 생성/수정 다이얼로그.
 *
 * initialData가 있으면 수정 모드, 없으면 생성 모드로 동작한다.
 * 도메인 Select에서 팀의 도메인 목록을 로드한다.
 * 생성 모드에서는 한글 키워드 자동 추천을 지원한다.
 */
export default function TermFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  setId,
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
  /** 조합에 사용한 단어 ID 목록 */
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  /** 추가할 단어 ID */
  const [wordToAdd, setWordToAdd] = useState<string>('');
  /** 물리명 사용자 수동 입력 플래그 */
  const [physicalNameDirty, setPhysicalNameDirty] = useState(false);
  /** 도메인 사용자 수동 입력 플래그 */
  const [domainDirty, setDomainDirty] = useState(false);

  const isEdit = !!initialData;

  const { data: domains = [] } = useQuery({
    queryKey: queryKeys.dictionary.domains(teamId!, setId),
    queryFn: () => fetchDomains(teamId!, setId),
    enabled: open && !!teamId && !!setId,
  });

  const { data: words = [] } = useQuery({
    queryKey: queryKeys.dictionary.words(teamId!, setId),
    queryFn: () => fetchWords(teamId!, setId),
    enabled: open && !!teamId && !!setId,
  });

  const { suggestion, isLoading: suggestLoading } = useDictionarySuggest(
    teamId!,
    setId,
    logicalName,
    open && !isEdit && !!teamId && !!setId,
  );

  useEffect(() => {
    if (open) {
      setLogicalName(initialData?.logicalName ?? '');
      setPhysicalName(initialData?.physicalName ?? '');
      setDomainId(initialData?.domainId != null ? String(initialData.domainId) : NONE_VALUE);
      setDescription(initialData?.description ?? '');
      setSelectedWordIds([]);
      setWordToAdd('');
      setPhysicalNameDirty(!!initialData);
      setDomainDirty(!!initialData);
    }
  }, [open, initialData]);

  // 추천 결과로 물리명/도메인 자동 채움
  useEffect(() => {
    if (!suggestion || isEdit) return;

    if (!physicalNameDirty && suggestion.physicalName) {
      setPhysicalName(suggestion.physicalName);
    }

    if (!domainDirty && suggestion.domainId != null) {
      setDomainId(String(suggestion.domainId));
    }
  }, [suggestion, isEdit, physicalNameDirty, domainDirty]);

  const buildWords = (wordIds: string[]): Word[] =>
    wordIds
      .map((wordId) => words.find((word) => String(word.id) === wordId))
      .filter((word): word is Word => !!word);

  const syncNamesFromWords = (nextWords: Word[]) => {
    if (nextWords.length === 0) {
      setLogicalName('');
      setPhysicalName('');
      setPhysicalNameDirty(false);
      return;
    }

    setLogicalName(nextWords.map((word) => word.logicalName).join(' '));
    setPhysicalName(nextWords.map((word) => word.physicalName).join('_'));
    setPhysicalNameDirty(true);
  };

  const handleAddWord = (wordId: string) => {
    if (!wordId || selectedWordIds.includes(wordId)) {
      return;
    }
    const nextSelectedWordIds = [...selectedWordIds, wordId];
    setSelectedWordIds(nextSelectedWordIds);
    setWordToAdd('');
    syncNamesFromWords(buildWords(nextSelectedWordIds));
  };

  const handleRemoveWord = (wordId: string) => {
    const nextSelectedWordIds = selectedWordIds.filter((selectedId) => selectedId !== wordId);
    setSelectedWordIds(nextSelectedWordIds);
    syncNamesFromWords(buildWords(nextSelectedWordIds));
  };

  const handleClearWords = () => {
    setSelectedWordIds([]);
    setWordToAdd('');
    syncNamesFromWords([]);
  };

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
        wordIds: selectedWordIds.map(Number),
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 추천 힌트 텍스트를 생성한다.
   *
   * @returns 매칭 근거 텍스트 또는 null
   */
  const getSuggestHintText = (): string | null => {
    if (!suggestion || !suggestion.matches || suggestion.matches.length === 0) return null;
    const matchedDetails = suggestion.matches
      .filter((m) => m.matched)
      .map((m) =>
        t('dictionary.suggest.matchDetail', {
          keyword: m.keyword,
          physical: m.physicalName ?? '',
        }),
      );
    if (matchedDetails.length === 0) return null;
    return matchedDetails.join(', ');
  };

  const hintText = getSuggestHintText();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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
          {!isEdit && (
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
          )}
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
            {/* 추천 힌트 */}
            {!isEdit && logicalName.trim().length >= 2 && (
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
            <Label htmlFor="term-physicalName">{t('dictionary.term.form.physicalName')}</Label>
            <Input
              id="term-physicalName"
              value={physicalName}
              onChange={(e) => {
                setPhysicalName(e.target.value);
                setPhysicalNameDirty(true);
              }}
              placeholder={t('dictionary.term.form.physicalNamePlaceholder')}
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="term-domain">{t('dictionary.term.form.domain')}</Label>
            <Select
              value={domainId}
              onValueChange={(val) => {
                setDomainId(val);
                setDomainDirty(true);
              }}
            >
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
