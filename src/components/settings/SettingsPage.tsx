import { useState, useEffect } from 'react';
import { User, Lock, Shield, Bell, ChevronRight, Eye, EyeOff, Check, AlertCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { PasswordService } from '../../lib/security/password-service';
import type { User as UserType } from '../../lib/supabase/types';
import { useToast } from '../../contexts/ToastContext';

interface SettingsPageProps {
  user: UserType | null;
  onNavigate: (view: string) => void;
}

export function SettingsPage({ user, onNavigate }: SettingsPageProps) {
  const { confirm } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
      loadMFAStatus();
    }
  }, [user]);

  const loadMFAStatus = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors) {
        setMfaFactors(factors.all);
        setMfaEnrolled(factors.all.some(f => f.status === 'verified'));
      }
    } catch (error) {
      console.error('Error loading MFA status:', error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
        })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      setLoading(false);
      return;
    }

    const validation = PasswordService.validatePassword(passwordData.newPassword);
    if (!validation.isValid) {
      setMessage({ type: 'error', text: validation.errors.join('. ') });
      setLoading(false);
      return;
    }

    try {
      if (!user?.id) {
        throw new Error('User ID not found');
      }

      const result = await PasswordService.changePassword(
        user.id,
        passwordData.newPassword,
        'user_change'
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to change password');
      }

      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollMFA = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });

      if (error) throw error;

      if (data) {
        window.open(data.totp.uri, '_blank');
        setMessage({
          type: 'success',
          text: 'MFA enrollment initiated! Scan the QR code with your authenticator app and verify below.'
        });
        await loadMFAStatus();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to enroll MFA' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnenrollMFA = async (factorId: string) => {
    const confirmed = await confirm('Disable MFA', 'Are you sure you want to disable MFA? This will make your account less secure.');
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;

      setMessage({ type: 'success', text: 'MFA disabled successfully' });
      await loadMFAStatus();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to disable MFA' });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'security' as const, label: 'Security', icon: Lock },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 lg:pt-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm sm:text-base text-slate-600 mt-2">Manage your account settings and preferences</p>
      </div>

      {/* Quick Access Cards */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Settings: 2</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => onNavigate('my-sessions')}
            className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#015324]/10 rounded-lg flex items-center justify-center group-hover:bg-[#015324]/20 transition-colors">
                <Shield className="w-6 h-6 text-[#015324]" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-lg">My Sessions</h3>
                <p className="text-sm text-slate-600">View and manage your active sessions</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
            </div>
          </button>

          <button
            className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors relative">
                <Bell className="w-6 h-6 text-blue-600" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-lg">Notifications</h3>
                <p className="text-sm text-slate-600">Manage your notification preferences</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
            </div>
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm font-medium ${
            message.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <nav className="bg-white rounded-lg border border-slate-200 p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#015324] text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </button>
            ))}
          </nav>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            {activeTab === 'profile' && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-6">Profile Information</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileData.full_name}
                      onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      disabled
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                      placeholder="+1234567890"
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-6">Change Password</h2>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? 'text' : 'password'}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <div className="mt-2 bg-slate-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-700 mb-2">Password Requirements:</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {passwordData.newPassword.length >= 8 ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <X className="w-3 h-3 text-slate-300" />
                            )}
                            <span className={`text-xs ${passwordData.newPassword.length >= 8 ? 'text-emerald-600' : 'text-slate-500'}`}>
                              At least 8 characters
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/[A-Z]/.test(passwordData.newPassword) ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <X className="w-3 h-3 text-slate-300" />
                            )}
                            <span className={`text-xs ${/[A-Z]/.test(passwordData.newPassword) ? 'text-emerald-600' : 'text-slate-500'}`}>
                              At least one uppercase letter
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/[a-z]/.test(passwordData.newPassword) ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <X className="w-3 h-3 text-slate-300" />
                            )}
                            <span className={`text-xs ${/[a-z]/.test(passwordData.newPassword) ? 'text-emerald-600' : 'text-slate-500'}`}>
                              At least one lowercase letter
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/[0-9]/.test(passwordData.newPassword) ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <X className="w-3 h-3 text-slate-300" />
                            )}
                            <span className={`text-xs ${/[0-9]/.test(passwordData.newPassword) ? 'text-emerald-600' : 'text-slate-500'}`}>
                              At least one number
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword) ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <X className="w-3 h-3 text-slate-300" />
                            )}
                            <span className={`text-xs ${/[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword) ? 'text-emerald-600' : 'text-slate-500'}`}>
                              At least one special character (!@#$%^&*...)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? 'text' : 'password'}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Changing...' : 'Change Password'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="pt-8 border-t border-slate-200">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 mb-2">Multi-Factor Authentication</h2>
                      <p className="text-sm text-slate-600">
                        Add an extra layer of security to your account with authenticator apps like Google Authenticator or Authy.
                      </p>
                    </div>
                    <Shield className={`w-8 h-8 ${mfaEnrolled ? 'text-green-600' : 'text-slate-400'}`} />
                  </div>

                  {mfaEnrolled ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <p className="font-medium text-green-800">MFA is enabled</p>
                      </div>
                      <p className="text-sm text-green-700">Your account is protected with multi-factor authentication.</p>

                      <div className="mt-4 space-y-2">
                        {mfaFactors
                          .filter(f => f.status === 'verified')
                          .map((factor) => (
                            <div key={factor.id} className="flex items-center justify-between bg-white rounded p-3">
                              <div>
                                <p className="font-medium text-slate-800">Authenticator App</p>
                                <p className="text-xs text-slate-500">Created: {new Date(factor.created_at).toLocaleDateString()}</p>
                              </div>
                              <button
                                onClick={() => handleUnenrollMFA(factor.id)}
                                disabled={loading}
                                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                Disable
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-slate-600 mb-4">
                        MFA is not enabled on your account. Enable it now for better security.
                      </p>
                      <button
                        onClick={handleEnrollMFA}
                        disabled={loading}
                        className="px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Enrolling...' : 'Enable MFA'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-6">Notification Preferences</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-800">Email Notifications</p>
                      <p className="text-sm text-slate-600">Receive email updates about your account activity</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#015324]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#015324]"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-800">Security Alerts</p>
                      <p className="text-sm text-slate-600">Get notified about security-related activities</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#015324]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#015324]"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-800">Product Updates</p>
                      <p className="text-sm text-slate-600">Stay updated with new features and improvements</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#015324]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#015324]"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
