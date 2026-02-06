import { Navigate } from 'react-router-dom';
import useAuthStore from '@/stores/useAuthStore';

/**
 * 인증 가드 컴포넌트.
 *
 * 토큰이 없으면 /login으로 리다이렉트하고,
 * 인증된 경우 자식 컴포넌트를 렌더링한다.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
