import { useState, useEffect } from 'react';
import { Users, TrendingUp, Activity, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';

interface TeamPerformanceReportProps {
  orgId: string;
  userId: string;
  userRole: string;
  dateRange: string;
}

export function TeamPerformanceReport({ orgId, dateRange }: TeamPerformanceReportProps) {
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [orgId, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter();

      const { data } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          role:roles(name, display_name),
          form_submissions:form_submissions(count),
          issues_created:issues!issues_created_by_fkey(count),
          issues_assigned:issues!issues_assigned_to_fkey(count),
          sessions:user_sessions(login_time, logout_time)
        `)
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('full_name');

      const enrichedData = (data || []).map(user => {
        const sessions = user.sessions?.filter((s: any) =>
          new Date(s.login_time) >= new Date(dateFilter)
        ) || [];

        const totalSessionTime = sessions.reduce((sum: number, s: any) => {
          if (s.logout_time) {
            const duration = new Date(s.logout_time).getTime() - new Date(s.login_time).getTime();
            return sum + duration / (1000 * 60 * 60);
          }
          return sum;
        }, 0);

        return {
          ...user,
          sessionCount: sessions.length,
          totalHours: Math.round(totalSessionTime * 10) / 10
        };
      });

      setTeamMembers(enrichedData);
    } catch (error) {
      console.error('Error loading team performance report:', error);
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

  const getTotalStats = () => {
    return {
      totalMembers: teamMembers.length,
      totalSessions: teamMembers.reduce((sum, m) => sum + m.sessionCount, 0),
      totalHours: teamMembers.reduce((sum, m) => sum + m.totalHours, 0),
      avgHoursPerMember: teamMembers.length > 0
        ? Math.round((teamMembers.reduce((sum, m) => sum + m.totalHours, 0) / teamMembers.length) * 10) / 10
        : 0
    };
  };

  const stats = getTotalStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-[#015324] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-[#015324]" />
            <span className="text-2xl font-bold text-slate-800">{stats.totalMembers}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Active Users</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-8 h-8 text-emerald-600" />
            <span className="text-2xl font-bold text-slate-800">{stats.totalSessions}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Total Sessions</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-[#015324]" />
            <span className="text-2xl font-bold text-slate-800">{Math.round(stats.totalHours)}h</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Total Hours</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-8 h-8 text-emerald-600" />
            <span className="text-2xl font-bold text-slate-800">{stats.avgHoursPerMember}h</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Avg Hours/User</h3>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Staff Performance Overview</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Sessions</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Hours</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teamMembers.map((member) => {
                const performanceScore = Math.min(100, Math.round((member.totalHours / stats.avgHoursPerMember) * 50 + 50));
                return (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#015324] to-[#016428] flex items-center justify-center text-white font-semibold">
                          {member.full_name?.[0] || 'U'}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{member.full_name}</div>
                          <div className="text-sm text-slate-500">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                        {member.role?.display_name || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-700 font-medium">{member.sessionCount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-700 font-medium">{member.totalHours}h</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              performanceScore >= 80
                                ? 'bg-emerald-500'
                                : performanceScore >= 60
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${performanceScore}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{performanceScore}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
