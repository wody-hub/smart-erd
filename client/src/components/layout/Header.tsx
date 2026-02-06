import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import useAuthStore from '@/stores/useAuthStore';

/**
 * 애플리케이션 상단 헤더 컴포넌트.
 *
 * 고정 높이(48px)의 다크 배경 바에 애플리케이션 타이틀("Smart ERD"),
 * 사용자 이름, 로그아웃 버튼을 표시한다.
 */
export default function Header() {
  const navigate = useNavigate();
  const { name, isAuthenticated, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-12 bg-gray-900 text-white flex items-center px-4 shrink-0">
      <h1 className="text-lg font-bold cursor-pointer" onClick={() => navigate('/teams')}>
        Smart ERD
      </h1>
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
