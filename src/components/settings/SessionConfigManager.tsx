import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client';
import {
  Clock,
  Shield,
  Monitor,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Timer,
  Users,
  Laptop,
  MapPin,
  Lock,
  Info,
} from 'lucide-react';

interface SessionConfig {
  id?: string;
  org_id: string;
  idle_timeout_minutes: number;
  absolute_timeout_hours: number;
  max_concurrent_sessions: number;
  require_mfa: boolean;
  allow_multiple_devices: boolean;
  enable_geolocation_tracking: boolean;
  suspicious_login_notifications: boolean;
  auto_lock_after_failed_attempts: number;
  lockout_duration_minutes: number;
}

const DEFAULT_CONFIG: Omit<SessionConfig, 'org_id'> = {
  idle_timeout_minutes: 30,
  absolute_timeout_hours: 12,
  max_concurrent_sessions: 3,
  require_mfa: false,
  allow_multiple_devices: true,
  enable_geolocation_tracking: true,
  suspicious_login_notifications: true,
  auto_lock_after_failed_attempts: 5,
  lockout_duration_minutes: 15,
};

const IDLE_TIMEOUT_PRESETS = [
  { label: '5 min', value: 5, description: 'Very strict' },
  { label: '10 min', value: 10, description: 'Strict' },
  { label: '15 min', value: 15, description: 'Moderate' },
  { label: '30 min', value: 30, description: 'Standard' },
  { label: '60 min', value: 60, description: 'Relaxed' },
  { label: '120 min', value: 120, description: 'Extended' },
];

interface SessionConfigManagerProps {
  orgId: string;
}

export function SessionConfigManager({ orgId }: SessionConfigManagerProps) {
  const [config, setConfig] = useState<SessionConfig>({ ...DEFAULT_CONFIG, org_id: orgId });
  const [originalConfig, setOriginalConfig] = useState<SessionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [orgId]);

  useEffect(() => {
    if (originalConfig) {
      const changed = JSON.stringify(config) !== JSON.stringify(originalConfig);
      setHasChanges(changed);
    }
  }, [config, originalConfig]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('session_config')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setConfig(data);
        setOriginalConfig(data);
      } else {
        const defaultWithOrg = { ...DEFAULT_CONFIG, org_id: orgId };
        setConfig(defaultWithOrg);
        setOriginalConfig(defaultWithOrg);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load session configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      if (config.id) {
        const { error: updateError } = await supabase
          .from('session_config')
          .update({
            idle_timeout_minutes: config.idle_timeout_minutes,
            absolute_timeout_hours: config.absolute_timeout_hours,
            max_concurrent_sessions: config.max_concurrent_sessions,
            require_mfa: config.require_mfa,
            allow_multiple_devices: config.allow_multiple_devices,
            enable_geolocation_tracking: config.enable_geolocation_tracking,
            suspicious_login_notifications: config.suspicious_login_notifications,
            auto_lock_after_failed_attempts: config.auto_lock_after_failed_attempts,
            lockout_duration_minutes: config.lockout_duration_minutes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);

        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('session_config')
          .insert({
            org_id: orgId,
            idle_timeout_minutes: config.idle_timeout_minutes,
            absolute_timeout_hours: config.absolute_timeout_hours,
            max_concurrent_sessions: config.max_concurrent_sessions,
            require_mfa: config.require_mfa,
            allow_multiple_devices: config.allow_multiple_devices,
            enable_geolocation_tracking: config.enable_geolocation_tracking,
            suspicious_login_notifications: config.suspicious_login_notifications,
            auto_lock_after_failed_attempts: config.auto_lock_after_failed_attempts,
            lockout_duration_minutes: config.lockout_duration_minutes,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (inserted) {
          setConfig(inserted);
        }
      }

      setOriginalConfig({ ...config });
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save session configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (originalConfig) {
      setConfig({ ...originalConfig });
    }
  };

  const updateField = <K extends keyof SessionConfig>(field: K, value: SessionConfig[K]) => {
    setConfig(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'allow_multiple_devices' && value === false) {
        next.max_concurrent_sessions = 1;
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12">
          <div className="flex items-center justify-center gap-3">
            <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            <span className="text-slate-500">Loading session configuration...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Session & Security</h1>
            <p className="text-slate-600 mt-1">Configure idle timeout, session limits, and security policies</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Discard
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
              hasChanges
                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700">Configuration saved. Changes will apply to new sessions.</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Timer className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Idle Timeout</h2>
              <p className="text-sm text-slate-600">Auto-logout users after a period of inactivity</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-start gap-4 p-4 bg-blue-50/60 rounded-xl border border-blue-100">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700 leading-relaxed">
              Users will be automatically logged out if they are inactive for this duration.
              Activity is tracked through mouse movement, keyboard input, and clicks.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Quick Presets</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {IDLE_TIMEOUT_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => updateField('idle_timeout_minutes', preset.value)}
                  className={`relative flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200 ${
                    config.idle_timeout_minutes === preset.value
                      ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <span className="text-lg font-bold">{preset.label}</span>
                  <span className={`text-xs mt-0.5 ${
                    config.idle_timeout_minutes === preset.value ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Custom Value (minutes)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={240}
                value={config.idle_timeout_minutes}
                onChange={(e) => updateField('idle_timeout_minutes', parseInt(e.target.value))}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={config.idle_timeout_minutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= 1440) updateField('idle_timeout_minutes', val);
                  }}
                  className="w-20 px-3 py-2 text-center text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
                />
                <span className="text-sm text-slate-500 font-medium">min</span>
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1 px-1">
              <span>1 min</span>
              <span>4 hours</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Clock className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Session Limits</h2>
              <p className="text-sm text-slate-600">Control session duration and concurrency</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Absolute Session Timeout
              </label>
              <p className="text-xs text-slate-500 mb-3">Maximum session length regardless of activity</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={config.absolute_timeout_hours}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= 72) updateField('absolute_timeout_hours', val);
                  }}
                  className="w-20 px-3 py-2.5 text-center text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
                />
                <span className="text-sm text-slate-500 font-medium">hours</span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Users className="w-4 h-4 text-slate-500" />
                Max Concurrent Sessions
              </label>
              <p className="text-xs text-slate-500 mb-3">
                {!config.allow_multiple_devices
                  ? 'Locked to 1 because multiple devices is disabled'
                  : 'Number of simultaneous logins per user'}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={config.max_concurrent_sessions}
                  disabled={!config.allow_multiple_devices}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= 10) updateField('max_concurrent_sessions', val);
                  }}
                  className={`w-20 px-3 py-2.5 text-center text-sm font-semibold border rounded-xl outline-none ${
                    !config.allow_multiple_devices
                      ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-slate-900'
                  }`}
                />
                <span className="text-sm text-slate-500 font-medium">sessions</span>
                {!config.allow_multiple_devices && (
                  <Lock className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Lock className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Login Security</h2>
              <p className="text-sm text-slate-600">Brute-force protection and lockout policy</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <AlertTriangle className="w-4 h-4 text-slate-500" />
                Lock After Failed Attempts
              </label>
              <p className="text-xs text-slate-500 mb-3">Auto-lock account after consecutive failures</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={3}
                  max={20}
                  value={config.auto_lock_after_failed_attempts}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 3 && val <= 20) updateField('auto_lock_after_failed_attempts', val);
                  }}
                  className="w-20 px-3 py-2.5 text-center text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
                />
                <span className="text-sm text-slate-500 font-medium">attempts</span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Timer className="w-4 h-4 text-slate-500" />
                Lockout Duration
              </label>
              <p className="text-xs text-slate-500 mb-3">How long the account stays locked</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={config.lockout_duration_minutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= 1440) updateField('lockout_duration_minutes', val);
                  }}
                  className="w-20 px-3 py-2.5 text-center text-sm font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
                />
                <span className="text-sm text-slate-500 font-medium">minutes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Monitor className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Tracking & Notifications</h2>
              <p className="text-sm text-slate-600">Device tracking and alert preferences</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <ToggleRow
            icon={<Laptop className="w-4 h-4 text-slate-500" />}
            label="Allow Multiple Devices"
            description="Users can be logged in from multiple devices at once"
            checked={config.allow_multiple_devices}
            onChange={(val) => updateField('allow_multiple_devices', val)}
          />
          <ToggleRow
            icon={<MapPin className="w-4 h-4 text-slate-500" />}
            label="Geolocation Tracking"
            description="Track approximate location of login sessions"
            checked={config.enable_geolocation_tracking}
            onChange={(val) => updateField('enable_geolocation_tracking', val)}
          />
          <ToggleRow
            icon={<AlertTriangle className="w-4 h-4 text-slate-500" />}
            label="Suspicious Login Alerts"
            description="Notify admins of logins from new devices or locations"
            checked={config.suspicious_login_notifications}
            onChange={(val) => updateField('suspicious_login_notifications', val)}
          />
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24" />
        <div className="relative flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-xl">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2">How Idle Timeout Works</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              The system tracks user activity (mouse, keyboard, clicks). When no activity is detected
              for the configured idle period, the user's session is automatically terminated and they
              are redirected to the login page. Changes apply to new sessions only -- existing sessions
              will use the settings that were active when they started.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <span className="text-sm font-semibold text-slate-700">{label}</span>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
          checked ? 'bg-slate-900' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
