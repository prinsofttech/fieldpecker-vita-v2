import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, TrendingUp, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import * as XLSX from 'xlsx';

interface IssueTrackerReportProps {
  orgId: string;
  userId: string;
  userRole: string;
  dateRange: string;
}

export function IssueTrackerReport({ orgId, dateRange }: IssueTrackerReportProps) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [orgId, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter();

      const { data } = await supabase
        .from('issues')
        .select(`
          id,
          issue_number,
          title,
          status,
          priority,
          created_at,
          resolved_at,
          created_by:users!issues_created_by_fkey(id, full_name),
          assigned_to:users!issues_assigned_to_fkey(id, full_name)
        `)
        .eq('org_id', orgId)
        .gte('created_at', dateFilter)
        .order('created_at', { ascending: false });

      setIssues(data || []);
    } catch (error) {
      console.error('Error loading issues report:', error);
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

  const getStatusStats = () => {
    const statusCount = {
      new: issues.filter(i => i.status === 'new').length,
      assigned: issues.filter(i => i.status === 'assigned').length,
      in_progress: issues.filter(i => i.status === 'in_progress').length,
      resolved: issues.filter(i => i.status === 'resolved').length,
      closed: issues.filter(i => i.status === 'closed').length
    };

    return statusCount;
  };

  const getPriorityStats = () => {
    return {
      critical: issues.filter(i => i.priority === 'critical').length,
      high: issues.filter(i => i.priority === 'high').length,
      medium: issues.filter(i => i.priority === 'medium').length,
      low: issues.filter(i => i.priority === 'low').length
    };
  };

  const getAvgResolutionTime = () => {
    const resolved = issues.filter(i => i.resolved_at);
    if (resolved.length === 0) return 'N/A';

    const totalHours = resolved.reduce((sum, issue) => {
      const created = new Date(issue.created_at).getTime();
      const resolved = new Date(issue.resolved_at).getTime();
      return sum + (resolved - created) / (1000 * 60 * 60);
    }, 0);

    const avgHours = Math.round(totalHours / resolved.length);
    if (avgHours < 24) return `${avgHours}h`;
    return `${Math.round(avgHours / 24)}d`;
  };

  const exportStatusDistribution = () => {
    const statusData = Object.entries(statusStats).map(([status, count]) => ({
      'Status': status.replace('_', ' '),
      'Count': count,
      'Percentage': issues.length > 0 ? `${Math.round((count / issues.length) * 100)}%` : '0%'
    }));

    const worksheet = XLSX.utils.json_to_sheet(statusData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Status Distribution');

    const fileName = `Issue_Status_Distribution_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const exportPriorityDistribution = () => {
    const priorityData = Object.entries(priorityStats).map(([priority, count]) => ({
      'Priority': priority,
      'Count': count,
      'Percentage': issues.length > 0 ? `${Math.round((count / issues.length) * 100)}%` : '0%'
    }));

    const worksheet = XLSX.utils.json_to_sheet(priorityData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Priority Distribution');

    const fileName = `Issue_Priority_Distribution_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const statusStats = getStatusStats();
  const priorityStats = getPriorityStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-slate-800">{issues.length}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Total Issues</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
            <span className="text-2xl font-bold text-slate-800">{statusStats.resolved + statusStats.closed}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Resolved</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-amber-600" />
            <span className="text-2xl font-bold text-slate-800">{statusStats.in_progress}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">In Progress</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <span className="text-2xl font-bold text-slate-800">{getAvgResolutionTime()}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Avg Resolution Time</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Status Distribution</h3>
              <p className="text-sm text-slate-600 mt-1">Issues grouped by current status</p>
            </div>
            <button
              onClick={exportStatusDistribution}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          <div className="space-y-3">
            {Object.entries(statusStats).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-slate-700 capitalize font-medium">{status.replace('_', ' ')}</span>
                <div className="flex items-center gap-3">
                  <div className="w-48 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        status === 'resolved' || status === 'closed'
                          ? 'bg-emerald-500'
                          : status === 'in_progress'
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${issues.length > 0 ? (count / issues.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 w-12 text-right">
                    {count} ({issues.length > 0 ? Math.round((count / issues.length) * 100) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Priority Distribution</h3>
              <p className="text-sm text-slate-600 mt-1">Issues grouped by priority level</p>
            </div>
            <button
              onClick={exportPriorityDistribution}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          <div className="space-y-3">
            {Object.entries(priorityStats).map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between">
                <span className="text-slate-700 capitalize font-medium">{priority}</span>
                <div className="flex items-center gap-3">
                  <div className="w-48 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        priority === 'critical'
                          ? 'bg-red-500'
                          : priority === 'high'
                          ? 'bg-orange-500'
                          : priority === 'medium'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${issues.length > 0 ? (count / issues.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 w-12 text-right">
                    {count} ({issues.length > 0 ? Math.round((count / issues.length) * 100) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
