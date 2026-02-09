import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { signup } from '@/api/authApi';
import useAuthStore from '@/stores/useAuthStore';
import { getErrorMessage } from '@/lib/api-error';
import { ROUTES } from '@/constants/routes';

/**
 * 회원가입 페이지 컴포넌트.
 *
 * 로그인 ID, 비밀번호, 이름을 입력받아 회원가입을 수행한다.
 * 성공 시 자동 로그인되어 /teams 페이지로 이동한다.
 */
export default function SignupPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  /** 로그인 ID 입력값 */
  const [loginId, setLoginId] = useState('');
  /** 비밀번호 입력값 */
  const [password, setPassword] = useState('');
  /** 사용자 표시 이름 입력값 */
  const [name, setName] = useState('');
  /** 회원가입 실패 시 에러 메시지 */
  const [error, setError] = useState('');
  /** 회원가입 API 호출 중 여부 */
  const [loading, setLoading] = useState(false);

  /** 회원가입 폼 제출 핸들러. 가입 성공 시 자동 로그인 후 /teams로 이동한다. @param e 폼 이벤트 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await signup(loginId, password, name);
      login(data.accessToken, data.refreshToken, data.loginId, data.name);
      navigate(ROUTES.TEAMS);
    } catch (err) {
      setError(getErrorMessage(err, 'Signup failed. Login ID may already exist.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <Card className="w-96">
        <CardHeader>
          <CardTitle className="text-center">Sign Up</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="signup-login-id">Login ID</Label>
              <Input
                id="signup-login-id"
                type="text"
                placeholder="2~50 characters"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-name">Name</Label>
              <Input
                id="signup-name"
                type="text"
                placeholder="Your display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="8+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing up...' : 'Sign Up'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to={ROUTES.LOGIN} className="text-primary underline-offset-4 hover:underline">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
