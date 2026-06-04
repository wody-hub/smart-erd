import { AlertTriangle, Ban, CheckCircle2, Clock, XCircle } from 'lucide-react';
import i18next from 'i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AiProposalStatus } from '@/types/ai-chat';

interface AiProposalStatusBadgeProps {
  status: AiProposalStatus;
}

const STATUS_CLASS_NAMES: Record<AiProposalStatus, string> = {
  PENDING: 'border-amber-300/70 bg-amber-50 text-amber-800',
  CANCELLED: 'border-slate-300/80 bg-slate-50 text-slate-700',
  EXPIRED: 'border-slate-300/80 bg-slate-50 text-slate-700',
  REJECTED: 'border-rose-300/70 bg-rose-50 text-rose-800',
  EXECUTED: 'border-emerald-300/70 bg-emerald-50 text-emerald-800',
  FAILED: 'border-rose-300/70 bg-rose-50 text-rose-800',
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
