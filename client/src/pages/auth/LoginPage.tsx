import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { login as loginApi } from '@/api/authApi';
import useAuthStore from '@/stores/useAuthStore';
import { getErrorMessage } from '@/lib/api-error';
import { isElectron, initServerUrl } from '@/lib/platform';
import { ROUTES } from '@/constants/routes';
import { toast } from 'sonner';

/** Electron 환경에서 선택 가능한 서버 URL 목록. */
const SERVER_URL_OPTIONS = [
  { label: 'Dev (localhost:9503)', value: 'http://localhost:9503' },
  { label: 'Test (localhost:9502)', value: 'http://localhost:9502' },
  { label: 'Local (localhost:9501)', value: 'http://localhost:9501' },
  { label: 'Dev (127.0.0.1:9503)', value: 'http://127.0.0.1:9503' },
  { label: 'Test (127.0.0.1:9502)', value: 'http://127.0.0.1:9502' },
  { label: 'Local (127.0.0.1:9501)', value: 'http://127.0.0.1:9501' },
];

/** Electron 서버 URL을 localStorage에 저장하는 키. */
const ELECTRON_SERVER_URL_KEY = 'smart-erd-server-url';

/**
 * 로그인 페이지 컴포넌트.
 *
 * 로그인 ID와 비밀번호 입력 폼을 중앙에 배치한 인증 화면이다.
 * Electron 환경에서는 서버 URL 선택 셀렉트박스를 추가로 표시한다.
 * 인증 성공 시 JWT 토큰을 저장하고 /teams 페이지로 이동한다.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  /** 로그인 ID 입력값 */
  const [loginId, setLoginId] = useState('');
  /** 비밀번호 입력값 */
  const [password, setPassword] = useState('');
  /** 선택된 서버 URL (Electron 전용) */
  const [serverUrl, setServerUrl] = useState('');
  const login = useAuthStore((s) => s.login);

  /** Electron 환경 여부 */
  const isDesktop = isElectron();

  // Electron: 저장된 서버 URL 로드 (electronAPI → localStorage fallback)
  useEffect(() => {
    if (!isDesktop) return;
    const loadUrl = async () => {
      const api = window.electronAPI;
      let saved = '';
      if (api) {
        saved = await api.getServerUrl();
      } else {
        saved = localStorage.getItem(ELECTRON_SERVER_URL_KEY) ?? '';
      }
      const url = saved || SERVER_URL_OPTIONS[0].value;
      setServerUrl(url);
      initServerUrl(url);
    };
    loadUrl();
  }, [isDesktop]);

  /**
   * 서버 URL 변경 시 저장하고 API base URL을 갱신한다.
   * electronAPI가 있으면 electron-store에, 없으면 localStorage에 저장한다.
   *
   * @param url 선택된 서버 URL
   */
  const handleServerUrlChange = async (url: string) => {
    setServerUrl(url);
    initServerUrl(url);
    const api = window.electronAPI;
    if (api) {
      await api.setServerUrl(url);
    } else {
      localStorage.setItem(ELECTRON_SERVER_URL_KEY, url);
    }
  };

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
    // Electron: 서버 URL이 설정되지 않았으면 먼저 저장
    if (isDesktop && serverUrl) {
      initServerUrl(serverUrl);
    }
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
            {/* Electron 전용: 서버 URL 선택 */}
            {isDesktop && (
              <div className="space-y-2">
                <Label htmlFor="server-url">{t('settings.serverUrlLabel')}</Label>
                <Select value={serverUrl} onValueChange={handleServerUrlChange}>
                  <SelectTrigger id="server-url">
                    <SelectValue placeholder={t('settings.serverUrlPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVER_URL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
