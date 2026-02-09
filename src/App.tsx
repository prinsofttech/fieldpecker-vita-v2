import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase/client';
import { LoginForm } from './components/auth/LoginForm';
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm';
import { ForcePasswordChangeModal } from './components/auth/ForcePasswordChangeModal';
import { Dashboard } from './components/dashboard/Dashboard';
import { SuperAdminDashboard } from './components/dashboard/SuperAdminDashboard';

type AuthView = 'login' | 'forgot-password' | 'reset-password';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState<{
    userId: string;
    reason: 'first_login' | 'expired' | 'admin_forced';
  } | null>(null);

  useEffect(() => {
    console.log('[APP] ══════════════════════════════════════');
    console.log('[APP] App component mounting / useEffect running');
    console.log('[APP] Timestamp:', new Date().toISOString());
    console.log('[APP] ══════════════════════════════════════');

    const checkUserRole = async (session: any) => {
      console.log('[APP] checkUserRole called');
      if (session) {
        const role = session.user?.app_metadata?.role;
        console.log('[APP] Session exists, role:', role);
        console.log('[APP] User ID:', session.user?.id);
        console.log('[APP] User email:', session.user?.email);
        setIsSuperAdmin(role === 'super_admin');
      } else {
        console.log('[APP] No session, setting super_admin to false');
        setIsSuperAdmin(false);
      }
    };

    console.log('[APP] Getting initial session...');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[APP] Initial session loaded:', !!session);
      if (session) {
        console.log('[APP] Session details:', {
          user_id: session.user?.id,
          email: session.user?.email,
          expires_at: session.expires_at
        });
      }
      setIsAuthenticated(!!session);
      checkUserRole(session);
    });

    console.log('[APP] Setting up auth state change listener...');
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[APP] ═══════════════════════════════════════════');
      console.log('[APP] 🔔 AUTH STATE CHANGED');
      console.log('[APP] Event:', event);
      console.log('[APP] Timestamp:', new Date().toISOString());
      console.log('[APP] Has session:', !!session);
      if (session) {
        console.log('[APP] Session user:', session.user?.id, session.user?.email);
      }
      console.log('[APP] ═══════════════════════════════════════════');

      setIsAuthenticated(!!session);
      checkUserRole(session);

      if (event === 'PASSWORD_RECOVERY') {
        console.log('[APP] Password recovery event detected');
        setIsResettingPassword(true);
        setAuthView('reset-password');
      }

      if (event === 'SIGNED_OUT') {
        console.log('[APP] ❌ SIGNED_OUT event - User was logged out');
        console.log('[APP] Stack trace:', new Error().stack);
      }

      if (event === 'SIGNED_IN') {
        console.log('[APP] ✅ SIGNED_IN event - User logged in');
      }

      if (event === 'TOKEN_REFRESHED') {
        console.log('[APP] 🔄 TOKEN_REFRESHED event');
      }

      if (event === 'USER_UPDATED') {
        console.log('[APP] 👤 USER_UPDATED event');
      }
    });

    console.log('[APP] Auth listener subscribed');

    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      console.log('[APP] Recovery hash detected in URL');
      setIsResettingPassword(true);
      setAuthView('reset-password');
    }

    return () => {
      console.log('[APP] Unsubscribing from auth listener');
      subscription.unsubscribe();
    };
  }, []);

  const handleResetSuccess = () => {
    setIsResettingPassword(false);
    setAuthView('login');
    setIsAuthenticated(false);
  };

  const handlePasswordChangeRequired = (userId: string, reason: 'first_login' | 'expired' | 'admin_forced') => {
    console.log('[APP] Password change required:', { userId, reason });
    setPasswordChangeRequired({ userId, reason });
  };

  const handlePasswordChanged = async () => {
    console.log('[APP] Password changed successfully, reloading session...');
    setPasswordChangeRequired(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsAuthenticated(true);
      const role = session.user?.app_metadata?.role;
      setIsSuperAdmin(role === 'super_admin');
    }
  };

  const handlePasswordChangeLogout = async () => {
    console.log('[APP] User chose to logout from password change modal');
    setPasswordChangeRequired(null);
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  console.log('[APP] Render - Auth state:', {
    isAuthenticated,
    isSuperAdmin,
    authView,
    isResettingPassword
  });

  if (isAuthenticated === null) {
    console.log('[APP] Rendering loading spinner (isAuthenticated=null)');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isResettingPassword || authView === 'reset-password') {
    console.log('[APP] Rendering ResetPasswordForm');
    return <ResetPasswordForm onSuccess={handleResetSuccess} />;
  }

  if (passwordChangeRequired) {
    console.log('[APP] Rendering ForcePasswordChangeModal');
    return (
      <ForcePasswordChangeModal
        userId={passwordChangeRequired.userId}
        reason={passwordChangeRequired.reason}
        onPasswordChanged={handlePasswordChanged}
        onLogout={handlePasswordChangeLogout}
      />
    );
  }

  if (!isAuthenticated) {
    console.log('[APP] Not authenticated, authView:', authView);
    if (authView === 'forgot-password') {
      console.log('[APP] Rendering ForgotPasswordForm');
      return <ForgotPasswordForm onBackToLogin={() => setAuthView('login')} />;
    }
    console.log('[APP] Rendering LoginForm');
    return (
      <LoginForm
        onForgotPassword={() => setAuthView('forgot-password')}
        onPasswordChangeRequired={handlePasswordChangeRequired}
      />
    );
  }

  console.log('[APP] Authenticated, rendering dashboard. isSuperAdmin:', isSuperAdmin);
  return isSuperAdmin ? <SuperAdminDashboard /> : <Dashboard />;
}

export default App;
