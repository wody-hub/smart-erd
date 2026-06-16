import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { isElectron, getServerUrl } from '@/lib/platform';
import AuthenticatedAiChatShell from './components/ai/AuthenticatedAiChatShell';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import Spinner from './components/ui/spinner';
import { ROUTES } from '@/constants/routes';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const GuidePage = lazy(() => import('./pages/guide/GuidePage'));
const TeamsPage = lazy(() => import('./pages/team/TeamsPage'));
const ProjectsPage = lazy(() => import('./pages/project/ProjectsPage'));
const ProjectWbsPage = lazy(() => import('./pages/project/ProjectWbsPage'));
const DiagramsPage = lazy(() => import('./pages/diagram/DiagramsPage'));
const DocumentEditorRoute = lazy(() => import('./pages/document/DocumentEditorRoute'));
const DictionaryPage = lazy(() => import('./pages/dictionary/DictionaryPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));

/** Electron에서는 HashRouter, 웹에서는 BrowserRouter를 사용한다. */
const Router = isElectron() ? HashRouter : BrowserRouter;

/** Electron 환경 여부 (렌더링 분기용 캐시) */
const isElectronEnv = isElectron();

function protectedAppElement(children: ReactNode) {
  return (
    <ProtectedRoute>
      <AuthenticatedAiChatShell>{children}</AuthenticatedAiChatShell>
    </ProtectedRoute>
  );
}

/**
 * 애플리케이션 루트 컴포넌트.
 *
 * Electron에서는 HashRouter, 웹에서는 BrowserRouter로 SPA 라우팅을 구성하고,
 * 인증이 필요한 경로에 ProtectedRoute 가드를 적용한다.
 * Electron에서 서버 URL 미설정 시 Settings 페이지만 표시한다.
 */
export default function App() {
  /** Electron에서 서버 URL 미설정 여부 (렌더링마다 재평가) */
  const needsServerSetup = isElectronEnv && !getServerUrl();

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router>
        <Suspense
          fallback={
            <div className="h-screen flex items-center justify-center">
              <Spinner />
            </div>
          }
        >
          {needsServerSetup ? (
            <Routes>
              <Route path={ROUTES.GUIDE} element={<GuidePage />} />
              <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
              <Route path="*" element={<Navigate to={ROUTES.SETTINGS} replace />} />
            </Routes>
          ) : (
            <Routes>
              {/* ── Electron 전용 ── */}
              {isElectronEnv && <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />}

              {/* ── 공개 라우트 ── */}
              <Route path={ROUTES.GUIDE} element={<GuidePage />} />
              <Route path={ROUTES.LOGIN} element={<LoginPage />} />
              <Route path={ROUTES.SIGNUP} element={<SignupPage />} />

              {/* ── 인증 필요 라우트 ── */}
              <Route path={ROUTES.TEAMS} element={protectedAppElement(<TeamsPage />)} />
              <Route
                path={ROUTES.PROJECTS_PATTERN}
                element={protectedAppElement(<ProjectsPage />)}
              />
              <Route
                path={ROUTES.DICTIONARY_PATTERN}
                element={protectedAppElement(<DictionaryPage />)}
              />
              <Route
                path={ROUTES.DIAGRAMS_PATTERN}
                element={protectedAppElement(<DiagramsPage />)}
              />
              <Route
                path={ROUTES.PROJECT_WBS_PATTERN}
                element={protectedAppElement(<ProjectWbsPage />)}
              />
              <Route
                path={ROUTES.DIAGRAM_PATTERN}
                element={protectedAppElement(<DocumentEditorRoute />)}
              />
              <Route path="/" element={<Navigate to={ROUTES.TEAMS} replace />} />
              <Route path="*" element={<Navigate to={ROUTES.TEAMS} replace />} />
            </Routes>
          )}
        </Suspense>
      </Router>
    </QueryClientProvider>
  );
}
