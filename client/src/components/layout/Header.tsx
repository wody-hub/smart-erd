import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useAuthStore from '@/stores/useAuthStore';

/** Header 컴포넌트의 props. */
interface HeaderProps {
  /** 현재 다이어그램 이름 (다이어그램 편집 화면에서만 전달) */
  diagramName?: string;
  /** 저장 버튼 클릭 핸들러 */
  onSave?: () => void;
  /** 저장 중 여부 */
  saving?: boolean;
  /** 변경 사항 존재 여부 */
  isDirty?: boolean;
}

/**
 * 애플리케이션 상단 헤더 컴포넌트.
 *
 * 고정 높이(48px)의 다크 배경 바에 애플리케이션 타이틀("Smart ERD"),
 * 사용자 이름, 로그아웃 버튼을 표시한다.
 * 다이어그램 편집 화면에서는 다이어그램 이름과 Save 버튼을 추가로 표시한다.
 */
export default function Header({ diagramName, onSave, saving, isDirty }: HeaderProps) {
  const navigate = useNavigate();
  const { name, isAuthenticated, logout } = useAuthStore();

  /** 로그아웃 처리 후 로그인 페이지로 이동한다. */
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-12 bg-gray-900 text-white flex items-center px-4 shrink-0">
      <h1 className="text-lg font-bold cursor-pointer" onClick={() => navigate('/teams')}>
        Smart ERD
      </h1>

      {diagramName && (
        <div className="ml-4 flex items-center gap-2">
          <span className="text-sm text-gray-400">/</span>
          <span className="text-sm font-medium">{diagramName}</span>
          {isDirty && (
            <span className="text-xs text-yellow-400" title="Unsaved changes">
              (unsaved)
            </span>
          )}
          {onSave && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSave}
              disabled={saving || !isDirty}
              className="text-gray-300 hover:text-white hover:bg-gray-800 ml-1"
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      )}

      {isAuthenticated && (
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-300">{name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-300 hover:text-white hover:bg-gray-800"
          >
            Logout
          </Button>
        </div>
      )}
    </header>
  );
}
