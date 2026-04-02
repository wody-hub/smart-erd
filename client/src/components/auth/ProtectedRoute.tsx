import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Spinner from '@/components/ui/spinner';
import useAuthStore from '@/stores/useAuthStore';
import { ROUTES } from '@/constants/routes';
import { hasUsableAccessTokenSync, resolveUsableAccessToken } from '@/lib/auth-refresh';

/**
 * 인증 가드 컴포넌트.
 *
 * 토큰이 없으면 /login으로 리다이렉트하고,
 * 인증된 경우 자식 컴포넌트를 렌더링한다.
 *
 * @param props.children 인증 시 렌더링할 자식 컴포넌트
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [authGateState, setAuthGateState] = useState<'checking' | 'ready' | 'unauthenticated'>(
    () => {
      if (hasUsableAccessTokenSync(accessToken ?? undefined)) {
        return 'ready';
      }
      if (accessToken || refreshToken) {
        return 'checking';
      }
      return 'unauthenticated';
    },
  );

  useEffect(() => {
    let cancelled = false;

    if (hasUsableAccessTokenSync(accessToken ?? undefined)) {
      setAuthGateState('ready');
      return () => {
        cancelled = true;
      };
    }

    if (!accessToken && !refreshToken) {
      setAuthGateState('unauthenticated');
      return () => {
        cancelled = true;
      };
    }

    setAuthGateState('checking');
    void resolveUsableAccessToken(accessToken ?? undefined).then((token) => {
      if (cancelled) {
        return;
      }
      setAuthGateState(token ? 'ready' : 'unauthenticated');
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshToken]);

  if (authGateState === 'checking') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (authGateState === 'unauthenticated') {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <>{children}</>;
}
