import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConnectionStatus } from '@/types/collaboration';

interface EditorHeaderAccessoryProps {
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

/** 편집기 화면에서만 필요한 저장/연결 상태 액세서리. */
export default function EditorHeaderAccessory({
  onSave,
  saving,
  connectionStatus,
  canEdit = true,
  readOnlyMessage,
  accessory,
}: EditorHeaderAccessoryProps) {
  const { t } = useTranslation();

  if (!connectionStatus && !onSave && !accessory && (canEdit || !readOnlyMessage)) {
    return null;
  }

  return (
    <>
      {connectionStatus && (
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-erd-status-connected'
              : connectionStatus === 'connecting'
                ? 'bg-erd-status-connecting animate-pulse'
                : 'bg-erd-status-disconnected'
          }`}
          title={t(`collaboration.status.${connectionStatus}`)}
          aria-label={t(`collaboration.status.${connectionStatus}`)}
        />
      )}
      {onSave && canEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSave}
          disabled={saving}
          className="text-header-muted hover:text-header-foreground hover:bg-header/80"
        >
          <Save className="h-4 w-4 mr-1" />
          {saving ? t('common.button.backingUp') : t('common.button.backup')}
        </Button>
      )}
      {!canEdit && (
        <span className="hidden text-xs text-header-muted lg:inline">
          {readOnlyMessage ?? t('permission.viewerReadonly')}
        </span>
      )}
      {accessory}
    </>
  );
}

