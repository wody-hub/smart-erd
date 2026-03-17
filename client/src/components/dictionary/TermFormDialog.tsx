import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lightbulb, Loader2, Plus } from 'lucide-react';
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
import { fetchDomains } from '@/api/domainApi';
import { fetchWords } from '@/api/wordApi';
import { queryKeys } from '@/constants/query-keys';
import { useCreateWordMutation } from '@/hooks/useCreateWordMutation';
import { useDictionarySuggest } from '@/hooks/useDictionarySuggest';
import { buildSuggestHintText } from '@/lib/dictionary-suggest-utils';
import { analyzeWordComposition, buildWordMatchIndex } from '@/lib/word-composition';
import type { Term, TermFormData, WordFormData } from '@/types/dictionary';
import WordCompositionValidator from '@/components/dictionary/WordCompositionValidator';
import WordFormDialog from '@/components/dictionary/WordFormDialog';
import DomainSearchSelect from '@/components/dictionary/DomainSearchSelect';

const NONE_VALUE = '__none__';

interface TermFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TermFormData) => Promise<void>;
  initialData?: Term | null;
  setId: string;
}

export default function TermFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  setId,
}: TermFormDialogProps) {
  const { teamId } = useParams<{ teamId: string }>();
  const { t } = useTranslation();

  const [logicalName, setLogicalName] = useState('');
  const [physicalName, setPhysicalName] = useState('');
  const [domainId, setDomainId] = useState<string>(NONE_VALUE);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [domainDirty, setDomainDirty] = useState(false);
  const [quickWordOpen, setQuickWordOpen] = useState(false);
  const [draftWord, setDraftWord] = useState<Partial<WordFormData> | null>(null);

  const isEdit = !!initialData;

  const { data: domains = [] } = useQuery({
    queryKey: queryKeys.dictionary.domains(teamId!, setId),
    queryFn: () => fetchDomains(teamId!, setId),
    enabled: open && !!teamId && !!setId,
  });

  const { data: words = [] } = useQuery({
    queryKey: queryKeys.dictionary.words(teamId!, setId),
    queryFn: () => fetchWords(teamId!, setId),
    enabled: open && !isEdit && !!teamId && !!setId,
  });

  const wordMatchIndex = useMemo(() => buildWordMatchIndex(words), [words]);
  const composition = useMemo(
    () => analyzeWordComposition(logicalName, wordMatchIndex),
    [logicalName, wordMatchIndex],
  );

  const { suggestion, isLoading: suggestLoading } = useDictionarySuggest(
    teamId!,
    setId,
    logicalName,
    open && !isEdit && composition.isCompleteMatch && !!teamId && !!setId,
  );

  useEffect(() => {
    if (open) {
      setLogicalName(initialData?.logicalName ?? '');
      setPhysicalName(initialData?.physicalName ?? '');
      setDomainId(initialData?.domainId != null ? String(initialData.domainId) : NONE_VALUE);
      setDescription(initialData?.description ?? '');
      setDomainDirty(!!initialData);
      setQuickWordOpen(false);
      setDraftWord(null);
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!open || isEdit) {
      return;
    }
    setPhysicalName(composition.isCompleteMatch ? composition.derivedPhysicalName : '');
  }, [open, isEdit, composition]);

  useEffect(() => {
    if (!suggestion || isEdit) {
      return;
    }

    if (!domainDirty && suggestion.domainId != null) {
      setDomainId(String(suggestion.domainId));
    }
  }, [suggestion, isEdit, domainDirty]);

  const createWordMutation = useCreateWordMutation({
    teamId: teamId!,
    setId,
    onSuccess: () => {
      setQuickWordOpen(false);
      setDraftWord(null);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit && !composition.isCompleteMatch) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        logicalName: logicalName.trim(),
        physicalName,
        domainId: domainId !== NONE_VALUE ? Number(domainId) : null,
        description: description || undefined,
        wordIds: isEdit ? undefined : composition.matchedWordIds,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const hintText = buildSuggestHintText(suggestion, t);

  return (
    <>
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
              <Label htmlFor="term-logicalName">{t('dictionary.term.form.logicalName')}</Label>
              <Input
                id="term-logicalName"
                value={logicalName}
                onChange={(e) => setLogicalName(e.target.value)}
                placeholder={t('dictionary.term.form.logicalNamePlaceholder')}
                required
                maxLength={100}
              />
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

            {!isEdit ? (
              <div className="space-y-2">
                <WordCompositionValidator
                  analysis={composition}
                  onCreateMissingWord={(missingLogicalName) => {
                    setDraftWord({ logicalName: missingLogicalName });
                    setQuickWordOpen(true);
                  }}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={composition.isAmbiguous}
                    onClick={() => {
                      setDraftWord(null);
                      setQuickWordOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {t('dictionary.word.form.createTitle')}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="term-physicalName">{t('dictionary.term.form.physicalName')}</Label>
              <Input
                id="term-physicalName"
                value={physicalName}
                onChange={(e) => {
                  if (isEdit) {
                    setPhysicalName(e.target.value);
                  }
                }}
                placeholder={t('dictionary.term.form.physicalNamePlaceholder')}
                required
                maxLength={100}
                readOnly={!isEdit}
              />
              {!isEdit ? (
                <p className="text-xs text-muted-foreground">
                  {t('dictionary.term.form.physicalNameDerivedHint')}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="term-domain">{t('dictionary.term.form.domain')}</Label>
              <DomainSearchSelect
                id="term-domain"
                domains={domains}
                selectedDomainId={domainId !== NONE_VALUE ? Number(domainId) : null}
                onSelect={(selectedDomainId) => {
                  setDomainId(selectedDomainId != null ? String(selectedDomainId) : NONE_VALUE);
                  setDomainDirty(true);
                }}
                noneLabel={t('dictionary.term.form.domainNone')}
                searchPlaceholder={t('erd.domain.searchPlaceholder')}
                noResultsText={t('erd.domain.noResults')}
              />
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
                disabled={
                  submitting ||
                  !logicalName.trim() ||
                  !physicalName.trim() ||
                  (!isEdit && !composition.isCompleteMatch)
                }
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

      <WordFormDialog
        open={quickWordOpen}
        onOpenChange={(nextOpen) => {
          setQuickWordOpen(nextOpen);
          if (!nextOpen) {
            setDraftWord(null);
          }
        }}
        onSubmit={(data) => createWordMutation.mutateAsync(data).then(() => undefined)}
        draftData={draftWord}
      />
    </>
  );
}
