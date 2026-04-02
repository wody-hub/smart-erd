import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** 원격 mutation 정보 */
export interface RemoteMutationInfo {
  /** mutation command key */
  key: string;
  /** mutation payload */
  payload?: Record<string, unknown>;
}

/** RemotePendingBanner props */
export interface RemotePendingBannerProps {
  /** 현재 원격 pending mutation 정보 (null이면 배너 미표시) */
  remoteMutation: RemoteMutationInfo | null;
  /** 수락 콜백 -- useCallback으로 메모이제이션 필수 */
  onAccept: () => void;
  /** 거절 콜백 */
  onReject: () => void;
  /** 병합 콜백 (미구현 시 null) */
  onMerge?: (() => void) | null;
  /**
   * 현재 편집 중인 section ID.
   * undefined이면 section-aware 판단을 건너뛰고 항상 배너를 표시한다 (비마크다운 문서 호환).
   */
  activeSectionId?: string;
  /** 추가 className */
  className?: string;
}

/**
 * 원격 변경 pending 상태를 알리는 배너 컴포넌트.
 *
 * D-07: 원격 markdown:section-update가 현재 편집 중인 section과 다른 section이면 배너 없이 자동 수락한다.
 * D-08: 같은 section 충돌 시 기존 3버튼 UI(수락/거절/병합)를 표시한다.
 *
 * @param props RemotePendingBannerProps
 * @returns 배너 JSX 또는 null
 */
export function RemotePendingBanner({
  remoteMutation,
  onAccept,
  onReject,
  onMerge,
  activeSectionId,
  className,
}: RemotePendingBannerProps) {
  const { t } = useTranslation();

  // D-07: 원격 변경이 다른 section이면 배너 없이 자동 수락
  const isAutoAcceptTarget =
    remoteMutation?.key === 'markdown:section-update' &&
    activeSectionId !== undefined &&
    remoteMutation.payload?.sectionId !== activeSectionId;

  useEffect(() => {
    if (isAutoAcceptTarget) {
      onAccept();
    }
  }, [isAutoAcceptTarget, onAccept]);

  // 자동 수락 대상이면 렌더링하지 않음 (D-07)
  if (isAutoAcceptTarget) {
    return null;
  }

  if (!remoteMutation) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm',
        className,
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1 text-muted-foreground">
        {t('collaboration.remotePending.message', 'Remote changes pending')}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={onAccept}>
          {t('collaboration.remotePending.accept', 'Accept')}
        </Button>
        <Button variant="outline" size="sm" onClick={onReject}>
          {t('collaboration.remotePending.reject', 'Reject')}
        </Button>
        {onMerge && (
          <Button variant="outline" size="sm" onClick={onMerge}>
            {t('collaboration.remotePending.merge', 'Merge')}
          </Button>
        )}
      </div>
    </div>
  );
}
