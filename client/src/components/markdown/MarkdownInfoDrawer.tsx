import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** markdown 문서 정보 drawer props. */
interface MarkdownInfoDrawerProps {
  /** drawer 오픈 여부 */
  open: boolean;
  /** 오픈 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** frontmatter object */
  frontmatter: Record<string, unknown>;
  /** 템플릿 표시 이름 */
  templateLabel: string | null;
  /** 모바일 다이얼로그 전용 여부 */
  mobileOnly?: boolean;
}

/**
 * frontmatter와 템플릿 정보를 보여주는 정보 패널을 렌더링한다.
 *
 * @param props 정보 패널 props
 * @returns 정보 drawer JSX
 */
export default function MarkdownInfoDrawer({
  open,
  onOpenChange,
  frontmatter,
  templateLabel,
  mobileOnly = false,
}: MarkdownInfoDrawerProps) {
  const { t } = useTranslation();
  const entries = useMemo(() => Object.entries(frontmatter), [frontmatter]);
  const content = (
    <div className="space-y-3">
      {templateLabel && (
        <div className="rounded-xl border border-border/80 bg-secondary/40 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t('markdown.info.template')}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{templateLabel}</p>
        </div>
      )}
      {entries.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">{t('markdown.info.empty')}</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="rounded-xl border border-border/75 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {key}
              </p>
              <p className="mt-1 break-words text-sm leading-6 text-foreground">
                {Array.isArray(value) ? value.join(', ') : String(value)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!mobileOnly) {
    return (
      <aside className="surface-operational rounded-2xl px-4 py-4">
        <div className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t('markdown.info.title')}
        </div>
        {content}
      </aside>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('markdown.info.title')}</DialogTitle>
          <DialogDescription>{t('markdown.info.description')}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
