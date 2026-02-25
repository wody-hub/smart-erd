import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Plus, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { DslError } from '@/lib/dsl-parser';

type SeverityFilter = 'all' | 'error' | 'warning';

interface DslDiagnosticGuideDialogProps {
  diagnostics: DslError[];
  parsing: boolean;
  hasInput: boolean;
  onMoveToDiagnostic: (diagnostic: DslError) => void;
  onQuickRegisterTerm?: (logicalName: string) => void;
  onQuickRegisterDomain?: (logicalName: string) => void;
}

interface DiagnosticGuideSpec {
  guideKey: string;
  actionCount: number;
  hasExamples: boolean;
}

interface DiagnosticEntry {
  id: string;
  diagnostic: DslError;
  guide: DiagnosticGuideSpec;
}

const GUIDE_BY_MESSAGE_KEY: Record<string, DiagnosticGuideSpec> = {
  'erd.dsl.error.syntaxError': {
    guideKey: 'syntaxError',
    actionCount: 3,
    hasExamples: true,
  },
  'erd.dsl.error.unknownTerm': {
    guideKey: 'unknownTerm',
    actionCount: 3,
    hasExamples: true,
  },
  'erd.dsl.error.unknownDomain': {
    guideKey: 'unknownDomain',
    actionCount: 3,
    hasExamples: true,
  },
  'erd.dsl.error.unknownFkTable': {
    guideKey: 'unknownFkTable',
    actionCount: 3,
    hasExamples: true,
  },
  'erd.dsl.error.unknownFkColumn': {
    guideKey: 'unknownFkColumn',
    actionCount: 3,
    hasExamples: true,
  },
  'erd.dsl.error.domainAndTypeConflict': {
    guideKey: 'domainAndTypeConflict',
    actionCount: 2,
    hasExamples: true,
  },
  'erd.dsl.error.invalidTypeFormat': {
    guideKey: 'invalidTypeFormat',
    actionCount: 2,
    hasExamples: true,
  },
  'erd.dsl.warning.noDomain': {
    guideKey: 'noDomainWarning',
    actionCount: 2,
    hasExamples: false,
  },
  'erd.dsl.error.duplicateColumnLogicalName': {
    guideKey: 'duplicateColumnLogicalNameError',
    actionCount: 2,
    hasExamples: true,
  },
  'erd.dsl.error.duplicateColumnPhysicalName': {
    guideKey: 'duplicateColumnPhysicalNameError',
    actionCount: 2,
    hasExamples: true,
  },
};

const DEFAULT_ERROR_GUIDE: DiagnosticGuideSpec = {
  guideKey: 'genericError',
  actionCount: 2,
  hasExamples: false,
};

const DEFAULT_WARNING_GUIDE: DiagnosticGuideSpec = {
  guideKey: 'genericWarning',
  actionCount: 2,
  hasExamples: false,
};

function resolveGuideSpec(diagnostic: DslError): DiagnosticGuideSpec {
  const mapped = GUIDE_BY_MESSAGE_KEY[diagnostic.messageKey];
  if (mapped) {
    return mapped;
  }

  if (diagnostic.severity === 'warning') {
    return DEFAULT_WARNING_GUIDE;
  }
  return DEFAULT_ERROR_GUIDE;
}

export default function DslDiagnosticGuideDialog({
  diagnostics,
  parsing,
  hasInput,
  onMoveToDiagnostic,
  onQuickRegisterTerm,
  onQuickRegisterDomain,
}: DslDiagnosticGuideDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const entries = useMemo<DiagnosticEntry[]>(
    () =>
      diagnostics.map((diagnostic, index) => ({
        id: String(index),
        diagnostic,
        guide: resolveGuideSpec(diagnostic),
      })),
    [diagnostics],
  );

  const filteredEntries = useMemo(() => {
    if (filter === 'all') {
      return entries;
    }
    return entries.filter((entry) => entry.diagnostic.severity === filter);
  }, [entries, filter]);

  const selectedEntry = useMemo(() => {
    if (filteredEntries.length === 0) {
      return null;
    }
    const matched = filteredEntries.find((entry) => entry.id === selectedEntryId);
    return matched ?? filteredEntries[0];
  }, [filteredEntries, selectedEntryId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (filteredEntries.length === 0) {
      setSelectedEntryId(null);
      return;
    }

    if (!selectedEntryId || !filteredEntries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(filteredEntries[0].id);
    }
  }, [open, filteredEntries, selectedEntryId]);

  const errorCount = entries.filter((entry) => entry.diagnostic.severity === 'error').length;
  const warningCount = entries.filter((entry) => entry.diagnostic.severity === 'warning').length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          aria-label={t('erd.dsl.errorGuide.ariaOpen')}
        >
          <CircleAlert className="h-3.5 w-3.5" />
          {t('erd.dsl.errorGuide.openButton')}
          <Badge
            variant={errorCount > 0 ? 'destructive' : 'secondary'}
            className="h-4 min-w-4 justify-center px-1 text-[10px]"
          >
            {diagnostics.length}
          </Badge>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl p-0">
        <div className="border-b border-border px-6 py-4 pr-10">
          <DialogTitle className="text-base">{t('erd.dsl.errorGuide.title')}</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {t('erd.dsl.errorGuide.description')}
          </DialogDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{t('erd.dsl.errorGuide.summaryTotal', { count: diagnostics.length })}</span>
            <span>{t('erd.dsl.errorGuide.summaryError', { count: errorCount })}</span>
            <span>{t('erd.dsl.errorGuide.summaryWarning', { count: warningCount })}</span>
          </div>
        </div>

        <div className="grid max-h-[72vh] grid-cols-1 divide-y divide-border overflow-hidden md:grid-cols-[340px_1fr] md:divide-x md:divide-y-0">
          <div className="flex min-h-0 flex-col">
            <div className="border-b border-border px-4 py-3">
              <div className="flex gap-1">
                {(['all', 'error', 'warning'] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={filter === value ? 'default' : 'ghost'}
                    className="h-7 px-2 text-xs"
                    onClick={() => setFilter(value)}
                  >
                    {t(`erd.dsl.errorGuide.filter.${value}`)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {parsing && (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {t('erd.dsl.errorGuide.parsing')}
                </div>
              )}

              {!parsing && filteredEntries.length === 0 && (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {hasInput
                    ? t('erd.dsl.errorGuide.emptyNoIssues')
                    : t('erd.dsl.errorGuide.emptyNoInput')}
                </div>
              )}

              {!parsing && filteredEntries.length > 0 && (
                <div className="space-y-1">
                  {filteredEntries.map((entry) => {
                    const active = selectedEntry?.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedEntryId(entry.id)}
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          active
                            ? 'border-primary bg-accent/70'
                            : 'border-border bg-background hover:bg-accent/40',
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <Badge
                            variant={
                              entry.diagnostic.severity === 'error' ? 'destructive' : 'secondary'
                            }
                            className="h-5 px-2 text-[10px]"
                          >
                            {t(`erd.dsl.errorGuide.severity.${entry.diagnostic.severity}`)}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {t('erd.dsl.errorGuide.lineLabel', { line: entry.diagnostic.line })}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs text-foreground">
                          {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            t(entry.diagnostic.messageKey as any, entry.diagnostic.messageArgs)
                          }
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto px-6 py-5">
            {selectedEntry ? (
              <DiagnosticDetail
                entry={selectedEntry}
                onMoveToDiagnostic={onMoveToDiagnostic}
                onQuickRegisterTerm={onQuickRegisterTerm}
                onQuickRegisterDomain={onQuickRegisterDomain}
              />
            ) : (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {parsing
                  ? t('erd.dsl.errorGuide.parsing')
                  : hasInput
                    ? t('erd.dsl.errorGuide.selectHint')
                    : t('erd.dsl.errorGuide.emptyNoInput')}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DiagnosticDetailProps {
  entry: DiagnosticEntry;
  onMoveToDiagnostic: (diagnostic: DslError) => void;
  onQuickRegisterTerm?: (logicalName: string) => void;
  onQuickRegisterDomain?: (logicalName: string) => void;
}

function DiagnosticDetail({
  entry,
  onMoveToDiagnostic,
  onQuickRegisterTerm,
  onQuickRegisterDomain,
}: DiagnosticDetailProps) {
  const { t } = useTranslation();
  const tAny = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  const { diagnostic, guide } = entry;
  const keyPrefix = `erd.dsl.errorGuide.guides.${guide.guideKey}`;
  const actions = Array.from({ length: guide.actionCount }, (_, index) =>
    tAny(`${keyPrefix}.action${index + 1}`),
  );
  const nameArg = diagnostic.messageArgs?.name?.trim();
  const registerName = nameArg ?? '';
  const canRegisterTerm = diagnostic.messageKey === 'erd.dsl.error.unknownTerm' && !!nameArg;
  const canRegisterDomain = diagnostic.messageKey === 'erd.dsl.error.unknownDomain' && !!nameArg;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant={diagnostic.severity === 'error' ? 'destructive' : 'secondary'}>
            {t(`erd.dsl.errorGuide.severity.${diagnostic.severity}`)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t('erd.dsl.errorGuide.lineLabel', { line: diagnostic.line })}
          </span>
        </div>
        <h3 className="text-sm font-semibold">
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            t(diagnostic.messageKey as any, diagnostic.messageArgs)
          }
        </h3>
      </div>

      <section className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('erd.dsl.errorGuide.sectionCause')}
        </h4>
        <p className="text-sm">{tAny(`${keyPrefix}.cause`)}</p>
      </section>

      <section className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('erd.dsl.errorGuide.sectionFix')}
        </h4>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
          {actions.map((action, index) => (
            <li key={`${entry.id}-action-${index}`}>{action}</li>
          ))}
        </ol>
      </section>

      {guide.hasExamples && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('erd.dsl.errorGuide.sectionExample')}
          </h4>
          <div className="space-y-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                {t('erd.dsl.errorGuide.badExample')}
              </p>
              <pre className="overflow-x-auto rounded-md border border-border bg-muted/60 p-2 text-xs">
                <code>{tAny(`${keyPrefix}.badExample`)}</code>
              </pre>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                {t('erd.dsl.errorGuide.goodExample')}
              </p>
              <pre className="overflow-x-auto rounded-md border border-border bg-muted/60 p-2 text-xs">
                <code>{tAny(`${keyPrefix}.goodExample`)}</code>
              </pre>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('erd.dsl.errorGuide.sectionRule')}
        </h4>
        <p className="text-sm text-muted-foreground">{tAny(`${keyPrefix}.rule`)}</p>
      </section>

      <div className="flex flex-wrap gap-2 pt-1">
        {canRegisterTerm && onQuickRegisterTerm && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => onQuickRegisterTerm(registerName)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('erd.dsl.errorGuide.quickAction.registerTerm', { name: registerName })}
          </Button>
        )}
        {canRegisterDomain && onQuickRegisterDomain && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => onQuickRegisterDomain(registerName)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('erd.dsl.errorGuide.quickAction.registerDomain', { name: registerName })}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          onClick={() => onMoveToDiagnostic(diagnostic)}
        >
          <Wrench className="h-3.5 w-3.5" />
          {t('erd.dsl.errorGuide.moveToLine')}
        </Button>
      </div>
    </div>
  );
}
