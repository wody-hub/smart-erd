import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { SyncStage } from '@/types/diagram';

/**
 * CollabSyncBanner 컴포넌트의 Props.
 */
interface CollabSyncBannerProps {
  /** 현재 동기화 단계 */
  syncStage: SyncStage;
  /** 현재 재시도 횟수 */
  retryCount: number;
  /** 최대 재시도 횟수 */
  maxRetries: number;
  /** 수동 재시도 함수 */
  onRetry: () => void;
}

/**
 * 실시간 동기화 상태를 사용자에게 알리는 배너 컴포넌트.
 *
 * syncStage에 따라 연결 중/지연/실패 상태를 표시한다.
 * boot, yjs-live 상태에서는 표시하지 않는다.
 *
 * @param props CollabSyncBannerProps
 * @returns 배너 JSX 또는 null
 */
export default function CollabSyncBanner({
  syncStage,
  retryCount,
  maxRetries,
  onRetry,
}: CollabSyncBannerProps) {
  const { t } = useTranslation();

  if (syncStage === 'boot' || syncStage === 'yjs-live') {
    return null;
  }

  if (syncStage === 'api-preview' || syncStage === 'api-preview-empty') {
    return (
      <div
        className="px-4 py-1.5 text-xs bg-muted text-muted-foreground text-center"
        role="status"
        aria-live="polite"
      >
        {t('erd.collabSync.connecting')}
      </div>
    );
  }

  if (syncStage === 'yjs-timeout-degraded') {
    return (
      <div
        className="px-4 py-1.5 text-xs bg-erd-warning/10 text-erd-warning text-center"
        role="status"
        aria-live="polite"
      >
        {t('erd.collabSync.degraded', { current: retryCount, max: maxRetries })}
      </div>
    );
  }

  if (syncStage === 'yjs-failed-readonly') {
    return (
      <div
        className="px-4 py-1.5 text-xs bg-destructive/10 text-destructive text-center flex items-center justify-center gap-2"
        role="status"
        aria-live="polite"
      >
        <span>{t('erd.collabSync.failed')}</span>
        <Button variant="outline" size="sm" className="h-5 text-xs px-2" onClick={onRetry}>
          {t('erd.collabSync.retry')}
        </Button>
      </div>
    );
  }

  return null;
}
