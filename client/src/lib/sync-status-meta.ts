import { AlertTriangle, CheckCircle2, Loader2, XCircle, type LucideIcon } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { SyncStatus } from '@/constants/sync-status';

/** 동기화 상태 UI 메타 정보 */
export interface SyncStatusMeta {
  label: string;
  className: string;
  Icon: LucideIcon;
  spin: boolean;
}

/** 동기화 상태 값을 UI 메타 정보로 변환한다. */
export function getSyncStatusMeta(t: TFunction, syncStatus: SyncStatus): SyncStatusMeta | null {
  switch (syncStatus) {
    case 'idle-wait':
      return {
        label: t('erd.sync.status.idlePending'),
        className: 'text-muted-foreground',
        Icon: Loader2,
        spin: true,
      };
    case 'hold-parse-error':
      return {
        label: t('erd.sync.status.syntaxErrorHold'),
        className: 'text-destructive',
        Icon: XCircle,
        spin: false,
      };
    case 'hold-remote-lock':
      return {
        label: t('erd.sync.status.remoteLockHold'),
        className: 'text-erd-warning',
        Icon: AlertTriangle,
        spin: false,
      };
    case 'hold-queue-timeout':
      return {
        label: t('erd.sync.status.queueTimeoutManual'),
        className: 'text-erd-warning',
        Icon: AlertTriangle,
        spin: false,
      };
    case 'dropped-stale':
      return {
        label: t('erd.sync.status.staleDrop'),
        className: 'text-erd-warning',
        Icon: AlertTriangle,
        spin: false,
      };
    case 'synced':
      return {
        label: t('erd.sync.status.synced'),
        className: 'text-success',
        Icon: CheckCircle2,
        spin: false,
      };
    default:
      return null;
  }
}
