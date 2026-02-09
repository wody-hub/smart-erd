import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { login as loginApi } from '@/api/authApi';
import useAuthStore from '@/stores/useAuthStore';
import { getErrorMessage } from '@/lib/api-error';
import { ROUTES } from '@/constants/routes';

/**
 * 로그인 페이지 컴포넌트.
 *
 * 로그인 ID와 비밀번호 입력 폼을 중앙에 배치한 인증 화면이다.
 * 인증 성공 시 JWT 토큰을 저장하고 /teams 페이지로 이동한다.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  /** 로그인 ID 입력값 */
  const [loginId, setLoginId] = useState('');
  /** 비밀번호 입력값 */
  const [password, setPassword] = useState('');
  /** 로그인 실패 시 에러 메시지 */
  const [error, setError] = useState('');
  /** 로그인 API 호출 중 여부 */
  const [loading, setLoading] = useState(false);

  /** 로그인 폼 제출 핸들러. API 인증 후 토큰을 저장하고 /teams로 이동한다. @param e 폼 이벤트 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginApi(loginId, password);
      login(data.accessToken, data.refreshToken, data.loginId, data.name);
      navigate(ROUTES.TEAMS);
    } catch (err) {
      setError(getErrorMessage(err, 'Login ID or password is incorrect.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <Card className="w-96">
        <CardHeader>
          <CardTitle className="text-center">Smart ERD</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="login-id">Login ID</Label>
              <Input
                id="login-id"
                type="text"
                placeholder="Enter your login ID"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to={ROUTES.SIGNUP} className="text-primary underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
