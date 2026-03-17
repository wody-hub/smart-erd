import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useAuthStore from '@/stores/useAuthStore';
import { ROUTES } from '@/constants/routes';
import { isElectron } from '@/lib/platform';
import LanguageSwitcher from './LanguageSwitcher';
import type { ConnectionStatus } from '@/types/collaboration';

/** Header 컴포넌트의 props. */
interface HeaderProps {
  /** 현재 다이어그램 이름 (다이어그램 편집 화면에서만 전달) */
  diagramName?: string;
  /** 백업 버튼 클릭 핸들러 */
  onSave?: () => void;
  /** 백업 중 여부 */
  saving?: boolean;
  /** WebSocket 연결 상태 (다이어그램 편집 화면에서만 전달) */
  connectionStatus?: ConnectionStatus;
  /** 편집 가능 여부 (VIEWER일 때 false) */
  canEdit?: boolean;
  /** 편집 잠금 사유 메시지 */
  readOnlyMessage?: string;
  /** 다이어그램 문맥에서만 노출할 보조 UI */
  diagramAccessory?: React.ReactNode;
}

/**
 * 애플리케이션 상단 헤더 컴포넌트.
 *
 * 고정 높이(48px)의 다크 배경 바에 애플리케이션 타이틀("Smart ERD"),
 * 사용자 이름, 로그아웃 버튼을 표시한다.
 * 다이어그램 편집 화면에서는 다이어그램 이름과 Save 버튼을 추가로 표시한다.
 *
 * @param props.diagramName      현재 다이어그램 이름 (다이어그램 편집 화면에서만 전달)
 * @param props.onSave           백업 버튼 클릭 핸들러
 * @param props.saving           백업 중 여부
 * @param props.connectionStatus WebSocket 연결 상태
 * @param props.canEdit          편집 가능 여부 (VIEWER일 때 false)
 */
export default function Header({
  diagramName,
  onSave,
  saving,
  connectionStatus,
  canEdit = true,
  readOnlyMessage,
  diagramAccessory,
}: HeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const name = useAuthStore((s) => s.name);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);

  /** 로그아웃 처리 후 로그인 페이지로 이동한다. */
  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <header className="h-12 bg-header text-header-foreground flex items-center px-4 shrink-0">
      <h1 className="text-lg font-bold cursor-pointer" onClick={() => navigate(ROUTES.TEAMS)}>
        {t('common.appName')}
      </h1>

      {diagramName && (
        <div className="ml-4 flex items-center gap-2">
          <span className="text-sm text-header-muted">/</span>
          <span className="text-sm font-medium">{diagramName}</span>
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
              className="text-header-muted hover:text-header-foreground hover:bg-header/80 ml-1"
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? t('common.button.backingUp') : t('common.button.backup')}
            </Button>
          )}
          {!canEdit && (
            <span className="text-xs text-header-muted ml-2">
              {readOnlyMessage ?? t('permission.viewerReadonly')}
            </span>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        {diagramAccessory}
        <LanguageSwitcher />
        {isElectron() && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(ROUTES.SETTINGS)}
            className="text-header-muted hover:text-header-foreground hover:bg-header/80"
            aria-label={t('settings.aria.settings')}
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
        {isAuthenticated && (
          <>
            <span className="text-sm text-header-muted">{name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-header-muted hover:text-header-foreground hover:bg-header/80"
            >
              {t('auth.logout')}
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
