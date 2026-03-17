import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { STORAGE_KEYS } from '@/constants/storage';
import { getServerUrl, updateServerUrl } from '@/lib/platform';
import { clearAuthState } from '@/lib/auth-refresh';

/**
 * Electron 전용 서버 URL 설정 페이지.
 *
 * 서버 URL 입력, 연결 테스트, 저장 기능을 제공한다.
 * 서버 URL이 미설정된 첫 진입 시에는 저장 후 로그인 페이지로 이동하고,
 * 이후 재방문 시에는 뒤로 가기가 가능하다.
 */
export default function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  /** 서버 URL 입력값 */
  const [serverUrl, setServerUrl] = useState('');
  /** 연결 테스트 진행 중 여부 */
  const [testing, setTesting] = useState(false);
  /** 연결 테스트 결과 (null: 미시도, true: 성공, false: 실패) */
  const [testResult, setTestResult] = useState<boolean | null>(null);
  /** 연결 테스트 오류 메시지 */
  const [testError, setTestError] = useState('');
  /** 저장 진행 중 여부 */
  const [saving, setSaving] = useState(false);

  /** 기존에 설정된 서버 URL이 있는지 (뒤로 가기 가능 여부 판단) */
  const hasExistingUrl = !!getServerUrl();

  useEffect(() => {
    const loadUrl = async () => {
      const api = window.electronAPI;
      if (api) {
        const url = await api.getServerUrl();
        setServerUrl(url);
      }
    };
    loadUrl();
  }, []);

  /**
   * 서버 연결을 테스트한다. GET {url}/api/health를 호출하여 성공 여부를 확인.
   */
  const handleTestConnection = async () => {
    const trimmedUrl = serverUrl.trim().replace(/\/+$/, '');
    if (!trimmedUrl) return;

    setTesting(true);
    setTestResult(null);
    setTestError('');

    try {
      const res = await axios.get(`${trimmedUrl}/api/health`, { timeout: 5000 });
      if (res.status >= 200 && res.status < 300) {
        setTestResult(true);
      } else {
        setTestResult(false);
        setTestError(t('settings.testServerError', { status: res.status }));
      }
    } catch {
      setTestResult(false);
      setTestError(t('settings.testFailedDetail'));
    } finally {
      setTesting(false);
    }
  };

  /**
   * 서버 URL을 저장하고 앱 상태를 초기화한다.
   */
  const handleSave = async () => {
    const trimmedUrl = serverUrl.trim().replace(/\/+$/, '');
    if (!trimmedUrl) return;

    setSaving(true);
    try {
      await updateServerUrl(trimmedUrl, {
        clearCache: () => queryClient.clear(),
        clearAuth: () => clearAuthState(),
        logoutFromServer: async () => {
          const rt = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
          if (rt) {
            const currentUrl = getServerUrl();
            if (currentUrl) {
              await axios
                .post(`${currentUrl}/api/auth/logout`, { refreshToken: rt })
                .catch(() => {});
            }
          }
        },
      });
      toast.success(t('settings.saved'));
    } catch {
      // updateServerUrl 내부에서 redirectToLogin()을 호출하므로 여기까지 오지 않을 수 있다
    } finally {
      setSaving(false);
    }
  };

  /**
   * 뒤로 가기 — 이전 페이지로 돌아간다.
   */
  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <Card className="w-[480px]">
        <CardHeader>
          <CardTitle>{t('settings.title')}</CardTitle>
          <CardDescription>{t('settings.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 서버 URL 입력 */}
          <div className="space-y-2">
            <Label htmlFor="server-url">{t('settings.serverUrlLabel')}</Label>
            <Input
              id="server-url"
              type="url"
              placeholder={t('settings.serverUrlPlaceholder')}
              value={serverUrl}
              onChange={(e) => {
                setServerUrl(e.target.value);
                setTestResult(null);
              }}
            />
          </div>

          {/* 연결 테스트 */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !serverUrl.trim()}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('settings.testing')}
                </>
              ) : (
                t('settings.testConnection')
              )}
            </Button>
            <span role="status" aria-live="polite" className="text-sm">
              {testResult === true && (
                <span className="text-success">{t('settings.testSuccess')}</span>
              )}
              {testResult === false && <span className="text-destructive">{testError}</span>}
            </span>
          </div>

          {/* 저장 / 뒤로 가기 */}
          <div className="flex justify-end gap-2">
            {hasExistingUrl && (
              <Button variant="outline" onClick={handleBack}>
                {t('common.button.cancel')}
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving || !serverUrl.trim()}>
              {saving ? t('common.button.saving') : t('settings.save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
