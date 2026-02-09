import { useEffect, useState } from 'react';
import {
  Monitor,
  Smartphone,
  Clock,
  MapPin,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  RefreshCw
} from 'lucide-react';
import { SessionService, SessionData, SecurityEvent } from '../../lib/session/session-service';
import { formatDistanceToNow } from '../../lib/utils/date-utils';
import { supabase } from '../../lib/supabase/client';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { SuccessNotification } from '../modals/SuccessNotification';

interface SessionHistoryDashboardProps {
  userId: string;
}

export function SessionHistoryDashboard({ userId }: SessionHistoryDashboardProps) {
  const [activeSessions, setActiveSessions] = useState<SessionData[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionData[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'security'>('active');
  const [currentSessionToken, setCurrentSessionToken] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'all';
    sessionId?: string;
    isOwnSession?: boolean;
  }>({ isOpen: false, type: 'single' });
  const [successNotification, setSuccessNotification] = useState<{
    isOpen: boolean;
    message: string;
  }>({ isOpen: false, message: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadData();
    getCurrentSessionToken();
  }, [userId]);

  const getCurrentSessionToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setCurrentSessionToken(session?.access_token || null);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [active, history, events] = await Promise.all([
        SessionService.getActiveSessions(userId),
        SessionService.getSessionHistory(userId),
        SessionService.getSecurityEvents(userId)
      ]);
      setActiveSessions(active);
      setSessionHistory(history);
      setSecurityEvents(events);
    } catch (error) {
      console.error('Error loading session data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    // Get current session to check if terminating own session
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    // Find the session we're about to terminate
    const targetSession = activeSessions.find(s => s.id === sessionId);
    const isOwnSession = targetSession?.session_token === currentSession?.access_token;

    setConfirmModal({
      isOpen: true,
      type: 'single',
      sessionId,
      isOwnSession
    });
  };

  const handleTerminateAllSessions = async () => {
    setConfirmModal({
      isOpen: true,
      type: 'all'
    });
  };

  const confirmTermination = async () => {
    setIsProcessing(true);
    try {
      if (confirmModal.type === 'single' && confirmModal.sessionId) {
        const success = await SessionService.terminateSession(confirmModal.sessionId);
        if (success) {
          if (confirmModal.isOwnSession) {
            // Terminated own session - log out immediately
            await supabase.auth.signOut();
            window.location.href = '/';
          } else {
            setSuccessNotification({
              isOpen: true,
              message: 'Session ended successfully'
            });
            await loadData();
          }
        }
      } else if (confirmModal.type === 'all') {
        const count = await SessionService.terminateAllSessions(userId);
        setSuccessNotification({
          isOpen: true,
          message: `Successfully ended ${count} session(s)`
        });
        await loadData();
      }
    } finally {
      setIsProcessing(false);
      setConfirmModal({ isOpen: false, type: 'single' });
    }
  };

  const getDeviceIcon = (deviceName: string) => {
    if (deviceName?.toLowerCase().includes('mobile') || deviceName?.toLowerCase().includes('android') || deviceName?.toLowerCase().includes('ios')) {
      return Smartphone;
    }
    return Monitor;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Session Management</h1>
            <p className="text-slate-600 mt-1">Monitor and manage your active sessions and security</p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'active'
                ? 'border-b-2 border-[#015324] text-[#015324]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Sessions ({activeSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'history'
                ? 'border-b-2 border-[#015324] text-[#015324]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Session History
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'security'
                ? 'border-b-2 border-[#015324] text-[#015324]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Security Events ({securityEvents.filter(e => e.requires_action).length})
          </button>
        </div>
      </div>

      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeSessions.length > 1 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-900">Multiple Active Sessions</h3>
                  <p className="text-sm text-amber-700">You have {activeSessions.length} active sessions</p>
                </div>
              </div>
              <button
                onClick={handleTerminateAllSessions}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
              >
                End All Other Sessions
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {activeSessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session.device_name);
              const isCurrentSession = session.session_token === currentSessionToken;
              return (
                <div
                  key={session.id}
                  className={`bg-white rounded-xl shadow-sm border-2 p-6 ${
                    isCurrentSession ? 'border-green-400 bg-green-50/30' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-lg ${
                        isCurrentSession ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        <DeviceIcon className={`w-6 h-6 ${
                          isCurrentSession ? 'text-green-600' : 'text-blue-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-slate-900">{session.device_name || 'Unknown Device'}</h3>
                          {isCurrentSession && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-600 text-white rounded text-xs font-medium">
                              <Activity className="w-3 h-3" />
                              Current Session
                            </span>
                          )}
                          {session.is_trusted_device && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">
                              <Shield className="w-3 h-3" />
                              Trusted
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{session.ip_address}</span>
                            {session.geolocation?.city && (
                              <span>• {session.geolocation.city}, {session.geolocation.country}</span>
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
                    <button
                      onClick={() => handleTerminateSession(session.id)}
                      className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                        isCurrentSession
                          ? 'text-white bg-red-600 hover:bg-red-700'
                          : 'text-red-600 hover:bg-red-50'
                      }`}
                      title={isCurrentSession ? 'This will log you out' : 'End this session'}
                    >
                      {isCurrentSession ? 'Log Out' : 'End Session'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {activeSessions.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <Monitor className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">No active sessions found</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          {sessionHistory.map((session) => {
            const DeviceIcon = getDeviceIcon(session.device_name);
            const duration = session.session_duration_seconds
              ? `${Math.floor(session.session_duration_seconds / 60)} minutes`
              : 'Unknown';

            return (
              <div
                key={session.id}
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-slate-100 rounded-lg">
                    <DeviceIcon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-slate-900">{session.device_name || 'Unknown Device'}</h4>
                      {session.is_trusted_device && (
                        <Shield className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{session.ip_address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Duration: {duration}</span>
                      </div>
                      <div>Logged in: {new Date(session.login_at).toLocaleString()}</div>
                      <div>
                        {session.logout_at ? (
                          `Logged out: ${new Date(session.logout_at).toLocaleString()}`
                        ) : (
                          'Still active'
                        )}
                      </div>
                      {session.termination_reason && (
                        <div className="col-span-2 mt-1 flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-500">Ended: {session.termination_reason.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {sessionHistory.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">No session history available</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-3">
          {securityEvents.map((event) => (
            <div
              key={event.id}
              className={`bg-white rounded-lg shadow-sm border-2 p-5 ${
                event.requires_action ? 'border-orange-300' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-lg ${getSeverityColor(event.event_severity)}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-slate-900">{event.event_description}</h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(event.event_severity)}`}>
                      {event.event_severity}
                    </span>
                    {event.requires_action && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                        Action Required
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <div>Type: {event.event_type.replace(/_/g, ' ')}</div>
                    <div>Time: {new Date(event.created_at).toLocaleString()}</div>
                    {event.ip_address && <div>IP Address: {event.ip_address}</div>}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {securityEvents.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-slate-600">No security events recorded</p>
              <p className="text-sm text-slate-500 mt-1">Your account security looks good!</p>
            </div>
          )}
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: 'single' })}
        onConfirm={confirmTermination}
        title={
          confirmModal.type === 'single'
            ? confirmModal.isOwnSession
              ? 'Log Out'
              : 'End Session'
            : 'End All Other Sessions'
        }
        message={
          confirmModal.type === 'single'
            ? confirmModal.isOwnSession
              ? 'This is your current session. You will be logged out immediately. Continue?'
              : 'Are you sure you want to end this session? You will remain logged in on this device.'
            : 'Are you sure you want to end all other sessions? You will remain logged in on this device.'
        }
        confirmText={
          confirmModal.type === 'single'
            ? confirmModal.isOwnSession
              ? 'Log Out'
              : 'End Session'
            : 'End All Sessions'
        }
        type={confirmModal.isOwnSession ? 'warning' : 'danger'}
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
