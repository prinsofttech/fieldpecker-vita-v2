import { useState, useEffect } from 'react';
import {
  BarChart,
  TrendingUp,
  FileText,
  AlertCircle,
  Download,
  Clock,
  CheckCircle,
  Activity,
  Target
} from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { FormSubmissionsReport } from './FormSubmissionsReport';
import { IssueTrackerReport } from './IssueTrackerReport';
import { LeadsReport } from './LeadsReport';
import { SessionActivityReport } from './SessionActivityReport';
import { ExportDataModal } from '../modals/ExportDataModal';
import { DateRangeSelector, getInitialDateRange } from '../common/DateRangeSelector';
import type { DateRangeValue } from '../common/DateRangeSelector';

type ReportType = 'overview' | 'forms' | 'issues' | 'leads' | 'sessions';

interface StatsCard {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  color: string;
}

export function ReportsDashboard() {
  const [currentReport, setCurrentReport] = useState<ReportType>('overview');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeValue>(getInitialDateRange('today'));
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (orgId) {
      loadOverviewStats();
    }
  }, [orgId, dateRange]);

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('org_id, role:roles(name), organization:organizations(name, logo_url)')
        .eq('id', user.id)
        .single();

      if (data) {
        setOrgId(data.org_id);
        setUserId(user.id);
        setUserRole((data.role as any)?.name || '');
        setOrgName((data.organization as any)?.name || '');
        setOrgLogo((data.organization as any)?.logo_url || null);
      }
    }
  };

  const loadOverviewStats = async () => {
    if (!orgId) return;
    setLoading(true);

    try {
      const startDate = new Date(dateRange.startDate);
      startDate.setHours(0, 0, 0, 0);
      const dateFilter = startDate.toISOString();

      const [formsData, issuesData, leadsData, sessionsData] = await Promise.all([
        supabase
          .from('form_submissions')
          .select('id, submitted_at, form:forms!inner(org_id)')
          .eq('form.org_id', orgId)
          .gte('submitted_at', dateFilter),
        supabase
          .from('issues')
          .select('id, status, created_at')
          .eq('org_id', orgId)
          .gte('created_at', dateFilter),
        supabase
          .from('leads')
          .select('id, status, created_at')
          .eq('org_id', orgId)
          .gte('created_at', dateFilter),
        supabase
          .from('user_sessions')
          .select('id, login_at, logout_at')
          .eq('org_id', orgId)
          .gte('login_at', dateFilter)
      ]);

      const totalForms = formsData.data?.length || 0;
      const totalIssues = issuesData.data?.length || 0;
      const resolvedIssues = issuesData.data?.filter(i => i.status === 'resolved' || i.status === 'closed').length || 0;
      const totalLeads = leadsData.data?.length || 0;
      const convertedLeads = leadsData.data?.filter(l => l.status === 'converted' || l.status === 'won').length || 0;
      const totalSessions = sessionsData.data?.length || 0;

      setStats([
        {
          title: 'Form Submissions',
          value: totalForms,
          change: '+12%',
          trend: 'up',
          icon: <FileText className="w-6 h-6" />,
          color: 'from-[#015324] to-[#016428]'
        },
        {
          title: 'Issues Resolved',
          value: `${resolvedIssues}/${totalIssues}`,
          change: resolvedIssues > 0 ? `${Math.round((resolvedIssues / totalIssues) * 100)}%` : '0%',
          trend: resolvedIssues / totalIssues > 0.7 ? 'up' : 'down',
          icon: <CheckCircle className="w-6 h-6" />,
          color: 'from-emerald-500 to-emerald-600'
        },
        {
          title: 'Leads Converted',
          value: `${convertedLeads}/${totalLeads}`,
          change: convertedLeads > 0 ? `${Math.round((convertedLeads / totalLeads) * 100)}%` : '0%',
          trend: convertedLeads / totalLeads > 0.3 ? 'up' : 'neutral',
          icon: <Target className="w-6 h-6" />,
          color: 'from-[#015324] to-[#016428]'
        },
        {
          title: 'Active Sessions',
          value: totalSessions,
          change: '+8%',
          trend: 'up',
          icon: <Activity className="w-6 h-6" />,
          color: 'from-emerald-500 to-emerald-600'
        }
      ]);
    } catch (error) {
      console.error('Error loading overview stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const reportTabs = [
    { id: 'overview' as ReportType, name: 'Overview', icon: BarChart },
    { id: 'forms' as ReportType, name: 'Forms Analytics', icon: FileText },
    { id: 'issues' as ReportType, name: 'Issue Tracker', icon: AlertCircle },
    { id: 'leads' as ReportType, name: 'Leads & CRM', icon: TrendingUp },
    { id: 'sessions' as ReportType, name: 'Session Activity', icon: Clock }
  ];

  const renderReportContent = () => {
    if (!orgId || !userId) return null;

    switch (currentReport) {
      case 'forms':
        return <FormSubmissionsReport orgId={orgId} userId={userId} userRole={userRole} dateRange={dateRange.startDate} />;
      case 'issues':
        return <IssueTrackerReport orgId={orgId} userId={userId} userRole={userRole} dateRange={dateRange.startDate} />;
      case 'leads':
        return <LeadsReport orgId={orgId} userId={userId} userRole={userRole} dateRange={dateRange.startDate} />;
      case 'sessions':
        return <SessionActivityReport orgId={orgId} userId={userId} userRole={userRole} dateRange={dateRange.startDate} />;
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-lg`}>
                  {stat.icon}
                </div>
                <div className={`flex items-center gap-1 text-sm font-semibold ${
                  stat.trend === 'up' ? 'text-green-600' : stat.trend === 'down' ? 'text-red-600' : 'text-slate-600'
                }`}>
                  {stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '→'}
                  {stat.change}
                </div>
              </div>
              <h3 className="text-slate-600 text-sm font-medium mb-1">{stat.title}</h3>
              <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <BarChart className="w-5 h-5 text-[#015324]" />
          Quick Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => setCurrentReport('forms')}
            className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 hover:shadow-md transition-all text-left group"
          >
            <FileText className="w-8 h-8 text-[#015324] mb-2 group-hover:scale-110 transition-transform" />
            <h4 className="font-semibold text-slate-800">Form Analytics</h4>
            <p className="text-sm text-slate-600 mt-1">View submission trends and metrics</p>
          </button>

          <button
            onClick={() => setCurrentReport('issues')}
            className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200 hover:shadow-md transition-all text-left group"
          >
            <AlertCircle className="w-8 h-8 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
            <h4 className="font-semibold text-slate-800">Issue Reports</h4>
            <p className="text-sm text-slate-600 mt-1">Track resolution rates and SLAs</p>
          </button>

          <button
            onClick={() => setCurrentReport('leads')}
            className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200 hover:shadow-md transition-all text-left group"
          >
            <TrendingUp className="w-8 h-8 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
            <h4 className="font-semibold text-slate-800">Leads & CRM</h4>
            <p className="text-sm text-slate-600 mt-1">Monitor conversion rates</p>
          </button>

          <button
            onClick={() => setCurrentReport('sessions')}
            className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 hover:shadow-md transition-all text-left group"
          >
            <Clock className="w-8 h-8 text-[#015324] mb-2 group-hover:scale-110 transition-transform" />
            <h4 className="font-semibold text-slate-800">Session Activity</h4>
            <p className="text-sm text-slate-600 mt-1">Review user activity logs</p>
          </button>
        </div>
      </div>
    </div>
  );

  if (loading && currentReport === 'overview') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#015324] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 flex">
        <div className="w-64 bg-white border-r border-slate-200 flex-shrink-0 hidden lg:block">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#015324] to-[#016428] flex items-center justify-center shadow-lg">
                <BarChart className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Reports</h2>
            </div>
            <p className="text-xs text-slate-600">Analytics & Insights</p>
          </div>

          <nav className="p-4 space-y-2">
            {reportTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentReport(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                    currentReport === tab.id
                      ? 'bg-gradient-to-r from-[#015324] to-[#016428] text-white shadow-lg'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 p-4 sm:p-8 pt-20 lg:pt-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-800">
                  {reportTabs.find(t => t.id === currentReport)?.name || 'Overview'}
                </h1>
                <p className="text-slate-600 mt-1">
                  Comprehensive insights and performance metrics
                </p>
              </div>
              <div className="flex items-center gap-3">
                <DateRangeSelector
                  value={dateRange}
                  onChange={setDateRange}
                  label="Date Range"
                />
                <button
                  onClick={() => setShowExportModal(true)}
                  className="bg-gradient-to-r from-[#015324] to-[#016428] text-white px-6 py-2.5 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 mt-5"
                >
                  <Download className="w-4 h-4" />
                  <span className="font-medium hidden sm:inline">Export</span>
                </button>
              </div>
            </div>

            <div className="lg:hidden mb-6">
              <label className="text-xs font-medium text-slate-600 mb-2 px-1 block">Report Type</label>
              <select
                value={currentReport}
                onChange={(e) => setCurrentReport(e.target.value as ReportType)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {reportTabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.name}
                  </option>
                ))}
              </select>
            </div>

            {renderReportContent()}
          </div>
        </div>
      </div>

      <ExportDataModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        orgId={orgId || ''}
        dateRange={dateRange.startDate}
      />
    </>
  );
}
