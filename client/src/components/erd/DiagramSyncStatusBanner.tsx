import { LoaderCircle, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { ConnectionStatus } from '@/types/collaboration';
import type { DiagramCollaborationSetupErrorKind } from '@/collaboration/channel/diagram/use-diagram-collaboration-provider';

interface DiagramSyncStatusBannerProps {
  connectionStatus: ConnectionStatus;
  setupErrorKind?: DiagramCollaborationSetupErrorKind;
  onRetry?: (() => void) | undefined;
}

/**
 * API preview가 먼저 렌더된 뒤 Y.Doc 실시간 동기화가 완료될 때까지 안내하는 배너.
 */
export default function DiagramSyncStatusBanner({
  connectionStatus,
  setupErrorKind = null,
  onRetry,
}: DiagramSyncStatusBannerProps) {
  const { t } = useTranslation();
  const isDisconnected = connectionStatus === 'disconnected';
  const isAuthoritativeBootstrapBlocked = setupErrorKind === 'authoritative-bootstrap-required';

  return (
    <div
      className="border-b border-amber-200/80 bg-[linear-gradient(90deg,rgba(255,251,235,0.96),rgba(255,247,237,0.96),rgba(254,243,199,0.9))] px-4 py-2 text-amber-950"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-amber-500/15 p-2 text-amber-700">
            <LoaderCircle className={`h-4 w-4 ${isDisconnected ? '' : 'animate-spin'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span>{t('diagram.previewSync.banner.title')}</span>
              <span className="rounded-full border border-amber-300/80 bg-white/70 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-700">
                {t(`collaboration.status.${connectionStatus}`)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-amber-900/80">
              {isAuthoritativeBootstrapBlocked
                ? t('erd.collabSync.overlay.failed')
                : t(
                    isDisconnected
                      ? 'diagram.previewSync.banner.descriptionDisconnected'
                      : 'diagram.previewSync.banner.description',
                  )}
            </p>
          </div>
        </div>
        {isAuthoritativeBootstrapBlocked && onRetry ? (
          <Button
            variant="outline"
            size="sm"
            className="self-start border-amber-300/80 bg-white/70 text-amber-900 hover:bg-white md:self-center"
            onClick={onRetry}
          >
            {t('erd.collabSync.overlay.retry')}
          </Button>
        ) : (
          <div className="flex items-center gap-2 self-start rounded-full border border-amber-300/80 bg-white/70 px-3 py-1 text-xs font-medium text-amber-900 md:self-center">
            <Lock className="h-3.5 w-3.5" />
            <span>{t('diagram.previewSync.banner.locked')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
