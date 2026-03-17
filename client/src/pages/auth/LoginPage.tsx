import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { login as loginApi } from '@/api/authApi';
import useAuthStore from '@/stores/useAuthStore';
import { getErrorMessage } from '@/lib/api-error';
import { ROUTES } from '@/constants/routes';
import { toast } from 'sonner';

/**
 * 로그인 페이지 컴포넌트.
 *
 * 로그인 ID와 비밀번호 입력 폼을 중앙에 배치한 인증 화면이다.
 * 인증 성공 시 JWT 토큰을 저장하고 /teams 페이지로 이동한다.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  /** 로그인 ID 입력값 */
  const [loginId, setLoginId] = useState('');
  /** 비밀번호 입력값 */
  const [password, setPassword] = useState('');
  const login = useAuthStore((s) => s.login);

  const loginMutation = useMutation({
    mutationFn: () => loginApi(loginId, password),
    onSuccess: (data) => {
      login(data.accessToken, data.refreshToken, data.loginId, data.name);
      navigate(ROUTES.TEAMS);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('auth.login.error'))),
  });

  /** 로그인 폼 제출 핸들러. @param e 폼 이벤트 */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!loginId.trim() || !password) return;
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <Card className="w-96">
        <CardHeader>
          <CardTitle className="text-center">{t('auth.login.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="login-id">{t('auth.login.loginId')}</Label>
              <Input
                id="login-id"
                type="text"
                placeholder={t('auth.login.loginIdPlaceholder')}
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.login.password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('auth.login.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending || !loginId.trim() || !password}
            >
              {loginMutation.isPending ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            {t('auth.login.noAccount')}{' '}
            <Link to={ROUTES.SIGNUP} className="text-primary underline-offset-4 hover:underline">
              {t('auth.login.signupLink')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
