import { Navigate } from 'react-router-dom';
import useAuthStore from '@/stores/useAuthStore';
import { ROUTES } from '@/constants/routes';

/**
 * 인증 가드 컴포넌트.
 *
 * 토큰이 없으면 /login으로 리다이렉트하고,
 * 인증된 경우 자식 컴포넌트를 렌더링한다.
 *
 * @param props.children 인증 시 렌더링할 자식 컴포넌트
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <>{children}</>;
}
