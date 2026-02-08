import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './components/auth/LoginPage';
import DashboardView from './components/dashboard/DashboardView';
import InboxView from './components/inbox/InboxView';
import TicketDetailView from './components/tickets/TicketDetailView';
import TemplateLibraryView from './components/templates/TemplateLibraryView';
import KnowledgeBaseManager from './components/knowledge/KnowledgeBaseManager';
import AdminView from './components/admin/AdminView';
import ReportsView from './components/reports/ReportsView';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { useMailboxSync } from './hooks/useMailboxSync';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();
  if (loading) return <LoadingSpinner message="Chargement..." />;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();
  if (loading) return <LoadingSpinner message="Chargement..." />;
  if (authenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  useMailboxSync();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AuthRoute>
            <LoginPage />
          </AuthRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardView />} />
        <Route path="inbox" element={<InboxView />} />
        <Route path="inbox/:id" element={<TicketDetailView />} />
        <Route path="templates" element={<TemplateLibraryView />} />
        <Route path="knowledge" element={<KnowledgeBaseManager />} />
        <Route path="reports" element={<ReportsView />} />
        <Route path="admin" element={<AdminView />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
