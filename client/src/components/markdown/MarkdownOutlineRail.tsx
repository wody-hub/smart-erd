import { ScrollText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { MarkdownHeadingItem } from '@/types/markdown';

/** markdown outline rail props. */
interface MarkdownOutlineRailProps {
  /** heading 목록 */
  headings: MarkdownHeadingItem[];
}

/**
 * markdown 문서 outline rail을 렌더링한다.
 *
 * @param props outline rail props
 * @returns outline rail JSX
 */
export default function MarkdownOutlineRail({ headings }: MarkdownOutlineRailProps) {
  const { t } = useTranslation();

  return (
    <aside className="surface-operational flex h-full flex-col rounded-2xl px-4 py-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ScrollText className="h-4 w-4 text-primary" />
        {t('markdown.outline.title')}
      </div>
      {headings.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {t('markdown.outline.empty')}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {headings.map((heading) => (
            <div
              key={heading.id}
              className={cn('text-sm leading-6 text-ink-secondary', heading.level > 1 && 'pl-3')}
            >
              {heading.text}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
