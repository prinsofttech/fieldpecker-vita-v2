import { useState } from 'react';
import { AlertCircle, Eye, EyeOff, AlertTriangle, Lock } from 'lucide-react';
import { AuthService } from '../../lib/auth/auth-service';

interface LoginFormProps {
  onForgotPassword?: () => void;
  onPasswordChangeRequired?: (userId: string, reason: 'first_login' | 'expired' | 'admin_forced') => void;
}

export function LoginForm({ onForgotPassword, onPasswordChangeRequired }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockedUntil && new Date(lockedUntil) > new Date()) {
      setError('Account is locked. Please wait before trying again.');
      return;
    }

    if (remainingAttempts === 0) {
      setError('Account is locked due to too many failed login attempts.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await AuthService.signIn({
        email,
        password,
        device_id: localStorage.getItem('device_id') || undefined,
      });

      if (!result.success) {
        setError(result.error || 'Login failed');

        if (result.remaining_attempts !== undefined) {
          setRemainingAttempts(result.remaining_attempts);
        }

        if (result.locked_until) {
          setLockedUntil(result.locked_until);
        } else if (result.remaining_attempts === 0) {
          setLockedUntil(new Date(Date.now() + (result.lockout_duration_minutes ?? 15) * 60 * 1000).toISOString());
        }
      } else if (result.user) {
        if (result.must_change_password && onPasswordChangeRequired) {
          onPasswordChangeRequired(result.user.id, 'first_login');
          return;
        }
        if (result.password_expired && onPasswordChangeRequired) {
          onPasswordChangeRequired(result.user.id, 'expired');
          return;
        }
        window.location.href = '/dashboard';
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatLockedUntil = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9C609] px-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-[#015324] mb-2">
              Welcome, Karibu!
            </h1>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Sign In here
            </h2>
            <p className="text-slate-500 mb-6">
              Let's get started by filling out the form below.
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="w-full">
                  <p className="text-sm font-semibold text-red-800">{error}</p>
                  {remainingAttempts !== null && remainingAttempts > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining before account lockout
                    </p>
                  )}
                  {remainingAttempts === 0 && (
                    <p className="text-xs font-bold text-red-700 mt-1 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Account locked. No more login attempts allowed.
                    </p>
                  )}
                  {lockedUntil && (
                    <p className="text-xs text-red-700 mt-1 font-medium">
                      Locked until {formatLockedUntil(lockedUntil)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {remainingAttempts !== null && remainingAttempts <= 2 && remainingAttempts > 0 && !error && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Warning: Only {remainingAttempts} login attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-[#015324] transition-all text-slate-800 placeholder:text-slate-400"
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 pr-12 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-[#015324] transition-all text-slate-800 placeholder:text-slate-400"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (lockedUntil !== null && new Date(lockedUntil) > new Date())}
                className="w-full bg-[#015324] hover:bg-[#014a20] text-white font-bold py-4 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-[#015324] hover:text-[#014a20] font-medium transition-colors"
              >
                Forgot your password?
              </button>
            </div>
          </div>

          <div className="mt-8 text-center space-y-1">
            <p className="text-sm text-[#015324]">A product of Pebuu Global Inc.</p>
            <p className="text-xs text-[#015324]/70">2025 (C) Copyright</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-center">
          <div className="text-center">
            <img
              src="/login-image.png"
              alt="Field Pecker Logo"
              className="w-full max-w-lg h-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
