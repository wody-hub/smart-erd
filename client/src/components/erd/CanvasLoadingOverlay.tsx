import { useTranslation } from 'react-i18next';
import Spinner from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import type { SyncStage } from '@/types/diagram';

/**
 * CanvasLoadingOverlay 컴포넌트의 Props.
 */
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
 * 캔버스 로딩 오버레이.
 *
 * 다이어그램 진입 직후 캔버스에 노드가 그려질 때까지
 * 로딩/동기화 상태를 시각적으로 안내한다.
 *
 * @param props CanvasLoadingOverlayProps
 * @returns 캔버스 로딩 오버레이 JSX
 */
export default function CanvasLoadingOverlay({
  syncStage,
  retryCount,
  maxRetries,
  onRetry,
}: CanvasLoadingOverlayProps) {
  const { t } = useTranslation();

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        {syncStage === 'yjs-failed-readonly' ? (
          <>
            <p className="text-destructive text-sm">
              {t('erd.collabSync.overlay.failed')}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="pointer-events-auto"
              onClick={onRetry}
            >
              {t('erd.collabSync.overlay.retry')}
            </Button>
          </>
        ) : syncStage === 'yjs-timeout-degraded' ? (
          <>
            <Spinner />
            <p className="text-erd-warning text-sm">
              {t('erd.collabSync.overlay.degraded', {
                current: retryCount,
                max: maxRetries,
              })}
            </p>
          </>
        ) : syncStage === 'api-preview' || syncStage === 'api-preview-empty' ? (
          <>
            <Spinner />
            <p className="text-muted-foreground text-sm">
              {t('erd.collabSync.overlay.loading')}
            </p>
            <p className="text-muted-foreground/70 text-xs">
              {t('erd.collabSync.overlay.loadingDetail')}
            </p>
          </>
        ) : (
          <>
            <Spinner />
            <p className="text-muted-foreground text-sm">
              {t('erd.collabSync.overlay.loadingGeneric')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
