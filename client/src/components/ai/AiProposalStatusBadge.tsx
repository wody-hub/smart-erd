import { AlertTriangle, Ban, CheckCircle2, Clock, XCircle } from 'lucide-react';
import i18next from 'i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AiProposalStatus } from '@/types/ai-chat';

interface AiProposalStatusBadgeProps {
  status: AiProposalStatus;
}

const STATUS_CLASS_NAMES: Record<AiProposalStatus, string> = {
  PENDING: 'border-erd-warning/40 bg-secondary text-erd-warning',
  CANCELLED: 'border-border/80 bg-card/80 text-muted-foreground',
  EXPIRED: 'border-border/80 bg-card/80 text-muted-foreground',
  REJECTED: 'border-destructive/35 bg-destructive/5 text-destructive',
  EXECUTED: 'border-success/35 bg-success/10 text-success',
  FAILED: 'border-destructive/35 bg-destructive/5 text-destructive',
};

function StatusIcon({ status }: AiProposalStatusBadgeProps) {
  const className = 'h-3.5 w-3.5 shrink-0';
  if (status === 'EXECUTED') {
    return <CheckCircle2 className={className} aria-hidden="true" />;
  }
  if (status === 'CANCELLED') {
    return <Ban className={className} aria-hidden="true" />;
  }
  if (status === 'EXPIRED') {
    return <Clock className={className} aria-hidden="true" />;
  }
  if (status === 'PENDING') {
    return <AlertTriangle className={className} aria-hidden="true" />;
  }
  return <XCircle className={className} aria-hidden="true" />;
}

function translateStatus(status: AiProposalStatus): string {
  if (status === 'PENDING') {
    return i18next.t('aiChat.proposals.status.pending');
  }
  if (status === 'CANCELLED') {
    return i18next.t('aiChat.proposals.status.cancelled');
  }
  if (status === 'EXPIRED') {
    return i18next.t('aiChat.proposals.status.expired');
  }
  if (status === 'REJECTED') {
    return i18next.t('aiChat.proposals.status.rejected');
  }
  if (status === 'EXECUTED') {
    return i18next.t('aiChat.proposals.status.executed');
  }
  return i18next.t('aiChat.proposals.status.failed');
}

export default function AiProposalStatusBadge({ status }: AiProposalStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn('gap-1.5', STATUS_CLASS_NAMES[status])}>
      <StatusIcon status={status} />
      {translateStatus(status)}
    </Badge>
  );
}
