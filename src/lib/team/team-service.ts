import { supabase } from '../supabase/client';

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: {
    id: string;
    name: string;
    display_name: string;
  };
  department: {
    id: string;
    name: string;
  } | null;
  branch: {
    id: string;
    name: string;
  } | null;
  status: string;
  last_login_at: string | null;
  reports_to_user_id: string | null;
  currentSession?: {
    is_active: boolean;
    login_at: string;
  } | null;
  latestLocation?: {
    latitude: number;
    longitude: number;
    address: string;
    recorded_at: string;
  } | null;
  todayMetrics?: {
    tasks_completed: number;
    forms_submitted: number;
    customers_visited: number;
    work_hours: number;
    performance_score: number;
  } | null;
}

export interface TeamHierarchy {
  manager: TeamMember;
  directReports: TeamMember[];
  totalSubordinates: number;
}

export interface TeamMemberActivity {
  recentForms: Array<{
    id: string;
    form_name: string;
    customer_name: string;
    submitted_at: string;
    status: string;
  }>;
  recentIssues: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    created_at: string;
  }>;
  recentLeads: Array<{
    id: string;
    customer_name: string;
    status: string;
    priority: string;
    created_at: string;
  }>;
  stats: {
    totalForms: number;
    totalIssues: number;
    totalLeads: number;
    todayForms: number;
    todayIssues: number;
    todayLeads: number;
  };
}

export interface TeamMemberWithActivity extends TeamMember {
  activity?: TeamMemberActivity;
  subordinates?: TeamMemberWithActivity[];
}

export const teamService = {
  async getDirectReports(userId: string): Promise<TeamMember[]> {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        status,
        last_login_at,
        reports_to_user_id,
        role:roles(id, name, display_name),
        department:departments!users_department_id_fkey(id, name),
        branch:branches!users_branch_id_fkey(id, name)
      `)
      .eq('reports_to_user_id', userId)
      .eq('status', 'active')
      .order('full_name');

    if (error) throw error;
    return data || [];
  },

  async getAllSubordinates(userId: string): Promise<any[]> {
    const { data, error } = await supabase.rpc('get_all_subordinates', {
      manager_id: userId,
    });

    if (error) throw error;
    return data || [];
  },

  async getTeamWithMetrics(userId: string): Promise<TeamMember[]> {
    const directReports = await this.getDirectReports(userId);

    const enrichedReports = await Promise.all(
      directReports.map(async (member) => {
        const [sessionData, locationData, metricsData] = await Promise.all([
          supabase
            .from('user_sessions')
            .select('is_active, login_at')
            .eq('user_id', member.id)
            .eq('is_active', true)
            .order('login_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('user_locations')
            .select('latitude, longitude, address, recorded_at')
            .eq('user_id', member.id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('user_activity_metrics')
            .select('tasks_completed, forms_submitted, customers_visited, work_hours, performance_score')
            .eq('user_id', member.id)
            .eq('metric_date', new Date().toISOString().split('T')[0])
            .maybeSingle(),
        ]);

        return {
          ...member,
          currentSession: sessionData.data,
          latestLocation: locationData.data,
          todayMetrics: metricsData.data,
        };
      })
    );

    return enrichedReports;
  },

  async getUserHierarchyPath(userId: string): Promise<TeamMember[]> {
    const path: TeamMember[] = [];
    let currentUserId: string | null = userId;

    while (currentUserId) {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          status,
          reports_to_user_id,
          role:roles(id, name, display_name),
          department:departments!users_department_id_fkey(id, name)
        `)
        .eq('id', currentUserId)
        .maybeSingle();

      if (error || !data) break;

      path.unshift(data as any);
      currentUserId = data.reports_to_user_id;
    }

    return path;
  },

  async getOrganizationTree(orgId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        status,
        reports_to_user_id,
        role:roles(id, name, display_name),
        department:departments!users_department_id_fkey(id, name),
        branch:branches!users_branch_id_fkey(id, name)
      `)
      .eq('org_id', orgId)
      .eq('status', 'active')
      .order('full_name');

    if (error) throw error;

    const users = data || [];
    const topLevelUsers = users.filter((u) => !u.reports_to_user_id);

    const buildTree = (userId: string): any => {
      const user = users.find((u) => u.id === userId);
      if (!user) return null;

      const subordinates = users
        .filter((u) => u.reports_to_user_id === userId)
        .map((u) => buildTree(u.id))
        .filter(Boolean);

      return {
        ...user,
        subordinates,
        subordinateCount: subordinates.length,
      };
    };

    return topLevelUsers.map((u) => buildTree(u.id)).filter(Boolean);
  },

  async updateReportsTo(userId: string, reportsToUserId: string | null): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ reports_to_user_id: reportsToUserId })
      .eq('id', userId);

    if (error) throw error;

    await supabase.rpc('refresh_team_hierarchy_cache');
  },

  async refreshHierarchyCache(): Promise<void> {
    const { error } = await supabase.rpc('refresh_team_hierarchy_cache');
    if (error) throw error;
  },

  async logUserSession(userId: string, orgId: string, deviceInfo: any = {}): Promise<void> {
    const { error } = await supabase.from('user_sessions').insert({
      user_id: userId,
      org_id: orgId,
      device_info: deviceInfo,
      is_active: true,
    });

    if (error) throw error;
  },

  async endUserSession(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        logout_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;
  },

  async recordLocation(
    userId: string,
    orgId: string,
    latitude: number,
    longitude: number,
    address?: string
  ): Promise<void> {
    const { error } = await supabase.from('user_locations').insert({
      user_id: userId,
      org_id: orgId,
      latitude,
      longitude,
      address,
    });

    if (error) throw error;
  },

  async updateDailyMetrics(
    userId: string,
    orgId: string,
    metrics: {
      tasks_completed?: number;
      forms_submitted?: number;
      customers_visited?: number;
      distance_traveled?: number;
      work_hours?: number;
      performance_score?: number;
    }
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('user_activity_metrics')
      .upsert(
        {
          user_id: userId,
          org_id: orgId,
          metric_date: today,
          ...metrics,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,metric_date',
        }
      );

    if (error) throw error;
  },

  async getMemberActivity(userId: string): Promise<TeamMemberActivity> {
    const today = new Date().toISOString().split('T')[0];

    const [formsData, issuesData, leadsData] = await Promise.all([
      supabase
        .from('form_submissions')
        .select('id, form_name, customer_name, submitted_at, status')
        .eq('submitted_by_user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(5),
      supabase
        .from('issues')
        .select('id, title, priority, status, created_at')
        .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('leads')
        .select('id, customer_name, status, priority, created_at')
        .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const [totalFormsData, totalIssuesData, totalLeadsData] = await Promise.all([
      supabase
        .from('form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('submitted_by_user_id', userId),
      supabase
        .from('issues')
        .select('id', { count: 'exact', head: true })
        .or(`created_by.eq.${userId},assigned_to.eq.${userId}`),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .or(`created_by.eq.${userId},assigned_to.eq.${userId}`),
    ]);

    const [todayFormsData, todayIssuesData, todayLeadsData] = await Promise.all([
      supabase
        .from('form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('submitted_by_user_id', userId)
        .gte('submitted_at', today),
      supabase
        .from('issues')
        .select('id', { count: 'exact', head: true })
        .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
        .gte('created_at', today),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
        .gte('created_at', today),
    ]);

    return {
      recentForms: formsData.data || [],
      recentIssues: issuesData.data || [],
      recentLeads: leadsData.data || [],
      stats: {
        totalForms: totalFormsData.count || 0,
        totalIssues: totalIssuesData.count || 0,
        totalLeads: totalLeadsData.count || 0,
        todayForms: todayFormsData.count || 0,
        todayIssues: todayIssuesData.count || 0,
        todayLeads: todayLeadsData.count || 0,
      },
    };
  },

  async getAllSubordinatesWithActivity(managerId: string): Promise<TeamMemberWithActivity[]> {
    const subordinatesData = await this.getAllSubordinates(managerId);

    const enriched = await Promise.all(
      subordinatesData.map(async (member: any) => {
        const [sessionData, activity] = await Promise.all([
          supabase
            .from('user_sessions')
            .select('is_active, login_at')
            .eq('user_id', member.id)
            .eq('is_active', true)
            .order('login_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          this.getMemberActivity(member.id),
        ]);

        return {
          ...member,
          currentSession: sessionData.data,
          activity,
        };
      })
    );

    return enriched;
  },

  async getTeamHierarchyWithActivity(managerId: string): Promise<TeamMemberWithActivity[]> {
    const directReports = await this.getDirectReports(managerId);

    const enriched = await Promise.all(
      directReports.map(async (member) => {
        const [sessionData, activity, subordinates] = await Promise.all([
          supabase
            .from('user_sessions')
            .select('is_active, login_at')
            .eq('user_id', member.id)
            .eq('is_active', true)
            .order('login_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          this.getMemberActivity(member.id),
          this.getTeamHierarchyWithActivity(member.id),
        ]);

        return {
          ...member,
          currentSession: sessionData.data,
          activity,
          subordinates: subordinates.length > 0 ? subordinates : undefined,
        };
      })
    );

    return enriched;
  },
};
