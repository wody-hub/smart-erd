import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { createTerm } from '@/api/termApi';
import { queryKeys } from '@/constants/query-keys';
import { useCreateWordMutation } from '@/hooks/useCreateWordMutation';
import { getErrorMessage } from '@/lib/api-error';
import { buildSuggestHintText } from '@/lib/dictionary-suggest-utils';
import { buildColumnUpdatesFromTerm } from '@/components/erd/erdDictionaryData';
import { useDictionarySuggest } from '@/hooks/useDictionarySuggest';
import { analyzeWordComposition, buildWordMatchIndex } from '@/lib/word-composition';
import { useErdDictionary } from './ErdDictionaryContext';
import type { Column } from '@/types/erd';
import type { Domain, WordFormData } from '@/types/dictionary';
import QuickDomainDialog from './QuickDomainDialog';
import WordFormDialog from '@/components/dictionary/WordFormDialog';
import WordCompositionValidator from '@/components/dictionary/WordCompositionValidator';
import DomainSearchSelect from '@/components/dictionary/DomainSearchSelect';

const NONE_VALUE = '__none__';

interface QuickTermDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLogicalName: string;
  onApply: (updates: Partial<Column>) => void;
}

export default function QuickTermDialog({
  open,
  onOpenChange,
  initialLogicalName,
  onApply,
}: QuickTermDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { teamId, setId, domains, words, findDomainById } = useErdDictionary();

  const [logicalName, setLogicalName] = useState('');
  const [domainId, setDomainId] = useState<string>(NONE_VALUE);
  const [description, setDescription] = useState('');
  const [domainDirty, setDomainDirty] = useState(false);
  const [quickDomainOpen, setQuickDomainOpen] = useState(false);
  const [quickWordOpen, setQuickWordOpen] = useState(false);
  const [draftWord, setDraftWord] = useState<Partial<WordFormData> | null>(null);

  const wordMatchIndex = useMemo(() => buildWordMatchIndex(words), [words]);
  const composition = useMemo(
    () => analyzeWordComposition(logicalName, wordMatchIndex),
    [logicalName, wordMatchIndex],
  );
  const physicalName = composition.isCompleteMatch ? composition.derivedPhysicalName : '';

  const { suggestion, isLoading: suggestLoading } = useDictionarySuggest(
    teamId,
    setId,
    logicalName,
    open && composition.isCompleteMatch,
  );

  useEffect(() => {
    if (open) {
      setLogicalName(initialLogicalName);
      setDomainId(NONE_VALUE);
      setDescription('');
      setDomainDirty(false);
      setQuickWordOpen(false);
      setDraftWord(null);
    }
  }, [open, initialLogicalName]);

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
        logicalName: logicalName.trim(),
        physicalName,
        domainId: domainId !== NONE_VALUE ? Number(domainId) : null,
        description: description || undefined,
        wordIds: composition.matchedWordIds,
      }),
    onSuccess: (term) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.terms(teamId, setId) });
      onApply(buildColumnUpdatesFromTerm(term, findDomainById));
      toast.success(t('erd.quickTerm.success'));
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('erd.quickTerm.failed'))),
  });

  const createWordMutation = useCreateWordMutation({
    teamId,
    setId,
    onSuccess: () => {
      setQuickWordOpen(false);
      setDraftWord(null);
    },
    successMessageKey: 'erd.quickTerm.wordCreated',
    errorMessageKey: 'erd.quickTerm.wordCreateFailed',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composition.isCompleteMatch) {
      return;
    }
    createTermMutation.mutate();
  };

  const handleDomainCreated = (domain: Domain) => {
    setDomainId(String(domain.id));
    setDomainDirty(true);
  };

  const hintText = buildSuggestHintText(suggestion, t);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t('erd.quickTerm.title')}</DialogTitle>
            <DialogDescription>{t('erd.quickTerm.description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-term-logicalName">
                {t('dictionary.term.form.logicalName')}
              </Label>
              <Input
                id="quick-term-logicalName"
                value={logicalName}
                onChange={(e) => setLogicalName(e.target.value)}
                placeholder={t('dictionary.term.form.logicalNamePlaceholder')}
                required
                maxLength={100}
              />
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
                  {t('erd.quickTerm.createWord')}
                </Button>
              </div>
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
              <p className="text-xs text-muted-foreground">
                {t('dictionary.term.form.physicalNameDerivedHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-term-domain">{t('dictionary.term.form.domain')}</Label>
              <div className="flex gap-2">
                <DomainSearchSelect
                  id="quick-term-domain"
                  domains={domains}
                  selectedDomainId={domainId !== NONE_VALUE ? Number(domainId) : null}
                  onSelect={(selectedDomainId) => {
                    setDomainId(selectedDomainId != null ? String(selectedDomainId) : NONE_VALUE);
                    setDomainDirty(true);
                  }}
                  noneLabel={t('dictionary.term.form.domainNone')}
                  searchPlaceholder={t('erd.domain.searchPlaceholder')}
                  noResultsText={t('erd.domain.noResults')}
                  className="flex-1"
                />
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
                disabled={
                  createTermMutation.isPending ||
                  !logicalName.trim() ||
                  !composition.isCompleteMatch
                }
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
