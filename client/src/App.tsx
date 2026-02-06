import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import TeamsPage from './pages/TeamsPage';
import ProjectsPage from './pages/ProjectsPage';
import DiagramPage from './pages/DiagramPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

/**
 * 애플리케이션 루트 컴포넌트.
 *
 * BrowserRouter로 SPA 라우팅을 구성하고,
 * 인증이 필요한 경로에 ProtectedRoute 가드를 적용한다.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/teams"
          element={
            <ProtectedRoute>
              <TeamsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams/:teamId/projects"
          element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams/:teamId/projects/:projectId/diagrams/:diagramId"
          element={
            <ProtectedRoute>
              <DiagramPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/teams" replace />} />
        <Route path="*" element={<Navigate to="/teams" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
