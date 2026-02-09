import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { signup } from '@/api/authApi';
import useAuthStore from '@/stores/useAuthStore';
import { getErrorMessage } from '@/lib/api-error';
import { ROUTES } from '@/constants/routes';
import { toast } from 'sonner';

/**
 * 회원가입 페이지 컴포넌트.
 *
 * 로그인 ID, 비밀번호, 이름을 입력받아 회원가입을 수행한다.
 * 성공 시 자동 로그인되어 /teams 페이지로 이동한다.
 */
export default function SignupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  /** 로그인 ID 입력값 */
  const [loginId, setLoginId] = useState('');
  /** 비밀번호 입력값 */
  const [password, setPassword] = useState('');
  /** 사용자 표시 이름 입력값 */
  const [name, setName] = useState('');
  const login = useAuthStore((s) => s.login);

  const signupMutation = useMutation({
    mutationFn: () => signup(loginId, password, name),
    onSuccess: (data) => {
      login(data.accessToken, data.refreshToken, data.loginId, data.name);
      navigate(ROUTES.TEAMS);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('auth.signup.error'))),
  });

  /** 회원가입 폼 제출 핸들러. @param e 폼 이벤트 */
  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    signupMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <Card className="w-96">
        <CardHeader>
          <CardTitle className="text-center">{t('auth.signup.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="signup-login-id">{t('auth.signup.loginId')}</Label>
              <Input
                id="signup-login-id"
                type="text"
                placeholder={t('auth.signup.loginIdPlaceholder')}
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-name">{t('auth.signup.name')}</Label>
              <Input
                id="signup-name"
                type="text"
                placeholder={t('auth.signup.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">{t('auth.signup.password')}</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder={t('auth.signup.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={signupMutation.isPending}>
              {signupMutation.isPending ? t('auth.signup.submitting') : t('auth.signup.submit')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            {t('auth.signup.hasAccount')}{' '}
            <Link to={ROUTES.LOGIN} className="text-primary underline-offset-4 hover:underline">
              {t('auth.signup.loginLink')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
