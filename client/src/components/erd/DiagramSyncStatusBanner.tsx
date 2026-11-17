import { LoaderCircle, Lock, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { ConnectionIssueKind, ConnectionStatus } from '@/types/collaboration';
import type { DiagramCollaborationSetupErrorKind } from '@/collaboration/channel/diagram/use-diagram-collaboration-provider';
import type { PreviewSyncStatus } from '@/collaboration/core/collaboration-preview-sync-status';

interface DiagramSyncStatusBannerProps {
  previewSyncStatus: PreviewSyncStatus;
  connectionStatus: ConnectionStatus;
  connectionIssue?: ConnectionIssueKind | null;
  setupErrorKind?: DiagramCollaborationSetupErrorKind;
  onRetry?: (() => void) | undefined;
}

/**
 * API preview가 먼저 렌더된 뒤 Y.Doc 실시간 동기화가 완료될 때까지 안내하는 배너.
 */
export default function DiagramSyncStatusBanner({
  connectionStatus,
  previewSyncStatus,
  connectionIssue = null,
  setupErrorKind = null,
  onRetry,
}: DiagramSyncStatusBannerProps) {
  const { t } = useTranslation();
  const isDisconnected = connectionStatus === 'disconnected';
  const isAuthoritativeBootstrapBlocked = setupErrorKind === 'authoritative-bootstrap-required';
  const isSnapshotDelayed = previewSyncStatus === 'degraded';
  const shouldShowRetry =
    (isAuthoritativeBootstrapBlocked || connectionIssue !== null || isSnapshotDelayed) && !!onRetry;
  const retryLabel = t(
    connectionIssue
      ? 'diagram.previewSync.banner.retryConnection'
      : isSnapshotDelayed
        ? 'diagram.previewSync.retrySnapshot'
        : 'erd.collabSync.overlay.retry',
  );

  const description = isAuthoritativeBootstrapBlocked
    ? t('erd.collabSync.overlay.failed')
    : connectionIssue
      ? t(`diagram.previewSync.banner.descriptionIssue.${connectionIssue}`)
      : isSnapshotDelayed
        ? t('diagram.previewSync.snapshotDelayed')
        : t(
            isDisconnected
              ? 'diagram.previewSync.banner.descriptionDisconnected'
              : 'diagram.previewSync.banner.description',
          );

  return (
    <div
      className="banner-warm-surface border-b px-4 py-2 text-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-brand-warm/12 p-2 text-brand-warm">
            {isSnapshotDelayed ? (
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            ) : (
              <LoaderCircle
                className={`h-4 w-4 ${isDisconnected || connectionIssue ? '' : 'animate-spin'}`}
                aria-hidden="true"
              />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span>{t('diagram.previewSync.banner.title')}</span>
              <span className="rounded-full border border-brand-warm/30 bg-card/80 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-brand-warm">
                {t(`collaboration.status.${connectionStatus}`)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-ink-secondary">{description}</p>
          </div>
        </div>
        {shouldShowRetry ? (
          <Button
            variant="outline"
            size="sm"
            className="self-start border-brand-warm/30 bg-card/82 text-foreground hover:bg-card md:self-center"
            onClick={onRetry}
            aria-label={retryLabel}
          >
            {retryLabel}
          </Button>
        ) : (
          <div className="flex items-center gap-2 self-start rounded-full border border-brand-warm/30 bg-card/82 px-3 py-1 text-xs font-medium text-ink-secondary md:self-center">
            <Lock className="h-3.5 w-3.5" />
            <span>{t('diagram.previewSync.banner.locked')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
