import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { SetupPage } from '@/pages/SetupPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { FDPage } from '@/pages/FDPage';
import { RDPage } from '@/pages/RDPage';
import { MutualFundsPage } from '@/pages/MutualFundsPage';
import { SharesPage } from '@/pages/SharesPage';
import { GoldPage } from '@/pages/GoldPage';
import { LoansPage } from '@/pages/LoansPage';
import { FixedAssetsPage } from '@/pages/FixedAssetsPage';
import { PensionPage } from '@/pages/PensionPage';
import { SavingsAccountsPage } from '@/pages/SavingsAccountsPage';
import { GoalsPage } from '@/pages/GoalsPage';
import { TaxPage } from '@/pages/TaxPage';
import { RecurringPage } from '@/pages/RecurringPage';
import { ImportPage } from '@/pages/ImportPage';
import { ExportPage } from '@/pages/ExportPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SnapshotsPage } from '@/pages/SnapshotsPage';
import { ExpensePage } from '@/pages/ExpensePage';
import { HelpPage } from '@/pages/HelpPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, needsSetup } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, needsSetup } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (user && !needsSetup) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/setup" element={<PublicRoute><SetupPage /></PublicRoute>} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="fd" element={<FDPage />} />
        <Route path="rd" element={<RDPage />} />
        <Route path="mutual-funds" element={<MutualFundsPage />} />
        <Route path="shares" element={<SharesPage />} />
        <Route path="gold" element={<GoldPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="expenses" element={<ExpensePage />} />
        <Route path="fixed-assets" element={<FixedAssetsPage />} />
        <Route path="pension" element={<PensionPage />} />
        <Route path="savings" element={<SavingsAccountsPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="tax" element={<TaxPage />} />
        <Route path="recurring" element={<RecurringPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="export" element={<ExportPage />} />
        <Route path="snapshots" element={<SnapshotsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
