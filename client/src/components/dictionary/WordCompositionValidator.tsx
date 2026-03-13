import { AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WordCompositionAnalysis } from '@/lib/word-composition';

interface WordCompositionValidatorProps {
  analysis: WordCompositionAnalysis;
  onCreateMissingWord?: (logicalName: string) => void;
}

export default function WordCompositionValidator({
  analysis,
  onCreateMissingWord,
}: WordCompositionValidatorProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t('dictionary.term.form.compositionTitle')}</p>
        <p className="text-xs text-muted-foreground">
          {t('dictionary.term.form.compositionDescription')}
        </p>
      </div>

      <div className="mt-3 space-y-3">
        {analysis.isEmpty ? (
          <div className="text-xs text-muted-foreground">
            {t('dictionary.term.form.compositionEmpty')}
          </div>
        ) : (
          <>
            <div
              className={
                analysis.isCompleteMatch
                  ? 'flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900'
                  : 'flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950'
              }
            >
              {analysis.isCompleteMatch ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {analysis.isAmbiguous
                    ? t('dictionary.term.form.compositionAmbiguous')
                    : analysis.isCompleteMatch
                    ? t('dictionary.term.form.compositionValid')
                    : t('dictionary.term.form.compositionInvalid')}
                </p>
                {analysis.isCompleteMatch ? (
                  <p className="text-xs text-emerald-800">
                    {t('dictionary.term.form.derivedPhysicalName')}:
                    <span className="ml-1 font-semibold">{analysis.derivedPhysicalName}</span>
                  </p>
                ) : analysis.isAmbiguous ? (
                  <p className="text-xs text-amber-900">
                    {t('dictionary.term.form.compositionAmbiguousHint', {
                      names: analysis.ambiguousPhysicalNames.join(', '),
                    })}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t('dictionary.term.form.compositionSegments')}
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.segments.map((segment, index) => (
                  <Badge
                    key={`${segment.text}-${index}`}
                    variant={segment.matched ? 'secondary' : 'destructive'}
                    className="px-2 py-1"
                  >
                    {segment.text}
                  </Badge>
                ))}
              </div>
            </div>

            {!analysis.isCompleteMatch && !analysis.isAmbiguous && analysis.creatableMissingSegments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('dictionary.term.form.compositionMissing')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {analysis.creatableMissingSegments.map((segment) => (
                    <Button
                      key={segment}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCreateMissingWord?.(segment)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      {t('dictionary.term.form.createMissingWord', { name: segment })}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
