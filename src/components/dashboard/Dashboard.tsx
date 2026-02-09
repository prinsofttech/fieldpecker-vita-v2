import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { User } from '../../lib/supabase/types';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { DashboardLayout } from '../layout/DashboardLayout';
import { RegionsManager } from '../organization/RegionsManager';
import { BranchesManager } from '../organization/BranchesManager';
import { DepartmentsManager } from '../organization/DepartmentsManager';
import { UserManagement } from '../organization/UserManagement';
import { CustomersManager } from '../organization/CustomersManager';
import { ModulesManager } from '../organization/ModulesManager';
import { RolesManager } from '../organization/RolesManager';
import { LeadStatusesManager } from '../organization/LeadStatusesManager';
import { LeadRanksManager } from '../organization/LeadRanksManager';
import { IssueStatusesManager } from '../organization/IssueStatusesManager';
import { IssueCategoriesManager } from '../organization/IssueCategoriesManager';
import { MyTeamDashboard } from '../team/MyTeamDashboard';
import { ModulePlaceholder } from '../modules/ModulePlaceholder';
import { ClientDashboard } from './ClientDashboard';
import { SessionHistoryDashboard } from '../session/SessionHistoryDashboard';
import { AdminSessionMonitor } from '../session/AdminSessionMonitor';
import { SessionService } from '../../lib/session/session-service';
import { SettingsPage } from '../settings/SettingsPage';
import { AdminSettings } from '../settings/AdminSettings';
import { SessionConfigManager } from '../settings/SessionConfigManager';
import { FormsManagement } from '../forms/FormsManagement';
import { AgentFormView } from '../forms/AgentFormView';
import { FormsModuleDashboard } from '../forms/FormsModuleDashboard';
import { IssueTrackerDashboard } from '../issues/IssueTrackerDashboard';
import { HeatMapDashboard } from '../heatmap/HeatMapDashboard';
import { LeadsDashboard } from '../leads/LeadsDashboard';
import { ReportsDashboard } from '../reports/ReportsDashboard';
import { AnalyticsDashboard } from '../analytics/AnalyticsDashboard';
import { CheckInDashboard } from '../checkin/CheckInDashboard';

export function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [activeModules, setActiveModules] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalRegions: 0,
    totalBranches: 0,
    totalDepartments: 0,
    totalCustomers: 0,
    recentActivity: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: { session: authSession } } = await supabase.auth.getSession();

      if (!authUser || !authSession) {
        console.log('No authenticated user or session, redirecting to login');
        await supabase.auth.signOut();
        window.location.href = '/';
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*, role:roles(*), organization:organizations(*)')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!userData) {
        console.log('No user data found, logging out');
        await supabase.auth.signOut();
        window.location.href = '/';
        return;
      }

      setUser(userData);

      try {
        const { data: exactMatch } = await supabase
          .from('user_sessions')
          .select('id')
          .eq('user_id', authUser.id)
          .eq('session_token', authSession.access_token)
          .eq('is_active', true)
          .maybeSingle();

        let sessionId = exactMatch?.id;

        if (!sessionId) {
          sessionId = await SessionService.createSession(authUser.id);
        }

        if (sessionId) {
          SessionService.startActivityTracking();
          await SessionService.startSessionMonitoring(sessionId);
        }
      } catch (sessionError) {
        console.error('Session tracking error:', sessionError);
      }

      if (userData.role?.name === 'super_admin') {
        setLoading(false);
        return;
      }

      const [modulesResult, usersCount, activeUsersCount, regionsCount, branchesCount, departmentsCount, customersCount, activityCount] = await Promise.all([
        supabase
          .from('org_modules')
          .select('modules(name, display_name, icon)')
          .eq('org_id', userData.org_id)
          .eq('is_enabled', true),
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userData.org_id),
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userData.org_id)
          .eq('status', 'active'),
        supabase
          .from('regions')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userData.org_id),
        supabase
          .from('branches')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userData.org_id),
        supabase
          .from('departments')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userData.org_id),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userData.org_id),
        supabase
          .from('audit_logs')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', userData.org_id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ]);

      if (modulesResult.data) {
        setActiveModules(modulesResult.data.map((item: any) => item.modules));
      }

      setStats({
        totalUsers: usersCount.count || 0,
        activeUsers: activeUsersCount.count || 0,
        totalRegions: regionsCount.count || 0,
        totalBranches: branchesCount.count || 0,
        totalDepartments: departmentsCount.count || 0,
        totalCustomers: customersCount.count || 0,
        recentActivity: activityCount.count || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-[#015324] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user?.role?.name === 'super_admin') {
    return <SuperAdminDashboard />;
  }

  const renderContent = () => {
    if (!user) return null;

    const isClientAdmin = user.role?.name === 'client_admin';

    // Admin Settings - only accessible to client_admin
    if (currentView === 'admin_settings' && isClientAdmin) {
      return <AdminSettings onNavigate={setCurrentView} orgId={user.org_id} />;
    }

    // Admin Management Views - accessible through Admin Settings
    if (isClientAdmin) {
      switch (currentView) {
        case 'regions':
          return <RegionsManager orgId={user.org_id} />;
        case 'branches':
          return <BranchesManager orgId={user.org_id} />;
        case 'departments':
          return <DepartmentsManager orgId={user.org_id} />;
        case 'users':
          return <UserManagement orgId={user.org_id} />;
        case 'roles':
          return <RolesManager />;
        case 'lead_statuses':
          return <LeadStatusesManager />;
        case 'lead_ranks':
          return <LeadRanksManager />;
        case 'issue_statuses':
          return <IssueStatusesManager />;
        case 'issue_categories':
          return <IssueCategoriesManager />;
        case 'modules':
          return <ModulesManager orgId={user.org_id} />;
        case 'sessions':
          return <AdminSessionMonitor orgId={user.org_id} />;
        case 'session_config':
          return <SessionConfigManager orgId={user.org_id} />;
        case 'forms_management':
          return <FormsManagement orgId={user.org_id} />;
      }
    }

    // Unified routing for all users (including client_admin)
    switch (currentView) {
      case 'check_in':
        return <CheckInDashboard orgId={user.org_id} userId={user.id} userRole={user.role?.name} />;
      case 'forms':
        return <FormsModuleDashboard userId={user.id} orgId={user.org_id} />;
      case 'issue_tracker':
        return <IssueTrackerDashboard />;
      case 'heat_map':
        return <HeatMapDashboard />;
      case 'leads':
      case 'leads_sales':
        return <LeadsDashboard orgId={user.org_id} userId={user.id} userRole={user.role?.name} />;
      case 'reports':
        return <ReportsDashboard />;
      case 'analytics':
        return <AnalyticsDashboard orgId={user.org_id} organizationName={user.organization?.name || 'Organization'} userRole={user.role?.name} />;
      case 'my_forms':
        return <AgentFormView agentId={user.id} />;
      case 'team_forms':
        return <FormsModuleDashboard userId={user.id} orgId={user.org_id} />;
      case 'my_team':
        return <MyTeamDashboard userId={user.id} orgId={user.org_id} isAdmin={isClientAdmin} />;
      case 'customers':
        return <CustomersManager orgId={user.org_id} />;
      case 'my-sessions':
        return <SessionHistoryDashboard userId={user.id} />;
      case 'settings':
        return <SettingsPage user={user} onNavigate={setCurrentView} />;
      case 'dashboard':
        return <ClientDashboard user={user} onNavigate={setCurrentView} />;
      default:
        const module = activeModules.find(m => m.name === currentView);
        if (module) {
          return <ModulePlaceholder moduleName={module.name} displayName={module.display_name} />;
        }
        return <ClientDashboard user={user} onNavigate={setCurrentView} />;
    }
  };

  return (
    <DashboardLayout
      user={user}
      currentView={currentView}
      onNavigate={setCurrentView}
    >
      <div className="p-8">
        {renderContent()}
      </div>
    </DashboardLayout>
  );
}
