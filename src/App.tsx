import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { ClientDashboard } from '@/pages/ClientDashboard';
import { EmployeeDashboard } from '@/pages/EmployeeDashboard';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (!session || !profile) {
    return <LoginPage />;
  }

  if (!profile.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-md">
          <p className="text-lg font-bold text-slate-800 mb-2">حسابك غير مفعل حاليًا.</p>
          <p className="text-sm text-slate-500">يرجى التواصل مع الإدارة لتفعيل الحساب.</p>
        </div>
      </div>
    );
  }

  switch (profile.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'employee':
      return <EmployeeDashboard />;
    case 'client':
      return <ClientDashboard />;
    default:
      return <ClientDashboard />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
