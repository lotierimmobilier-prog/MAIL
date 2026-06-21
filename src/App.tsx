import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './components/auth/LoginPage';
import GmailCallbackPage from './components/auth/GmailCallbackPage';
import DashboardView from './components/dashboard/DashboardView';
import InboxView from './components/inbox/InboxView';
import TicketDetailView from './components/tickets/TicketDetailView';
import TemplateLibraryView from './components/templates/TemplateLibraryView';
import KnowledgeBaseManager from './components/knowledge/KnowledgeBaseManager';
import AdminView from './components/admin/AdminView';
import ReportsView from './components/reports/ReportsView';
import ContactsView from './components/contacts/ContactsView';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { useMailboxSync } from './hooks/useMailboxSync';
import type { ReactNode } from 'react';
import type { ViewPermission } from './lib/types';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();
  if (loading) return <LoadingSpinner message="Chargement..." />;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ViewGuard({ view, children }: { view: ViewPermission; children: ReactNode }) {
  const { hasView, loading } = useAuth();
  if (loading) return <LoadingSpinner message="Chargement..." />;
  if (!hasView(view)) return <Navigate to="/" replace />;
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
        <Route index element={<ViewGuard view="dashboard"><DashboardView /></ViewGuard>} />
        <Route path="inbox" element={<ViewGuard view="inbox"><InboxView /></ViewGuard>} />
        <Route path="inbox/:id" element={<ViewGuard view="inbox"><TicketDetailView /></ViewGuard>} />
        <Route path="contacts" element={<ViewGuard view="contacts"><ContactsView /></ViewGuard>} />
        <Route path="templates" element={<ViewGuard view="templates"><TemplateLibraryView /></ViewGuard>} />
        <Route path="knowledge" element={<ViewGuard view="knowledge"><KnowledgeBaseManager /></ViewGuard>} />
        <Route path="reports" element={<ViewGuard view="reports"><ReportsView /></ViewGuard>} />
        <Route path="admin" element={<ViewGuard view="admin"><AdminView /></ViewGuard>} />
      </Route>
      <Route path="/gmail-callback" element={<GmailCallbackPage />} />
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
