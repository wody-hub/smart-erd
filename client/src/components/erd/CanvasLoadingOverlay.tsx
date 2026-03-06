import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import type { SyncStage } from '@/types/diagram';

interface CanvasLoadingOverlayProps {
  /** 현재 동기화 단계 */
  syncStage: SyncStage;
  /** 현재 재시도 횟수 */
  retryCount: number;
  /** 최대 재시도 횟수 */
  maxRetries: number;
  /** 수동 재시도 핸들러 */
  onRetry: () => void;
}

/**
 * 다이어그램 초기 렌더 대기 상태를 캔버스 중앙 오버레이로 안내한다.
 */
export default function CanvasLoadingOverlay({
  syncStage,
  retryCount,
  maxRetries,
  onRetry,
}: CanvasLoadingOverlayProps) {
  const { t } = useTranslation();

  const isFailed = syncStage === 'yjs-failed-readonly';
  const isDegraded = syncStage === 'yjs-timeout-degraded';
  const isApiPreview = syncStage === 'api-preview' || syncStage === 'api-preview-empty';

  let message = t('erd.collabSync.overlay.loadingGeneric');
  let detail: string | null = null;

  if (isApiPreview) {
    message = t('erd.collabSync.overlay.loading');
    detail = t('erd.collabSync.overlay.loadingDetail');
  } else if (isDegraded) {
    message = t('erd.collabSync.overlay.degraded', { current: retryCount, max: maxRetries });
  } else if (isFailed) {
    message = t('erd.collabSync.overlay.failed');
  }

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-md rounded-md border bg-card/95 px-4 py-3 shadow-sm text-center pointer-events-none">
        {isFailed ? (
          <div className="flex items-center justify-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-sm">{message}</p>
          </div>
        ) : (
          <Spinner className="justify-center text-foreground" text={message} />
        )}
        {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
        {isFailed && (
          <div className="mt-3 pointer-events-auto">
            <Button variant="outline" size="sm" onClick={onRetry}>
              {t('erd.collabSync.overlay.retry')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
