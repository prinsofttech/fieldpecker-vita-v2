import { useEffect, useState } from 'react';
import {
  Users,
  FileText,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Bell,
  Calendar,
  ChevronRight,
  MoreHorizontal,
  ArrowUpRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import type { User } from '../../lib/supabase/types';
import TerritoryPerformanceModal from './TerritoryPerformanceModal';

interface ClientDashboardProps {
  user: User;
  onNavigate: (view: string) => void;
}

interface ModuleMetrics {
  name: string;
  displayName: string;
  icon: string;
  count: number;
  trend: number;
  color: string;
  bgColor: string;
  enabled: boolean;
  subtitle?: string;
}

interface TerritoryData {
  id: string;
  name: string;
  formCount: number;
  customerCount: number;
}

interface MonthlyData {
  month: string;
  forms: number;
  issues: number;
}

export function ClientDashboard({ user, onNavigate }: ClientDashboardProps) {
  const [moduleMetrics, setModuleMetrics] = useState<ModuleMetrics[]>([]);
  const [territoryData, setTerritoryData] = useState<TerritoryData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadDashboardData();
    loadMonthlyData();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, [user.org_id]);

  const loadDashboardData = async () => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayStart = today.toISOString();
      const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      const [
        orgModulesResult,
        submissionsCountResult,
        openIssuesCountResult,
        resolvedIssuesCountResult,
        customersCountResult,
        totalLeadsCountResult,
        convertedLeadsCountResult,
        territoryResult
      ] = await Promise.all([
        supabase
          .from('org_modules')
          .select('modules(name, display_name, icon), is_enabled')
          .eq('org_id', user.org_id),
        supabase
          .from('form_submissions')
          .select('id, forms!inner(org_id)', { count: 'exact', head: true })
          .eq('forms.org_id', user.org_id)
          .gte('submitted_at', todayStart)
          .lte('submitted_at', todayEnd),
        supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', user.org_id)
          .in('status', ['new', 'assigned', 'in_progress'])
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
        supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', user.org_id)
          .eq('status', 'resolved')
          .gte('updated_at', todayStart)
          .lte('updated_at', todayEnd),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', user.org_id),
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', user.org_id)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', user.org_id)
          .in('status', ['won', 'converted'])
          .gte('updated_at', todayStart)
          .lte('updated_at', todayEnd),
        supabase.rpc('get_territory_metrics', { p_org_id: user.org_id, p_start_date: monthStart, p_end_date: monthEnd })
      ]);

      const orgModules = orgModulesResult.data;
      if (!orgModules) {
        setLoading(false);
        return;
      }

      const submissionsCount = submissionsCountResult.count || 0;
      const openIssuesCount = openIssuesCountResult.count || 0;
      const resolvedCount = resolvedIssuesCountResult.count || 0;
      const customersCount = customersCountResult.count || 0;
      const totalLeadsCount = totalLeadsCountResult.count || 0;
      const convertedLeadsCount = convertedLeadsCountResult.count || 0;

      const resolvedMetrics = orgModules
        .filter((item: any) => item.is_enabled)
        .map((item: any) => {
          const module = item.modules;

          switch (module.name) {
            case 'forms':
              return {
                name: module.name,
                displayName: module.display_name,
                icon: module.icon,
                count: submissionsCount,
                trend: 15,
                color: 'bg-blue-600',
                bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100',
                enabled: true,
                subtitle: `Today's Submissions`
              };

            case 'issue_tracker':
              return {
                name: module.name,
                displayName: module.display_name,
                icon: module.icon,
                count: openIssuesCount,
                trend: -8,
                color: 'bg-red-500',
                bgColor: 'bg-gradient-to-br from-red-50 to-red-100',
                enabled: true,
                subtitle: `${resolvedCount} Resolved Today`
              };

            case 'customers':
              return {
                name: module.name,
                displayName: module.display_name,
                icon: module.icon,
                count: customersCount,
                trend: 12,
                color: 'bg-emerald-500',
                bgColor: 'bg-gradient-to-br from-green-50 to-green-100',
                enabled: true,
                subtitle: 'Total Customers'
              };

            case 'my_team':
              return {
                name: module.name,
                displayName: module.display_name,
                icon: module.icon,
                count: totalLeadsCount,
                trend: 5,
                color: 'bg-amber-500',
                bgColor: 'bg-gradient-to-br from-amber-50 to-amber-100',
                enabled: true,
                subtitle: `${convertedLeadsCount} Converted Today`
              };

            default:
              return null;
          }
        })
        .filter(Boolean) as ModuleMetrics[];
      setModuleMetrics(resolvedMetrics);

      if (territoryResult.data && territoryResult.data.length > 0) {
        setTerritoryData(territoryResult.data.map((t: any) => ({
          id: t.region_id,
          name: t.region_name,
          formCount: Number(t.form_count),
          customerCount: Number(t.customer_count),
        })));
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyData = async () => {
    try {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const { data, error } = await supabase.rpc('get_monthly_activity_stats', {
        p_org_id: user.org_id
      });

      if (error) throw error;

      const monthlyStats: MonthlyData[] = months.map((month, index) => {
        const row = data?.find((r: any) => r.month_num === index + 1);
        return {
          month,
          forms: row ? Number(row.forms_count) : 0,
          issues: row ? Number(row.issues_count) : 0,
        };
      });

      setMonthlyData(monthlyStats);
    } catch (error) {
      console.error('Error loading monthly data:', error);
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const generateChartPath = (data: number[], maxValue: number, chartHeight: number, isFilled: boolean): string => {
    if (data.length === 0 || maxValue === 0) {
      return isFilled ? 'M 0 250 L 800 250 Z' : 'M 0 250 L 800 250';
    }

    const chartWidth = 800;
    const segmentWidth = chartWidth / (data.length - 1);
    const padding = 30;
    const availableHeight = chartHeight - padding;

    const points = data.map((value, index) => {
      const x = index * segmentWidth;
      const y = chartHeight - padding - (value / maxValue) * availableHeight;
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const controlX = (current.x + next.x) / 2;
      path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }

    if (isFilled) {
      path += ` L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;
    }

    return path;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-emerald-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-slate-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const formsModule = moduleMetrics.find(m => m.name === 'forms');
  const issuesModule = moduleMetrics.find(m => m.name === 'issue_tracker');
  const customersModule = moduleMetrics.find(m => m.name === 'customers');
  const teamModule = moduleMetrics.find(m => m.name === 'my_team');

  const totalActivity = territoryData.reduce((sum, r) => sum + r.formCount + r.customerCount, 0);
  const totalForms = territoryData.reduce((sum, r) => sum + r.formCount, 0);
  const totalCustomersInTerritories = territoryData.reduce((sum, r) => sum + r.customerCount, 0);

  const formsData = monthlyData.map(m => m.forms);
  const issuesData = monthlyData.map(m => m.issues);
  const maxValue = Math.max(...formsData, ...issuesData, 1);

  const formsPathFilled = generateChartPath(formsData, maxValue, 250, true);
  const formsPathStroke = generateChartPath(formsData, maxValue, 250, false);
  const issuesPathFilled = generateChartPath(issuesData, maxValue, 250, true);
  const issuesPathStroke = generateChartPath(issuesData, maxValue, 250, false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">
        {/* Header Section */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8 lg:mb-10">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
                {getGreeting()}, {user.full_name?.split(' ')[0]}
              </h1>
              <p className="text-sm sm:text-base text-slate-500 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate()}
              </p>
            </div>

            <button className="relative p-3 bg-white border border-slate-200 rounded-2xl hover:shadow-md transition-all lg:hidden">
              <Bell className="w-5 h-5 text-slate-600" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-emerald-500 rounded-full"></span>
            </button>
          </div>

          <div className="flex items-center gap-3 w-full justify-end">
            <button className="hidden lg:block relative p-3 bg-white border border-slate-200 rounded-2xl hover:shadow-md transition-all">
              <Bell className="w-5 h-5 text-slate-600" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-emerald-500 rounded-full"></span>
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className="hidden lg:flex items-center gap-3 pl-4 pr-5 py-2.5 bg-white border border-slate-200 rounded-2xl hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/30">
                {user.full_name?.charAt(0) || 'U'}
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-slate-800">{user.full_name}</div>
                <div className="text-xs text-slate-500">{user.role?.name || 'User'}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Stats Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Forms Card */}
          <div
            onClick={() => onNavigate('forms')}
            className="group relative bg-gradient-to-br from-emerald-50 via-emerald-50 to-teal-50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 cursor-pointer hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 border border-emerald-100 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-emerald-200/40 to-transparent rounded-full -translate-y-12 translate-x-12 sm:-translate-y-16 sm:translate-x-16"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-emerald-100 rounded-full">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700">+{formsModule?.trend || 15}%</span>
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-slate-800 mb-1">{formsModule?.count || 0}</div>
              <div className="text-xs sm:text-sm text-slate-600 font-medium">Form Submissions</div>
              <div className="text-xs text-emerald-600 mt-1 sm:mt-2 truncate">{formsModule?.subtitle}</div>
            </div>
            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
          </div>

          {/* Issues Card */}
          <div
            onClick={() => onNavigate('issue_tracker')}
            className="group relative bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 cursor-pointer hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 border border-amber-100 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-amber-200/40 to-transparent rounded-full -translate-y-12 translate-x-12 sm:-translate-y-16 sm:translate-x-16"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <AlertCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-100 rounded-full">
                  <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">{Math.abs(issuesModule?.trend || 8)}%</span>
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-slate-800 mb-1">{issuesModule?.count || 0}</div>
              <div className="text-xs sm:text-sm text-slate-600 font-medium">Open Issues</div>
              <div className="text-xs text-amber-600 mt-1 sm:mt-2 truncate">{issuesModule?.subtitle}</div>
            </div>
            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
          </div>

          {/* Customers Card */}
          <div
            onClick={() => onNavigate('customers')}
            className="group relative bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 cursor-pointer hover:shadow-xl hover:shadow-sky-500/10 transition-all duration-300 border border-sky-100 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-sky-200/40 to-transparent rounded-full -translate-y-12 translate-x-12 sm:-translate-y-16 sm:translate-x-16"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/30">
                  <Users className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-sky-100 rounded-full">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-sky-600" />
                  <span className="text-xs font-bold text-sky-700">+{customersModule?.trend || 12}%</span>
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-slate-800 mb-1">{customersModule?.count || 0}</div>
              <div className="text-xs sm:text-sm text-slate-600 font-medium">Total Customers</div>
              <div className="text-xs text-sky-600 mt-1 sm:mt-2 truncate">{customersModule?.subtitle}</div>
            </div>
            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
            </div>
          </div>

          {/* Leads Card */}
          <div
            onClick={() => onNavigate('leads')}
            className="group relative bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 cursor-pointer hover:shadow-xl hover:shadow-rose-500/10 transition-all duration-300 border border-rose-100 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-rose-200/40 to-transparent rounded-full -translate-y-12 translate-x-12 sm:-translate-y-16 sm:translate-x-16"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
                  <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-rose-100 rounded-full">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-rose-600" />
                  <span className="text-xs font-bold text-rose-700">+{teamModule?.trend || 5}%</span>
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-slate-800 mb-1">{teamModule?.count || 0}</div>
              <div className="text-xs sm:text-sm text-slate-600 font-medium">Total Leads</div>
              <div className="text-xs text-rose-600 mt-1 sm:mt-2 truncate">{teamModule?.subtitle}</div>
            </div>
            <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Activity Overview Chart */}
          <div className="lg:col-span-8 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6 lg:mb-8">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-800">Activity Overview</h3>
                <p className="text-xs sm:text-sm text-slate-500">Today's activity trends</p>
              </div>
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs sm:text-sm text-slate-600">Forms</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <span className="text-xs sm:text-sm text-slate-600">Issues</span>
                </div>
                <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors hidden sm:block">
                  <MoreHorizontal className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="relative h-72">
              <svg className="w-full h-full" viewBox="0 0 800 250" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="formsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="issuesGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {[0, 62.5, 125, 187.5, 250].map((y, i) => (
                  <g key={y}>
                    <line x1="0" y1={y} x2="800" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x="-10" y={y + 4} className="text-xs fill-slate-400" textAnchor="end">
                      {Math.round((maxValue / 4) * (4 - i))}
                    </text>
                  </g>
                ))}

                <path
                  d={formsPathFilled}
                  fill="url(#formsGradient)"
                />
                <path
                  d={formsPathStroke}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                <path
                  d={issuesPathFilled}
                  fill="url(#issuesGradient)"
                />
                <path
                  d={issuesPathStroke}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {formsData.length > 0 && formsData[formsData.length - 1] > 0 && (
                  <circle
                    cx={800}
                    cy={250 - 30 - (formsData[formsData.length - 1] / maxValue) * (250 - 30)}
                    r="6"
                    fill="#10b981"
                    stroke="white"
                    strokeWidth="3"
                  />
                )}
              </svg>

              <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-xl">
                  {formsModule?.count || 0} Submissions
                </div>
              </div>

              <div className="flex justify-between mt-4 px-4 text-xs text-slate-500">
                {monthlyData.length > 0 ? (
                  monthlyData.map((data) => (
                    <span key={data.month}>{data.month}</span>
                  ))
                ) : (
                  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => (
                    <span key={month}>{month}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Activity Distribution */}
          <div className="lg:col-span-4 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-800">Distribution</h3>
                <p className="text-xs text-slate-500">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
              </div>
              <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors hidden sm:block">
                <MoreHorizontal className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="relative w-48 h-48 mx-auto mb-6">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="12" />

                {totalActivity > 0 && (
                  <>
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="12"
                      strokeDasharray={`${(totalForms / totalActivity) * 251.2} 251.2`}
                      strokeLinecap="round"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#0ea5e9"
                      strokeWidth="12"
                      strokeDasharray={`${(totalCustomersInTerritories / totalActivity) * 251.2} 251.2`}
                      strokeDashoffset={`-${(totalForms / totalActivity) * 251.2}`}
                      strokeLinecap="round"
                    />
                  </>
                )}
              </svg>

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-800">{totalActivity}</div>
                  <div className="text-xs text-slate-500">Total</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
                  <span className="text-sm text-slate-700">Form Activities</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{totalActivity > 0 ? Math.round((totalForms / totalActivity) * 100) : 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-sky-500"></div>
                  <span className="text-sm text-slate-700">Customers</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{totalActivity > 0 ? Math.round((totalCustomersInTerritories / totalActivity) * 100) : 0}%</span>
              </div>
            </div>
          </div>

          {/* Territory Performance */}
          <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-800">Territory Performance</h3>
                <p className="text-xs sm:text-sm text-slate-500">Activity breakdown by territory</p>
              </div>
              <button
                onClick={() => setShowTerritoryModal(true)}
                className="hidden sm:flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {territoryData.length > 0 ? (
              <div className="space-y-4">
                {territoryData
                  .sort((a, b) => b.formCount - a.formCount)
                  .slice(0, 5)
                  .map((territory, index) => {
                    const maxActivity = Math.max(...territoryData.map(r => r.formCount), 1);
                    const percentage = Math.round((territory.formCount / maxActivity) * 100);
                    const colors = ['from-emerald-500 to-teal-500', 'from-sky-500 to-blue-500', 'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500', 'from-violet-500 to-purple-500'];

                    return (
                      <div key={territory.id} className="group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[index % colors.length]} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                              {String(index + 1).padStart(2, '0')}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{territory.name}</div>
                              <div className="text-xs text-slate-500">{territory.customerCount} customers</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-800">{territory.formCount}</div>
                            <div className="text-xs text-slate-500">activities</div>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${colors[index % colors.length]} rounded-full transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No territory data available</p>
                  <p className="text-xs mt-1">Create territories in settings to see performance</p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions & Recent Activity */}
          <div className="lg:col-span-5 space-y-4 sm:space-y-6">
            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl"></div>

              <div className="relative z-10">
                <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    onClick={() => onNavigate('forms')}
                    className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 hover:bg-white/10 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-emerald-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-white text-center sm:text-left">New Form</span>
                  </button>
                  <button
                    onClick={() => onNavigate('issue_tracker')}
                    className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 hover:bg-white/10 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-amber-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-white text-center sm:text-left">Report Issue</span>
                  </button>
                  <button
                    onClick={() => onNavigate('customers')}
                    className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 hover:bg-white/10 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-sky-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-white text-center sm:text-left">Add Customer</span>
                  </button>
                  <button
                    onClick={() => onNavigate('my_team')}
                    className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 hover:bg-white/10 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-rose-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-white text-center sm:text-left">View Team</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Module Status */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4">Module Status</h3>
              <div className="space-y-3">
                {moduleMetrics.map((module) => (
                  <div
                    key={module.name}
                    onClick={() => onNavigate(module.name)}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${module.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                      <span className="text-sm font-medium text-slate-700">{module.displayName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{module.count}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Territory Performance Modal */}
      <TerritoryPerformanceModal
        isOpen={showTerritoryModal}
        onClose={() => setShowTerritoryModal(false)}
        territoryData={territoryData}
      />
    </div>
  );
}
