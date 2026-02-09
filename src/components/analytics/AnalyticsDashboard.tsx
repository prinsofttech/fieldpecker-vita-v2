import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  FileSpreadsheet,
  FileText,
  Users,
  Target,
  CheckCircle,
  AlertCircle,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { analyticsService } from '../../lib/analytics/analytics-service';
import { exportService } from '../../lib/analytics/export-utils';
import { supabase } from '../../lib/supabase/client';
import type {
  DailyMetrics,
  SummaryStats,
  TrendData,
  UserActivity,
  RegionalPerformance,
  ModulePerformance,
} from '../../lib/analytics/analytics-service';
import { CustomLineChart, CustomBarChart, CustomPieChart, CustomAreaChart, CustomDonutChart } from './AnalyticsCharts';
import { DateRangeSelector, getInitialDateRange } from '../common/DateRangeSelector';
import type { DateRangeValue } from '../common/DateRangeSelector';

interface AnalyticsDashboardProps {
  orgId: string;
  organizationName: string;
  userRole: string;
}

type SortField = 'userName' | 'formSubmissions' | 'issuesCreated' | 'leadsCreated' | 'sessionCount';
type SortDirection = 'asc' | 'desc';

export function AnalyticsDashboard({ orgId, organizationName, userRole }: AnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeValue>(getInitialDateRange('today'));
  const [orgLogoUrl, setOrgLogoUrl] = useState<string>('');

  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [regionalPerformance, setRegionalPerformance] = useState<RegionalPerformance[]>([]);
  const [modulePerformance, setModulePerformance] = useState<ModulePerformance[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('sessionCount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadOrganizationLogo();
  }, [orgId]);

  useEffect(() => {
    loadAnalyticsData();
  }, [orgId, dateRange]);

  const loadOrganizationLogo = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('logo_url')
        .eq('id', orgId)
        .maybeSingle();

      if (error) throw error;
      if (data?.logo_url) {
        setOrgLogoUrl(data.logo_url);
      }
    } catch (error) {
      console.error('Error loading organization logo:', error);
    }
  };

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      const [summary, daily, trends, users, regions, modules] = await Promise.all([
        analyticsService.getSummaryStats(orgId),
        analyticsService.getDailyMetrics(orgId, Math.max(days, 1)),
        analyticsService.getTrendData(orgId),
        analyticsService.getUserActivity(orgId, 100),
        analyticsService.getRegionalPerformance(orgId),
        analyticsService.getModulePerformance(orgId),
      ]);

      setSummaryStats(summary);
      setDailyMetrics(daily);
      setTrendData(trends);
      setUserActivity(users);
      setRegionalPerformance(regions);
      setModulePerformance(modules);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!summaryStats) return;
    exportService.exportToExcel(
      summaryStats,
      dailyMetrics,
      userActivity,
      regionalPerformance,
      modulePerformance,
      organizationName,
      orgLogoUrl
    );
  };

  const handleExportPDF = async () => {
    if (!summaryStats) return;
    await exportService.exportToPDF(
      summaryStats,
      dailyMetrics,
      userActivity,
      regionalPerformance,
      modulePerformance,
      organizationName,
      orgLogoUrl
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedUsers = userActivity
    .filter(user =>
      user.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      return aVal > bVal ? multiplier : -multiplier;
    });

  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const paginatedUsers = filteredAndSortedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#015324] animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (!summaryStats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-600">Failed to load analytics data</p>
        </div>
      </div>
    );
  }

  const chartData = dailyMetrics.map(m => ({
    date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    forms: m.formSubmissions,
    issues: m.issuesCreated,
    leads: m.leadsCreated,
    resolved: m.issuesResolved,
    converted: m.leadsConverted,
  }));

  const moduleChartData = modulePerformance.map(m => ({
    name: m.moduleName,
    total: m.totalRecords,
    active: m.activeRecords,
    completed: m.completedRecords,
  }));

  const issueDistributionData = [
    { name: 'Open Issues', value: summaryStats.openIssues, color: '#ef4444' },
    { name: 'Resolved Issues', value: summaryStats.resolvedIssues, color: '#10b981' },
  ];

  const leadsDistributionData = [
    { name: 'Active Leads', value: summaryStats.totalLeads - summaryStats.convertedLeads, color: '#f59e0b' },
    { name: 'Converted Leads', value: summaryStats.convertedLeads, color: '#10b981' },
  ];

  const regionalChartData = regionalPerformance.slice(0, 8).map(r => ({
    name: r.regionName,
    forms: r.formSubmissions,
    issues: r.issuesCount,
    leads: r.leadsCount,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-[#015324]" />
            Daily Analytics Report
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
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600">Total Submissions</h3>
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{summaryStats.totalSubmissions.toLocaleString()}</p>
          <p className="text-xs text-slate-600 mt-1">
            {summaryStats.avgSubmissionsPerDay.toFixed(1)} per day average
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600">Open Issues</h3>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{summaryStats.openIssues.toLocaleString()}</p>
          <p className="text-xs text-slate-600 mt-1">
            {summaryStats.resolutionRate.toFixed(1)}% resolution rate
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600">Lead Conversion</h3>
            <Target className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{summaryStats.conversionRate.toFixed(1)}%</p>
          <p className="text-xs text-slate-600 mt-1">
            {summaryStats.convertedLeads} of {summaryStats.totalLeads} leads
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-600">Active Users</h3>
            <Users className="w-5 h-5 text-[#015324]" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{summaryStats.activeUsers.toLocaleString()}</p>
          <p className="text-xs text-slate-600 mt-1">
            {summaryStats.totalCustomers} total customers
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {trendData.slice(0, 4).map((trend) => (
          <div
            key={trend.metric}
            className="bg-white rounded-lg border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">{trend.metric}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {trend.current.toLocaleString()}
                </p>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                trend.trend === 'up'
                  ? 'bg-emerald-100 text-emerald-700'
                  : trend.trend === 'down'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {trend.trend === 'up' ? (
                  <TrendingUp className="w-4 h-4" />
                ) : trend.trend === 'down' ? (
                  <TrendingDown className="w-4 h-4" />
                ) : (
                  <div className="w-4 h-0.5 bg-slate-400 rounded" />
                )}
                <span className="text-sm font-semibold">
                  {Math.abs(trend.changePercent).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {trend.trend === 'up' ? 'Increase' : trend.trend === 'down' ? 'Decrease' : 'No change'} from previous period ({trend.previous})
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CustomAreaChart
          data={chartData}
          areas={[
            { dataKey: 'forms', name: 'Form Submissions', color: '#3b82f6' },
            { dataKey: 'issues', name: 'Issues Created', color: '#ef4444' },
            { dataKey: 'leads', name: 'Leads Created', color: '#f59e0b' },
          ]}
          xAxisKey="date"
          title="Activity Trends"
        />

        <CustomLineChart
          data={chartData}
          lines={[
            { dataKey: 'resolved', name: 'Issues Resolved', color: '#10b981' },
            { dataKey: 'converted', name: 'Leads Converted', color: '#8b5cf6' },
          ]}
          xAxisKey="date"
          title="Completion Metrics"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CustomBarChart
          data={moduleChartData}
          bars={[
            { dataKey: 'total', name: 'Total', color: '#64748b' },
            { dataKey: 'active', name: 'Active', color: '#f59e0b' },
            { dataKey: 'completed', name: 'Completed', color: '#10b981' },
          ]}
          xAxisKey="name"
          title="Module Performance"
        />

        <CustomPieChart
          data={issueDistributionData}
          title="Issue Status Distribution"
        />

        <CustomDonutChart
          data={leadsDistributionData}
          title="Leads Status Distribution"
          centerText={`${summaryStats.conversionRate.toFixed(0)}%`}
        />
      </div>

      {regionalPerformance.length > 0 && (
        <CustomBarChart
          data={regionalChartData}
          bars={[
            { dataKey: 'forms', name: 'Forms', color: '#3b82f6' },
            { dataKey: 'issues', name: 'Issues', color: '#ef4444' },
            { dataKey: 'leads', name: 'Leads', color: '#f59e0b' },
          ]}
          xAxisKey="name"
          title="Regional Performance Comparison"
        />
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800">User Activity Analysis</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#015324] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">User</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Role</th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                  onClick={() => handleSort('formSubmissions')}
                >
                  <div className="flex items-center gap-1">
                    Forms
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                  onClick={() => handleSort('issuesCreated')}
                >
                  <div className="flex items-center gap-1">
                    Issues
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                  onClick={() => handleSort('leadsCreated')}
                >
                  <div className="flex items-center gap-1">
                    Leads
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                  onClick={() => handleSort('sessionCount')}
                >
                  <div className="flex items-center gap-1">
                    Sessions
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Active Time</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr
                  key={user.userId}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{user.userName}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-700">{user.formSubmissions}</td>
                  <td className="py-3 px-4 text-sm text-slate-700">{user.issuesCreated}</td>
                  <td className="py-3 px-4 text-sm text-slate-700">{user.leadsCreated}</td>
                  <td className="py-3 px-4 text-sm text-slate-700">{user.sessionCount}</td>
                  <td className="py-3 px-4 text-sm text-slate-700">
                    {(user.totalActiveTime / 60).toFixed(1)}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredAndSortedUsers.length)} of{' '}
              {filteredAndSortedUsers.length} users
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-blue-600" />
          Key Insights & Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summaryStats.conversionRate < 20 && (
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="font-medium text-slate-800 mb-1">Low Conversion Rate Detected</p>
              <p className="text-sm text-slate-600">
                Your lead conversion rate is {summaryStats.conversionRate.toFixed(1)}%. Consider reviewing your sales process and follow-up strategies.
              </p>
            </div>
          )}
          {summaryStats.openIssues > summaryStats.resolvedIssues && (
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="font-medium text-slate-800 mb-1">High Open Issues Volume</p>
              <p className="text-sm text-slate-600">
                You have {summaryStats.openIssues} open issues. Prioritize issue resolution to improve customer satisfaction.
              </p>
            </div>
          )}
          {summaryStats.avgSubmissionsPerDay < 10 && (
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="font-medium text-slate-800 mb-1">Low Form Submission Activity</p>
              <p className="text-sm text-slate-600">
                Average of {summaryStats.avgSubmissionsPerDay.toFixed(1)} submissions per day. Consider promoting your forms or simplifying the submission process.
              </p>
            </div>
          )}
          {summaryStats.resolutionRate > 80 && (
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="font-medium text-slate-800 mb-1">Excellent Issue Resolution</p>
              <p className="text-sm text-slate-600">
                Great job! Your issue resolution rate is {summaryStats.resolutionRate.toFixed(1)}%. Keep up the excellent work.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
