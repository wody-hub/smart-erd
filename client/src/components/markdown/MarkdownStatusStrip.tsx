import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

/** markdown 상태 strip props. */
interface MarkdownStatusStripProps {
  /** 템플릿 표시 이름 */
  templateLabel: string | null;
  /** 미저장 변경 여부 */
  dirty: boolean;
  /** 저장 진행 여부 */
  savePending: boolean;
  /** 마지막 저장 시각 */
  lastSavedAt: string | null;
  /** frontmatter YAML 파싱 유효 여부 */
  frontmatterValid?: boolean;
}

/**
 * markdown 문서의 저장/템플릿 상태 strip을 렌더링한다.
 *
 * @param props 상태 strip props
 * @returns 상태 strip JSX
 */
export default function MarkdownStatusStrip({
  templateLabel,
  dirty,
  savePending,
  lastSavedAt,
  frontmatterValid = true,
}: MarkdownStatusStripProps) {
  const { t } = useTranslation();

  return (
    <div className="surface-operational flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3">
      {!frontmatterValid && (
        <Badge
          variant="outline"
          className="border-destructive/30 bg-destructive/10 text-destructive"
        >
          {t('markdown.status.frontmatterInvalid')}
        </Badge>
      )}
      {templateLabel && (
        <Badge variant="outline" className="border-primary/20 bg-primary/8 text-primary">
          {templateLabel}
        </Badge>
      )}
      <Badge
        variant="outline"
        className={
          dirty ? 'border-brand-warm/30 bg-brand-warm/10 text-brand-warm' : 'border-border/80 text-ink-secondary'
        }
      >
        {savePending
          ? t('markdown.status.saving')
          : dirty
            ? t('markdown.status.unsaved')
            : t('markdown.status.saved')}
      </Badge>
      {lastSavedAt && (
        <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {t('markdown.status.savedAt', { time: new Date(lastSavedAt).toLocaleTimeString() })}
        </span>
      )}
    </div>
  );
}
