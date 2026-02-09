import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, AlertTriangle, Check, X, Shield } from 'lucide-react';
import { PasswordService } from '../../lib/security/password-service';

interface ForcePasswordChangeModalProps {
  userId: string;
  reason: 'first_login' | 'expired' | 'admin_forced';
  onPasswordChanged: () => void;
  onLogout: () => void;
}

export function ForcePasswordChangeModal({
  userId,
  reason,
  onPasswordChanged,
  onLogout,
}: ForcePasswordChangeModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    label: string;
    color: string;
  } | null>(null);

  useEffect(() => {
    if (newPassword) {
      const strength = PasswordService.getPasswordStrength(newPassword);
      setPasswordStrength(strength);

      const validation = PasswordService.validatePassword(newPassword);
      setValidationErrors(validation.errors);
    } else {
      setPasswordStrength(null);
      setValidationErrors([]);
    }
  }, [newPassword]);

  const getReasonTitle = () => {
    switch (reason) {
      case 'first_login':
        return 'Welcome! Please Set Your Password';
      case 'expired':
        return 'Your Password Has Expired';
      case 'admin_forced':
        return 'Password Change Required';
      default:
        return 'Change Your Password';
    }
  };

  const getReasonDescription = () => {
    switch (reason) {
      case 'first_login':
        return 'For security purposes, you must create a new password before accessing the system.';
      case 'expired':
        return 'Your password has expired after 90 days. Please create a new password to continue.';
      case 'admin_forced':
        return 'An administrator has requested that you change your password.';
      default:
        return 'Please enter a new password.';
    }
  };

  const requirements = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'Contains letters', met: /[a-zA-Z]/.test(newPassword) },
    { label: 'Contains numbers', met: /[0-9]/.test(newPassword) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const validation = PasswordService.validatePassword(newPassword);
    if (!validation.isValid) {
      setError(validation.errors.join('. '));
      return;
    }

    setLoading(true);

    try {
      const changeReason = reason === 'first_login' ? 'forced_change' : reason === 'expired' ? 'expiry' : 'forced_change';
      const result = await PasswordService.changePassword(userId, newPassword, changeReason);

      if (!result.success) {
        setError(result.error || 'Failed to change password');
        return;
      }

      onPasswordChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{getReasonTitle()}</h2>
          <p className="text-white/80 text-sm">{getReasonDescription()}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                placeholder="Enter new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {passwordStrength && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">Password strength</span>
                  <span className="text-xs font-medium" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label.charAt(0).toUpperCase() + passwordStrength.label.slice(1)}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(passwordStrength.score / 7) * 100}%`,
                      backgroundColor: passwordStrength.color,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
            )}
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-700 mb-3">Password Requirements:</p>
            <div className="space-y-2">
              {requirements.map((req, index) => (
                <div key={index} className="flex items-center gap-2">
                  {req.met ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <X className="w-4 h-4 text-slate-300" />
                  )}
                  <span className={`text-xs ${req.met ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-colors"
            >
              Logout
            </button>
            <button
              type="submit"
              disabled={loading || validationErrors.length > 0 || newPassword !== confirmPassword}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
