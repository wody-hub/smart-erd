import { useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { AlertTriangle, ListTree, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { Textarea } from '@/components/ui/textarea';
import type { WbsItem } from '@/types/wbs';
import {
  parseBulkCreateOutline,
  type BulkCreateValidationError,
  type ParsedBulkCreateLine,
} from './wbs-authoring-utils';

interface WbsBulkCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  selectedParent: WbsItem | null;
  onSubmit: (items: ParsedBulkCreateLine[], parentId: number | null) => Promise<void>;
}

function ErrorLine({
  error,
  t,
}: {
  error: BulkCreateValidationError;
  t: TFunction;
}) {
  const message = String(t(`wbs.bulk.validation.${error.messageKey}`, { line: error.lineNumber }));
  return (
    <li className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </li>
  );
}

export default function WbsBulkCreateDialog({
  open,
  onOpenChange,
  loading,
  selectedParent,
  onSubmit,
}: WbsBulkCreateDialogProps) {
  const { t } = useTranslation();
  const [outlineText, setOutlineText] = useState('');
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    if (!open) {
      setOutlineText('');
      setTemplateName('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTemplateName(selectedParent?.name ?? '');
  }, [open, selectedParent?.name]);

  const parsed = useMemo(() => parseBulkCreateOutline(outlineText), [outlineText]);

  const previewTitle = selectedParent
    ? t('wbs.bulk.parent.selected', { name: selectedParent.name })
    : t('wbs.bulk.parent.root');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('wbs.bulk.title')}</DialogTitle>
          <DialogDescription>{t('wbs.bulk.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <section className="space-y-3">
            <div className="rounded-xl border border-border/80 bg-secondary/10 p-4">
              <p className="text-sm font-medium text-foreground">{t('wbs.bulk.instructionsTitle')}</p>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
                <li>{t('wbs.bulk.instructions.line1')}</li>
                <li>{t('wbs.bulk.instructions.line2')}</li>
                <li>{t('wbs.bulk.instructions.line3')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="wbs-bulk-outline">
                {t('wbs.bulk.outline')}
              </label>
              <Textarea
                id="wbs-bulk-outline"
                value={outlineText}
                onChange={(event) => setOutlineText(event.target.value)}
                className="min-h-[360px] bg-background font-mono text-sm"
                placeholder={t('wbs.bulk.placeholder')}
                spellCheck={false}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="rounded-xl border border-border/80 bg-card/70 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{t('wbs.bulk.targetTitle')}</p>
                  <p className="text-sm text-muted-foreground">{previewTitle}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="wbs-bulk-template-name">
                {t('wbs.bulk.previewTitle')}
              </label>
              <Input
                id="wbs-bulk-template-name"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder={t('wbs.bulk.previewPlaceholder')}
              />
            </div>

            {parsed.errors.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      {t('wbs.bulk.validation.title')}
                    </p>
                    <p className="text-sm text-destructive/80">
                      {t('wbs.bulk.validation.description')}
                    </p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {parsed.errors.map((error) => (
                    <ErrorLine key={`${error.lineNumber}-${error.messageKey}`} error={error} t={t} />
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-xl border border-border/80 bg-card/70 p-4">
              <div className="flex items-start gap-3">
                <ListTree className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {t('wbs.bulk.previewSummary', { count: parsed.items.length })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('wbs.bulk.previewDescription')}
                  </p>
                </div>
              </div>

              <div className="mt-4 h-[260px] overflow-y-auto rounded-lg border border-border/70 bg-background/80">
                <div className="space-y-1 p-3">
                  {parsed.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('wbs.bulk.previewEmpty')}</p>
                  ) : (
                    parsed.items.map((entry) => (
                      <div
                        key={`${entry.lineNumber}-${entry.name}`}
                        className="rounded-md px-2 py-1.5 text-sm text-foreground"
                        style={{ paddingLeft: `${entry.depth * 20 + 8}px` }}
                      >
                        <span className="mr-2 text-xs text-muted-foreground">
                          L{entry.lineNumber}
                        </span>
                        {entry.name}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common.button.cancel')}
          </Button>
          <Button
            onClick={() => onSubmit(parsed.items, selectedParent?.id ?? null)}
            disabled={loading || parsed.items.length === 0 || parsed.errors.length > 0}
          >
            {loading ? t('wbs.bulk.creating') : t('wbs.bulk.submit', { count: parsed.items.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
