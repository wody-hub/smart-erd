import { AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WordCompositionAnalysis } from '@/lib/word-composition';

/** WordCompositionValidator 컴포넌트 props */
interface WordCompositionValidatorProps {
  /** 단어 조합 분석 결과 */
  analysis: WordCompositionAnalysis;
  /** 미등록 단어 생성 요청 핸들러 */
  onCreateMissingWord?: (logicalName: string) => void;
}

/**
 * 단어 조합 유효성 검증 결과 UI 컴포넌트.
 *
 * 논리명을 구성하는 단어들의 매칭 상태를 시각적으로 표시한다.
 * 완전 매칭 시 파생 물리명을, 미매칭 시 누락 단어 등록 버튼을 제공한다.
 *
 * @param props WordCompositionValidatorProps
 */
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
              className={cn(
                'flex items-start gap-2 rounded-md border px-3 py-2',
                analysis.isCompleteMatch
                  ? 'border-composition-valid-border bg-composition-valid-bg text-composition-valid-foreground'
                  : 'border-composition-warning-border bg-composition-warning-bg text-composition-warning-foreground',
              )}
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
                  <p className="text-xs text-composition-valid-muted">
                    {t('dictionary.term.form.derivedPhysicalName')}:
                    <span className="ml-1 font-semibold">{analysis.derivedPhysicalName}</span>
                  </p>
                ) : analysis.isAmbiguous ? (
                  <p className="text-xs text-composition-warning-muted">
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

            {!analysis.isCompleteMatch &&
            !analysis.isAmbiguous &&
            analysis.creatableMissingSegments.length > 0 ? (
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
