import { Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./components/dashboard/Dashboard";
import { SettingsPage } from "./components/settings/SettingsPage";
import { AdminPage } from "./components/admin/AdminPage";
import { LoginPage } from "./components/auth/LoginPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Spinner } from "./components/ui/Spinner";

function AppContent() {
  const { user, loading, authRequired } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth is required (server mode with SQLite) and user is not logged in
  if (authRequired && !user) {
    return <LoginPage />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
