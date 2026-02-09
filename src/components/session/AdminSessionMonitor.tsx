import { useEffect, useState } from 'react';
import {
  Monitor,
  Users,
  AlertTriangle,
  Shield,
  Clock,
  MapPin,
  Activity,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { SessionService } from '../../lib/session/session-service';
import { formatDistanceToNow } from '../../lib/utils/date-utils';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { SuccessNotification } from '../modals/SuccessNotification';

interface ActiveSessionInfo {
  session_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  device_name: string;
  ip_address: string;
  geolocation: any;
  login_at: string;
  last_activity_at: string;
  idle_minutes: number;
  is_trusted_device: boolean;
}

interface SessionStats {
  total_active: number;
  total_today: number;
  avg_duration: number;
  suspicious_count: number;
}

export function AdminSessionMonitor({ orgId }: { orgId?: string }) {
  const [activeSessions, setActiveSessions] = useState<ActiveSessionInfo[]>([]);
  const [stats, setStats] = useState<SessionStats>({
    total_active: 0,
    total_today: 0,
    avg_duration: 0,
    suspicious_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [filterIdle, setFilterIdle] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'all';
    sessionId?: string;
    userId?: string;
    userName?: string;
  }>({ isOpen: false, type: 'single' });
  const [successNotification, setSuccessNotification] = useState<{
    isOpen: boolean;
    message: string;
  }>({ isOpen: false, message: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [orgId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: sessions, error } = await supabase.rpc('get_active_sessions', {
        p_org_id: orgId || null,
        p_user_id: null
      });

      if (!error && sessions) {
        setActiveSessions(sessions);
        calculateStats(sessions);
      }
    } catch (error) {
      console.error('Error loading session data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (sessions: ActiveSessionInfo[]) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todaySessions = sessions.filter(
      s => new Date(s.login_at) >= todayStart
    );

    const suspiciousCount = sessions.filter(
      s => s.idle_minutes > 60 || !s.is_trusted_device
    ).length;

    setStats({
      total_active: sessions.length,
      total_today: todaySessions.length,
      avg_duration: 0,
      suspicious_count: suspiciousCount
    });
  };

  const handleTerminateSession = async (sessionId: string, userName: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'single',
      sessionId,
      userName
    });
  };

  const handleTerminateAllUserSessions = async (userId: string, userName: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'all',
      userId,
      userName
    });
  };

  const confirmTermination = async () => {
    setIsProcessing(true);
    try {
      if (confirmModal.type === 'single' && confirmModal.sessionId) {
        const success = await SessionService.terminateSession(
          confirmModal.sessionId,
          'admin_terminated'
        );
        if (success) {
          setSuccessNotification({
            isOpen: true,
            message: 'Session terminated successfully'
          });
          await loadData();
        }
      } else if (confirmModal.type === 'all' && confirmModal.userId) {
        const count = await SessionService.terminateAllSessions(confirmModal.userId);
        setSuccessNotification({
          isOpen: true,
          message: `Successfully terminated ${count} session(s)`
        });
        await loadData();
      }
    } finally {
      setIsProcessing(false);
      setConfirmModal({ isOpen: false, type: 'single' });
    }
  };

  const filteredSessions = filterIdle
    ? activeSessions.filter(s => s.idle_minutes > 30)
    : activeSessions;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-[#015324] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Session Monitoring</h1>
            <p className="text-slate-600 mt-1">Real-time monitoring of all active user sessions</p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-1">Active Sessions</p>
            <p className="text-3xl font-bold text-slate-900">{stats.total_active}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-1">Logins Today</p>
            <p className="text-3xl font-bold text-slate-900">{stats.total_today}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-1">Idle Sessions</p>
            <p className="text-3xl font-bold text-slate-900">
              {activeSessions.filter(s => s.idle_minutes > 30).length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-1">Suspicious</p>
            <p className="text-3xl font-bold text-slate-900">{stats.suspicious_count}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={filterIdle}
              onChange={(e) => setFilterIdle(e.target.checked)}
              className="rounded border-slate-300 text-[#015324] focus:ring-[#015324]"
            />
            Show only idle sessions (30+ minutes)
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {filteredSessions.map((session) => (
          <div
            key={session.session_id}
            className={`bg-white rounded-xl shadow-sm border-2 p-5 ${
              session.idle_minutes > 60
                ? 'border-amber-200'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className={`p-3 rounded-lg ${
                  session.idle_minutes > 60 ? 'bg-amber-100' : 'bg-blue-100'
                }`}>
                  <Monitor className={`w-6 h-6 ${
                    session.idle_minutes > 60 ? 'text-amber-600' : 'text-blue-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-slate-900">{session.user_name}</h3>
                    <span className="text-sm text-slate-500">({session.user_email})</span>
                    {session.is_trusted_device && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">
                        <Shield className="w-3 h-3" />
                        Trusted
                      </span>
                    )}
                    {session.idle_minutes > 60 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Idle {session.idle_minutes}m
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      <span>{session.device_name || 'Unknown Device'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{session.ip_address}</span>
                      {session.geolocation?.city && (
                        <span>• {session.geolocation.city}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Logged in {formatDistanceToNow(session.login_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      <span>Last active {formatDistanceToNow(session.last_activity_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleTerminateSession(session.session_id, session.user_name)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-1"
                  title="End this session"
                >
                  <XCircle className="w-4 h-4" />
                  End Session
                </button>
                <button
                  onClick={() => handleTerminateAllUserSessions(session.user_id, session.user_name)}
                  className="px-3 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors text-sm font-medium"
                  title="End all sessions for this user"
                >
                  End All
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredSessions.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Monitor className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">
              {filterIdle ? 'No idle sessions found' : 'No active sessions'}
            </p>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: 'single' })}
        onConfirm={confirmTermination}
        title={
          confirmModal.type === 'single'
            ? 'End Session'
            : 'End All Sessions'
        }
        message={
          confirmModal.type === 'single'
            ? `Are you sure you want to end this session for ${confirmModal.userName}? The user will be immediately logged out.`
            : `Are you sure you want to end all active sessions for ${confirmModal.userName}? The user will be logged out from all devices.`
        }
        confirmText={
          confirmModal.type === 'single'
            ? 'End Session'
            : 'End All Sessions'
        }
        type="danger"
        isLoading={isProcessing}
      />

      <SuccessNotification
        isOpen={successNotification.isOpen}
        onClose={() => setSuccessNotification({ isOpen: false, message: '' })}
        message={successNotification.message}
      />
    </div>
  );
}
