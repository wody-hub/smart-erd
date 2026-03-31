import { AlertTriangle, CheckCircle2, Loader2, XCircle, type LucideIcon } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { SyncStatus } from '@/constants/sync-status';
import type { DraftState } from '@/collaboration/core/draft/draft-state';
import { isDraftRemotePending } from '@/collaboration/core/draft/draft-state';
import type { CodeEditorRefreshConfirmReason } from './code-editor-draft-policy';

/** 동기화 상태 UI 메타 정보 */
export interface SyncStatusMeta {
  label: string;
  className: string;
  Icon: LucideIcon;
  spin: boolean;
}

/**
 * 동기화 상태 값을 UI 메타 정보로 변환한다.
 *
 * @param t i18n 번역 함수
 * @param syncStatus 현재 동기화 상태
 * @returns 상태별 UI 메타 정보. 표시할 상태가 없으면 null
 */
export function getSyncStatusMeta(t: TFunction, syncStatus: SyncStatus): SyncStatusMeta | null {
  return getBaseSyncStatusMeta(t, syncStatus);
}

function getBaseSyncStatusMeta(t: TFunction, syncStatus: SyncStatus): SyncStatusMeta | null {
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
    case 'hold-manual-confirm':
      return {
        label: t('erd.sync.status.manualConfirmHold'),
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

export function getCodeEditorStatusMeta(
  t: TFunction,
  syncStatus: SyncStatus,
  draftState: DraftState,
): SyncStatusMeta | null {
  if (isDraftRemotePending(draftState)) {
    return {
      label: t('erd.codeEditor.remotePending'),
      className: 'text-erd-warning',
      Icon: AlertTriangle,
      spin: false,
    };
  }

  return getBaseSyncStatusMeta(t, syncStatus);
}

export function getCodeEditorRefreshConfirmCopy(
  t: TFunction,
  reason: CodeEditorRefreshConfirmReason | null,
): { title: string; description: string } {
  switch (reason) {
    case 'remote-pending':
      return {
        title: t('erd.codeEditor.refreshConfirmTitle'),
        description: t('erd.codeEditor.refreshConfirmDescriptionRemotePending'),
      };
    case 'invalid-draft':
      return {
        title: t('erd.codeEditor.refreshConfirmTitle'),
        description: t('erd.codeEditor.refreshConfirmDescriptionInvalidDraft'),
      };
    case 'stale-draft':
      return {
        title: t('erd.codeEditor.refreshConfirmTitle'),
        description: t('erd.codeEditor.refreshConfirmDescriptionStaleDraft'),
      };
    case 'local-dirty':
    default:
      return {
        title: t('erd.codeEditor.refreshConfirmTitle'),
        description: t('erd.codeEditor.refreshConfirmDescription'),
      };
  }
}
