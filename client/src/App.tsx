import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import Spinner from './components/ui/spinner';
import { ROUTES } from '@/constants/routes';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const TeamsPage = lazy(() => import('./pages/team/TeamsPage'));
const ProjectsPage = lazy(() => import('./pages/project/ProjectsPage'));
const DiagramsPage = lazy(() => import('./pages/diagram/DiagramsPage'));
const DiagramPage = lazy(() => import('./pages/diagram/DiagramPage'));
const DictionaryPage = lazy(() => import('./pages/dictionary/DictionaryPage'));

/**
 * 애플리케이션 루트 컴포넌트.
 *
 * BrowserRouter로 SPA 라우팅을 구성하고,
 * 인증이 필요한 경로에 ProtectedRoute 가드를 적용한다.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="h-screen flex items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <Routes>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.SIGNUP} element={<SignupPage />} />
            <Route
              path={ROUTES.TEAMS}
              element={
                <ProtectedRoute>
                  <TeamsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.PROJECTS_PATTERN}
              element={
                <ProtectedRoute>
                  <ProjectsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.DICTIONARY_PATTERN}
              element={
                <ProtectedRoute>
                  <DictionaryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.DIAGRAMS_PATTERN}
              element={
                <ProtectedRoute>
                  <DiagramsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.DIAGRAM_PATTERN}
              element={
                <ProtectedRoute>
                  <DiagramPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to={ROUTES.TEAMS} replace />} />
            <Route path="*" element={<Navigate to={ROUTES.TEAMS} replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
