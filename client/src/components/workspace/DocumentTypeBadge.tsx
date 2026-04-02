import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { getWorkspaceDocumentTypeLabel } from '@/lib/workspace-labels';
import { cn } from '@/lib/utils';
import type { WorkspaceDocumentType } from '@/types/workspace';

/** 문서 유형 배지 props. */
interface DocumentTypeBadgeProps {
  /** 문서 유형 */
  documentType: WorkspaceDocumentType;
  /** 추가 CSS 클래스 */
  className?: string;
}

/** 문서 유형별 배지 색상 스타일. */
const DOCUMENT_TYPE_BADGE_STYLES: Record<WorkspaceDocumentType, string> = {
  erd: 'border-brand-warm/30 bg-brand-warm/12 text-brand-warm',
  markdown: 'border-primary/20 bg-primary/10 text-primary',
  'screen-spec': 'border-brand-secondary/24 bg-brand-secondary/12 text-brand-secondary',
};

/**
 * 문서 유형 배지를 렌더링한다.
 *
 * @param props 배지 props
 * @returns 문서 유형 배지 JSX
 */
export default function DocumentTypeBadge({
  documentType,
  className,
}: DocumentTypeBadgeProps) {
  const { t } = useTranslation();
  const token = getWorkspaceDocumentTypeLabel(documentType);

  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
        DOCUMENT_TYPE_BADGE_STYLES[documentType],
        className,
      )}
    >
      {t(token.key, token.values)}
    </Badge>
  );
}
