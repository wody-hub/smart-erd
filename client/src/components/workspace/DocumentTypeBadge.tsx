import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { getWorkspaceDocumentTypeLabel } from '@/lib/workspace-labels';
import { cn } from '@/lib/utils';
import type { WorkspaceDocumentType } from '@/types/workspace';

interface DocumentTypeBadgeProps {
  documentType: WorkspaceDocumentType;
  className?: string;
}

const DOCUMENT_TYPE_BADGE_STYLES: Record<WorkspaceDocumentType, string> = {
  erd: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  markdown: 'border-sky-200 bg-sky-50 text-sky-700',
  'screen-spec': 'border-amber-200 bg-amber-50 text-amber-700',
};

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
        'rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]',
        DOCUMENT_TYPE_BADGE_STYLES[documentType],
        className,
      )}
    >
      {t(token.key, token.values)}
    </Badge>
  );
}
