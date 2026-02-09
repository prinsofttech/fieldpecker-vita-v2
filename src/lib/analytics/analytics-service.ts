import { supabase } from '../supabase/client';

export interface DailyMetrics {
  date: string;
  formSubmissions: number;
  issuesCreated: number;
  issuesResolved: number;
  leadsCreated: number;
  leadsConverted: number;
  activeUsers: number;
}

export interface SummaryStats {
  totalForms: number;
  totalSubmissions: number;
  totalIssues: number;
  openIssues: number;
  resolvedIssues: number;
  totalLeads: number;
  convertedLeads: number;
  totalCustomers: number;
  activeUsers: number;
  conversionRate: number;
  resolutionRate: number;
  avgSubmissionsPerDay: number;
}

export interface TrendData {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ModulePerformance {
  moduleName: string;
  totalRecords: number;
  activeRecords: number;
  completedRecords: number;
  completionRate: number;
}

export interface UserActivity {
  userId: string;
  userName: string;
  email: string;
  role: string;
  formSubmissions: number;
  issuesCreated: number;
  issuesResolved: number;
  leadsCreated: number;
  sessionCount: number;
  totalActiveTime: number;
  lastActive: string;
}

export interface RegionalPerformance {
  regionId: string;
  regionName: string;
  formSubmissions: number;
  issuesCount: number;
  leadsCount: number;
  customerCount: number;
  userCount: number;
}

class AnalyticsService {
  async getDailyMetrics(orgId: string, days: number = 30): Promise<DailyMetrics[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics: DailyMetrics[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      const dateStr = date.toISOString().split('T')[0];
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [
        formSubmissionsResult,
        issuesCreatedResult,
        issuesResolvedResult,
        leadsCreatedResult,
        leadsConvertedResult,
        activeUsersResult
      ] = await Promise.all([
        supabase
          .from('form_submissions')
          .select('id, forms!inner(org_id)', { count: 'exact', head: true })
          .eq('forms.org_id', orgId)
          .gte('submitted_at', dateStr)
          .lt('submitted_at', nextDate.toISOString().split('T')[0]),
        supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .gte('created_at', dateStr)
          .lt('created_at', nextDate.toISOString().split('T')[0]),
        supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('status', 'resolved')
          .gte('updated_at', dateStr)
          .lt('updated_at', nextDate.toISOString().split('T')[0]),
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .gte('created_at', dateStr)
          .lt('created_at', nextDate.toISOString().split('T')[0]),
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('status', ['won', 'converted'])
          .gte('updated_at', dateStr)
          .lt('updated_at', nextDate.toISOString().split('T')[0]),
        supabase
          .from('user_sessions')
          .select('user_id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .gte('login_at', dateStr)
          .lt('login_at', nextDate.toISOString().split('T')[0])
      ]);

      metrics.push({
        date: dateStr,
        formSubmissions: formSubmissionsResult.count || 0,
        issuesCreated: issuesCreatedResult.count || 0,
        issuesResolved: issuesResolvedResult.count || 0,
        leadsCreated: leadsCreatedResult.count || 0,
        leadsConverted: leadsConvertedResult.count || 0,
        activeUsers: activeUsersResult.count || 0,
      });
    }

    return metrics;
  }

  async getSummaryStats(orgId: string): Promise<SummaryStats> {
    const [
      formsResult,
      submissionsResult,
      issuesResult,
      openIssuesResult,
      resolvedIssuesResult,
      leadsResult,
      convertedLeadsResult,
      customersResult,
      usersResult
    ] = await Promise.all([
      supabase
        .from('forms')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId),
      supabase
        .from('form_submissions')
        .select('id, forms!inner(org_id)', { count: 'exact', head: true })
        .eq('forms.org_id', orgId),
      supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId),
      supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('status', ['new', 'assigned', 'in_progress']),
      supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'resolved'),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('status', ['won', 'converted']),
      supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId),
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('is_active', true)
    ]);

    const totalForms = formsResult.count || 0;
    const totalSubmissions = submissionsResult.count || 0;
    const totalIssues = issuesResult.count || 0;
    const openIssues = openIssuesResult.count || 0;
    const resolvedIssues = resolvedIssuesResult.count || 0;
    const totalLeads = leadsResult.count || 0;
    const convertedLeads = convertedLeadsResult.count || 0;
    const totalCustomers = customersResult.count || 0;
    const activeUsers = usersResult.count || 0;

    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
    const resolutionRate = totalIssues > 0 ? (resolvedIssues / totalIssues) * 100 : 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { count: recentSubmissions } = await supabase
      .from('form_submissions')
      .select('id, forms!inner(org_id)', { count: 'exact', head: true })
      .eq('forms.org_id', orgId)
      .gte('submitted_at', thirtyDaysAgo.toISOString());

    const avgSubmissionsPerDay = (recentSubmissions || 0) / 30;

    return {
      totalForms,
      totalSubmissions,
      totalIssues,
      openIssues,
      resolvedIssues,
      totalLeads,
      convertedLeads,
      totalCustomers,
      activeUsers,
      conversionRate,
      resolutionRate,
      avgSubmissionsPerDay,
    };
  }

  async getTrendData(orgId: string): Promise<TrendData[]> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const [
      todaySubmissions,
      yesterdaySubmissions,
      thisWeekSubmissions,
      lastWeekSubmissions,
      todayIssues,
      yesterdayIssues,
      todayLeads,
      yesterdayLeads
    ] = await Promise.all([
      supabase
        .from('form_submissions')
        .select('id, forms!inner(org_id)', { count: 'exact', head: true })
        .eq('forms.org_id', orgId)
        .gte('submitted_at', today.toISOString()),
      supabase
        .from('form_submissions')
        .select('id, forms!inner(org_id)', { count: 'exact', head: true })
        .eq('forms.org_id', orgId)
        .gte('submitted_at', yesterday.toISOString())
        .lt('submitted_at', today.toISOString()),
      supabase
        .from('form_submissions')
        .select('id, forms!inner(org_id)', { count: 'exact', head: true })
        .eq('forms.org_id', orgId)
        .gte('submitted_at', weekAgo.toISOString()),
      supabase
        .from('form_submissions')
        .select('id, forms!inner(org_id)', { count: 'exact', head: true })
        .eq('forms.org_id', orgId)
        .gte('submitted_at', twoWeeksAgo.toISOString())
        .lt('submitted_at', weekAgo.toISOString()),
      supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', today.toISOString()),
      supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString()),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', today.toISOString()),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString())
    ]);

    const calculateTrend = (current: number, previous: number): TrendData['trend'] => {
      const change = current - previous;
      if (change > 0) return 'up';
      if (change < 0) return 'down';
      return 'stable';
    };

    const createTrendData = (metric: string, current: number, previous: number): TrendData => {
      const change = current - previous;
      const changePercent = previous > 0 ? (change / previous) * 100 : 0;
      return {
        metric,
        current,
        previous,
        change,
        changePercent,
        trend: calculateTrend(current, previous),
      };
    };

    return [
      createTrendData('Form Submissions (Day)', todaySubmissions.count || 0, yesterdaySubmissions.count || 0),
      createTrendData('Form Submissions (Week)', thisWeekSubmissions.count || 0, lastWeekSubmissions.count || 0),
      createTrendData('Issues Created (Day)', todayIssues.count || 0, yesterdayIssues.count || 0),
      createTrendData('Leads Created (Day)', todayLeads.count || 0, yesterdayLeads.count || 0),
    ];
  }

  async getModulePerformance(orgId: string): Promise<ModulePerformance[]> {
    const [formsData, issuesData, leadsData] = await Promise.all([
      Promise.all([
        supabase
          .from('forms')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId),
        supabase
          .from('forms')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('is_active', true),
        supabase
          .from('form_submissions')
          .select('id, forms!inner(org_id)', { count: 'exact', head: true })
          .eq('forms.org_id', orgId)
      ]),
      Promise.all([
        supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId),
        supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('status', ['new', 'assigned', 'in_progress']),
        supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('status', 'resolved')
      ]),
      Promise.all([
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId),
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('status', ['new', 'contacted', 'qualified', 'proposal']),
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('status', ['won', 'converted'])
      ])
    ]);

    return [
      {
        moduleName: 'Forms',
        totalRecords: formsData[0].count || 0,
        activeRecords: formsData[1].count || 0,
        completedRecords: formsData[2].count || 0,
        completionRate: formsData[0].count ? ((formsData[2].count || 0) / formsData[0].count) * 100 : 0,
      },
      {
        moduleName: 'Issues',
        totalRecords: issuesData[0].count || 0,
        activeRecords: issuesData[1].count || 0,
        completedRecords: issuesData[2].count || 0,
        completionRate: issuesData[0].count ? ((issuesData[2].count || 0) / issuesData[0].count) * 100 : 0,
      },
      {
        moduleName: 'Leads',
        totalRecords: leadsData[0].count || 0,
        activeRecords: leadsData[1].count || 0,
        completedRecords: leadsData[2].count || 0,
        completionRate: leadsData[0].count ? ((leadsData[2].count || 0) / leadsData[0].count) * 100 : 0,
      },
    ];
  }

  async getUserActivity(orgId: string, limit: number = 50): Promise<UserActivity[]> {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, role_id, roles(name)')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .limit(limit);

    if (error || !users) return [];

    const activities = await Promise.all(
      users.map(async (user) => {
        const [
          formSubmissionsResult,
          issuesCreatedResult,
          issuesResolvedResult,
          leadsCreatedResult,
          sessionsResult,
          lastSessionResult
        ] = await Promise.all([
          supabase
            .from('form_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('submitted_by', user.id),
          supabase
            .from('issues')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', user.id),
          supabase
            .from('issues')
            .select('*', { count: 'exact', head: true })
            .eq('resolved_by', user.id),
          supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', user.id),
          supabase
            .from('user_sessions')
            .select('id, duration_minutes', { count: 'exact' })
            .eq('user_id', user.id)
            .eq('org_id', orgId),
          supabase
            .from('user_sessions')
            .select('login_at')
            .eq('user_id', user.id)
            .eq('org_id', orgId)
            .order('login_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        ]);

        const totalActiveTime = sessionsResult.data?.reduce((sum, session) => {
          return sum + (session.duration_minutes || 0);
        }, 0) || 0;

        return {
          userId: user.id,
          userName: user.full_name || 'Unknown',
          email: user.email,
          role: (user as any).roles?.name || 'Unknown',
          formSubmissions: formSubmissionsResult.count || 0,
          issuesCreated: issuesCreatedResult.count || 0,
          issuesResolved: issuesResolvedResult.count || 0,
          leadsCreated: leadsCreatedResult.count || 0,
          sessionCount: sessionsResult.count || 0,
          totalActiveTime,
          lastActive: lastSessionResult.data?.login_at || 'Never',
        };
      })
    );

    return activities.sort((a, b) => b.sessionCount - a.sessionCount);
  }

  async getRegionalPerformance(orgId: string): Promise<RegionalPerformance[]> {
    const { data: regions, error } = await supabase
      .from('regions')
      .select('id, name')
      .eq('org_id', orgId);

    if (error || !regions) return [];

    const performance = await Promise.all(
      regions.map(async (region) => {
        const [customersResult, usersResult] = await Promise.all([
          supabase
            .from('customers')
            .select('id')
            .eq('org_id', orgId)
            .eq('region_id', region.id),
          supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .eq('region_id', region.id)
        ]);

        const customerIds = customersResult.data?.map(c => c.id) || [];

        const [formSubmissionsResult, issuesResult, leadsResult] = await Promise.all([
          customerIds.length > 0
            ? supabase
                .from('form_submissions')
                .select('*', { count: 'exact', head: true })
                .in('agent_id', customerIds)
            : { count: 0 },
          customerIds.length > 0
            ? supabase
                .from('issues')
                .select('*', { count: 'exact', head: true })
                .eq('org_id', orgId)
                .in('customer_id', customerIds)
            : { count: 0 },
          supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .eq('region_id', region.id)
        ]);

        return {
          regionId: region.id,
          regionName: region.name,
          formSubmissions: formSubmissionsResult.count || 0,
          issuesCount: issuesResult.count || 0,
          leadsCount: leadsResult.count || 0,
          customerCount: customerIds.length,
          userCount: usersResult.count || 0,
        };
      })
    );

    return performance.sort((a, b) => b.formSubmissions - a.formSubmissions);
  }
}

export const analyticsService = new AnalyticsService();
