import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConnectionStatus } from '@/types/collaboration';

/** 다이어그램 헤더 액세서리 props. */
interface DiagramHeaderAccessoryProps {
  /** 백업 버튼 클릭 핸들러 */
  onSave?: () => void;
  /** 백업 중 여부 */
  saving?: boolean;
  /** 협업 연결 상태 */
  connectionStatus?: ConnectionStatus;
  /** 편집 가능 여부 */
  canEdit?: boolean;
  /** 읽기 전용 메시지 */
  readOnlyMessage?: string;
  /** 편집기 전용 추가 액션 */
  accessory?: React.ReactNode;
}

/** 다이어그램 편집 화면 전용 저장/연결 상태 액세서리. */
export default function DiagramHeaderAccessory({
  onSave,
  saving,
  connectionStatus,
  canEdit = true,
  readOnlyMessage,
  accessory,
}: DiagramHeaderAccessoryProps) {
  const { t } = useTranslation();

  if (!connectionStatus && !onSave && !accessory && (canEdit || !readOnlyMessage)) {
    return null;
  }

  return (
    <>
      {(connectionStatus || (onSave && canEdit) || (!canEdit && readOnlyMessage)) && (
        <div className="header-utility-group">
          {connectionStatus && (
            <span
              className="header-status-pill"
              title={t(`collaboration.status.${connectionStatus}`)}
              aria-label={t(`collaboration.status.${connectionStatus}`)}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-erd-status-connected'
                    : connectionStatus === 'connecting'
                      ? 'bg-erd-status-connecting animate-pulse'
                      : 'bg-erd-status-disconnected'
                }`}
              />
              <span className="hidden xl:inline">
                {t(`collaboration.status.${connectionStatus}`)}
              </span>
            </span>
          )}
          {onSave && canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSave}
              disabled={saving}
              className="header-text-button h-8 px-3"
            >
              <Save className="mr-1 h-4 w-4" />
              {saving ? t('common.button.backingUp') : t('common.button.backup')}
            </Button>
          )}
          {!canEdit && (
            <span className="hidden text-xs text-header-muted xl:inline">
              {readOnlyMessage ?? t('permission.viewerReadonly')}
            </span>
          )}
        </div>
      )}
      {accessory}
    </>
  );
}
