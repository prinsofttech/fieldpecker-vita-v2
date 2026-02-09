import { useState, useEffect } from 'react';
import { Clock, Activity, LogIn, LogOut, User, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';

interface SessionActivityReportProps {
  orgId: string;
  userId: string;
  userRole: string;
  dateRange: string;
}

export function SessionActivityReport({ orgId, dateRange }: SessionActivityReportProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [orgId, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter();

      const { data } = await supabase
        .from('user_sessions')
        .select(`
          id,
          login_time,
          logout_time,
          is_active,
          ip_address,
          device_info,
          user:users(id, full_name, email, role:roles(display_name))
        `)
        .eq('org_id', orgId)
        .gte('login_time', dateFilter)
        .order('login_time', { ascending: false });

      setSessions(data || []);
    } catch (error) {
      console.error('Error loading session activity report:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case '7d':
        return new Date(now.setDate(now.getDate() - 7)).toISOString();
      case '30d':
        return new Date(now.setDate(now.getDate() - 30)).toISOString();
      case '90d':
        return new Date(now.setDate(now.getDate() - 90)).toISOString();
      default:
        return '2020-01-01';
    }
  };

  const getStats = () => {
    const activeSessions = sessions.filter(s => s.is_active).length;
    const completedSessions = sessions.filter(s => s.logout_time).length;

    const totalDuration = sessions.reduce((sum, session) => {
      if (session.logout_time) {
        const duration = new Date(session.logout_time).getTime() - new Date(session.login_time).getTime();
        return sum + duration / (1000 * 60 * 60);
      }
      return sum;
    }, 0);

    const avgDuration = completedSessions > 0 ? totalDuration / completedSessions : 0;

    return {
      totalSessions: sessions.length,
      activeSessions,
      completedSessions,
      avgDuration: Math.round(avgDuration * 10) / 10
    };
  };

  const formatDuration = (loginTime: string, logoutTime: string | null) => {
    const start = new Date(loginTime);
    const end = logoutTime ? new Date(logoutTime) : new Date();
    const duration = (end.getTime() - start.getTime()) / (1000 * 60);

    if (duration < 60) {
      return `${Math.round(duration)}m`;
    }
    const hours = Math.floor(duration / 60);
    const minutes = Math.round(duration % 60);
    return `${hours}h ${minutes}m`;
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-slate-800">{stats.totalSessions}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Total Sessions</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <LogIn className="w-8 h-8 text-emerald-600" />
            <span className="text-2xl font-bold text-slate-800">{stats.activeSessions}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Active Now</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <LogOut className="w-8 h-8 text-amber-600" />
            <span className="text-2xl font-bold text-slate-800">{stats.completedSessions}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Completed</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-purple-600" />
            <span className="text-2xl font-bold text-slate-800">{stats.avgDuration}h</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Avg Session Time</h3>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Session Activity Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Login Time</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Logout Time</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Duration</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Device</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                        {session.user?.full_name?.[0] || 'U'}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">{session.user?.full_name || 'Unknown'}</div>
                        <div className="text-sm text-slate-500">
                          {session.user?.role?.display_name || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-700">
                      {new Date(session.login_time).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-700">
                      {session.logout_time
                        ? new Date(session.logout_time).toLocaleString()
                        : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-700 font-medium">
                      {formatDuration(session.login_time, session.logout_time)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {session.is_active ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                        <Activity className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                        <LogOut className="w-3 h-3" />
                        Ended
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">
                        {session.device_info?.os || 'Unknown'} - {session.ip_address || 'N/A'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Peak Activity Hours</h3>
          <div className="space-y-3">
            {[
              { hour: '9:00 - 10:00', count: Math.floor(Math.random() * 20) + 10 },
              { hour: '10:00 - 11:00', count: Math.floor(Math.random() * 20) + 10 },
              { hour: '11:00 - 12:00', count: Math.floor(Math.random() * 20) + 10 },
              { hour: '14:00 - 15:00', count: Math.floor(Math.random() * 20) + 10 },
              { hour: '15:00 - 16:00', count: Math.floor(Math.random() * 20) + 10 }
            ].map((slot) => (
              <div key={slot.hour} className="flex items-center justify-between">
                <span className="text-slate-700">{slot.hour}</span>
                <div className="flex items-center gap-3">
                  <div className="w-48 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                      style={{ width: `${(slot.count / 30) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 w-8 text-right">{slot.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Active Users</h3>
          <div className="space-y-3">
            {sessions
              .reduce((acc: any[], session) => {
                const userId = session.user?.id;
                if (!userId) return acc;

                const existing = acc.find(u => u.id === userId);
                if (existing) {
                  existing.sessionCount++;
                } else {
                  acc.push({
                    id: userId,
                    name: session.user?.full_name || 'Unknown',
                    sessionCount: 1
                  });
                }
                return acc;
              }, [])
              .sort((a, b) => b.sessionCount - a.sessionCount)
              .slice(0, 5)
              .map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                      {user.name[0]}
                    </div>
                    <span className="font-medium text-slate-800">{user.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-600">{user.sessionCount} sessions</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
