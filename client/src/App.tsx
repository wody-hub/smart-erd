import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import TeamsPage from './pages/team/TeamsPage';
import ProjectsPage from './pages/project/ProjectsPage';
import DiagramsPage from './pages/diagram/DiagramsPage';
import DiagramPage from './pages/diagram/DiagramPage';
import DictionaryPage from './pages/dictionary/DictionaryPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import { ROUTES } from '@/constants/routes';

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
      </BrowserRouter>
    </QueryClientProvider>
  );
}
