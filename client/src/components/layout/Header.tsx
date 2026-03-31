import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useAuthStore from '@/stores/useAuthStore';
import { ROUTES } from '@/constants/routes';
import { isElectron } from '@/lib/platform';
import LanguageSwitcher from './LanguageSwitcher';
import type { WorkspaceContext } from '@/types/workspace';
import WorkspaceHeaderShell from './WorkspaceHeaderShell';
import WorkspaceBreadcrumb from './WorkspaceBreadcrumb';

/** Header 컴포넌트의 props. */
interface HeaderProps {
  /** 현재 workspace 컨텍스트 */
  workspaceContext?: WorkspaceContext;
  /** 중앙 제목. 없으면 workspace 문서명을 사용한다. */
  title?: string;
  /** 우측 슬롯. 도메인 전용 액세서리는 page/erd 계층에서 조립해서 전달한다. */
  rightSlot?: React.ReactNode;
}

/**
 * 애플리케이션 상단 헤더 컴포넌트.
 *
 * 공통 workspace 헤더 shell 위에서 앱명, breadcrumb, 공용 유틸을 조합한다.
 * 도메인 전용 액세서리는 page 또는 도메인 컴포넌트에서 rightSlot으로 전달한다.
 */
export default function Header({
  workspaceContext,
  title,
  rightSlot,
}: HeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const name = useAuthStore((s) => s.name);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  const headerTitle = title ?? workspaceContext?.document?.name;

  /** 로그아웃 처리 후 로그인 페이지로 이동한다. */
  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <WorkspaceHeaderShell
      onAppClick={() => navigate(ROUTES.TEAMS)}
      appName={t('common.appName')}
      breadcrumb={<WorkspaceBreadcrumb context={workspaceContext} />}
      title={headerTitle}
      rightSlot={
        <div className="header-utility-rail">
          {rightSlot}
          <div className="header-utility-group">
            <LanguageSwitcher />
            {isElectron() && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(ROUTES.SETTINGS)}
                className="header-icon-button h-8 w-8"
                aria-label={t('settings.aria.settings')}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
          {isAuthenticated && (
            <div className="header-utility-group">
              <span className="hidden text-sm font-medium text-header-foreground/90 xl:inline">
                {name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="header-text-button h-8 px-3"
              >
                {t('auth.logout')}
              </Button>
            </div>
          )}
        </div>
      }
    />
  );
}
