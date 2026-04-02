import { useTranslation } from 'react-i18next';

/** markdown preview pane props. */
interface MarkdownPreviewPaneProps {
  /** sanitize 된 preview html */
  html: string;
}

/**
 * markdown preview pane을 렌더링한다.
 *
 * @param props preview pane props
 * @returns preview pane JSX
 */
export default function MarkdownPreviewPane({ html }: MarkdownPreviewPaneProps) {
  const { t } = useTranslation();

  return (
    <section className="surface-operational flex h-full flex-col rounded-2xl px-5 py-5">
      <div className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {t('markdown.preview.title')}
      </div>
      <div
        className="prose prose-slate max-w-none flex-1 overflow-auto text-sm leading-7 text-foreground"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}
