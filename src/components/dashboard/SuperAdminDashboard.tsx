import { useEffect, useState } from 'react';
import { Building2, Users, Shield, Activity, Plus, Settings, Package, TrendingUp, BarChart3, Calendar, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import type { User } from '../../lib/supabase/types';
import { CreateOrganizationModal } from '../modals/CreateOrganizationModal';
import { ManageOrganizationModal } from '../modals/ManageOrganizationModal';
import { CreateUserModal } from '../modals/CreateUserModal';

interface Organization {
  id: string;
  name: string;
  subscription_tier: string;
  status: string;
  created_at: string;
  max_users: number;
  max_customers: number;
  max_modules: number;
  total_users: number;
  total_customers: number;
  enabled_modules_count: number;
  _count?: {
    users: number;
    active_users: number;
    enabled_modules: number;
  };
}

interface SystemStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalUsers: number;
  activeUsers: number;
  totalModules: number;
  recentActivity: number;
}

export function SuperAdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalOrganizations: 0,
    activeOrganizations: 0,
    totalUsers: 0,
    activeUsers: 0,
    totalModules: 0,
    recentActivity: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  useEffect(() => {
    loadSuperAdminData();
  }, []);

  const loadSuperAdminData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        window.location.href = '/login';
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*, role:roles(*)')
        .eq('id', authUser.id)
        .single();

      if (!userData) return;
      setUser(userData);

      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (orgsError) {
        console.error('Error loading organizations:', orgsError);
      }

      if (orgsData) {
        const orgsWithCounts = await Promise.all(
          orgsData.map(async (org) => {
            const { count: totalUsers } = await supabase
              .from('users')
              .select('*', { count: 'exact', head: true })
              .eq('org_id', org.id);

            const { count: activeUsers } = await supabase
              .from('users')
              .select('*', { count: 'exact', head: true })
              .eq('org_id', org.id)
              .eq('status', 'active');

            const { count: enabledModules } = await supabase
              .from('org_modules')
              .select('*', { count: 'exact', head: true })
              .eq('org_id', org.id)
              .eq('is_enabled', true);

            return {
              ...org,
              _count: {
                users: totalUsers || 0,
                active_users: activeUsers || 0,
                enabled_modules: enabledModules || 0,
              },
            };
          })
        );

        setOrganizations(orgsWithCounts);

        const { count: totalOrgs } = await supabase
          .from('organizations')
          .select('*', { count: 'exact', head: true });

        const { count: activeOrgs } = await supabase
          .from('organizations')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        const { count: totalUsers } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true });

        const { count: activeUsers } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        const { count: totalModules } = await supabase
          .from('org_modules')
          .select('*', { count: 'exact', head: true })
          .eq('is_enabled', true);

        const { count: recentActivity } = await supabase
          .from('audit_logs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        setStats({
          totalOrganizations: totalOrgs || 0,
          activeOrganizations: activeOrgs || 0,
          totalUsers: totalUsers || 0,
          activeUsers: activeUsers || 0,
          totalModules: totalModules || 0,
          recentActivity: recentActivity || 0,
        });
      }
    } catch (error) {
      console.error('Error loading super admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'basic': return 'bg-amber-100 text-amber-700';
      case 'professional': return 'bg-violet-100 text-violet-700';
      case 'enterprise': return 'bg-pink-100 text-pink-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700';
      case 'trial': return 'bg-blue-100 text-blue-700';
      case 'suspended': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm pt-16 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-2.5 bg-[#015324] rounded-xl shadow-lg">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Super Admin Dashboard</h1>
                <p className="text-xs sm:text-sm text-slate-500">System Management & Overview</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setShowCreateUserModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#B1D003] hover:bg-[#9ab803] text-slate-800 rounded-lg transition-all font-medium shadow-md hover:shadow-lg"
              >
                <UserPlus className="w-4 h-4" />
                New User
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#015324] hover:bg-[#014a20] text-white rounded-lg transition-all font-medium shadow-md hover:shadow-lg"
              >
                <Plus className="w-4 h-4" />
                New Organization
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Business Summary</h2>
          <p className="text-sm text-slate-500">Overview of system-wide metrics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Total Organizations"
            value={stats.totalOrganizations}
            change="+20%"
            subtitle="compared to last month"
            gradient="from-[#015324] to-[#014a20]"
            icon={Building2}
          />
          <MetricCard
            title="Total Users"
            value={stats.totalUsers}
            change="+30%"
            subtitle={`${stats.activeUsers} active users`}
            gradient="from-[#B1D003] to-[#9ab803]"
            icon={Users}
          />
          <MetricCard
            title="Active Modules"
            value={stats.totalModules}
            change="+20%"
            subtitle="enabled across all orgs"
            gradient="from-[#F9C609] to-[#e0b308]"
            icon={Package}
          />
          <MetricCard
            title="Active Organizations"
            value={stats.activeOrganizations}
            change="+35%"
            subtitle="with active status"
            gradient="from-[#015324] to-[#014a20]"
            icon={TrendingUp}
          />
          <MetricCard
            title="Recent Activity"
            value={stats.recentActivity}
            change="+45%"
            subtitle="events in last 24h"
            gradient="from-[#B1D003] to-[#9ab803]"
            icon={Activity}
          />
          <MetricCard
            title="System Health"
            value={100}
            change="Optimal"
            subtitle="all systems operational"
            gradient="from-[#F9C609] to-[#e0b308]"
            icon={BarChart3}
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Organizations</h3>
              <p className="text-sm text-slate-500 mt-1">{organizations.length} total organizations</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all font-medium"
            >
              <Plus className="w-4 h-4" />
              Add New
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Modules
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600 font-medium">No organizations yet</p>
                      <p className="text-sm text-slate-500 mt-1">Create your first organization to get started</p>
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-[#015324] rounded-lg">
                            <Building2 className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{org.name}</p>
                            <p className="text-xs text-slate-500 font-mono">{org.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize ${getTierBadgeColor(org.subscription_tier)}`}>
                          {org.subscription_tier}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-800">
                            {org.total_users} / {org.max_users}
                          </span>
                          <span className="text-xs text-slate-500">
                            {org._count?.active_users || 0} active
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-800">
                            {org.enabled_modules_count} / {org.max_modules}
                          </span>
                          <span className="text-xs text-slate-500">
                            enabled
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusBadgeColor(org.status)}`}>
                          {org.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {new Date(org.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedOrgId(org.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[#015324] hover:bg-[#014a20] text-white rounded-lg transition-all font-medium"
                        >
                          <Settings className="w-4 h-4" />
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showCreateModal && (
        <CreateOrganizationModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadSuperAdminData();
          }}
        />
      )}

      {showCreateUserModal && (
        <CreateUserModal
          onClose={() => setShowCreateUserModal(false)}
          onSuccess={() => {
            setShowCreateUserModal(false);
            loadSuperAdminData();
          }}
        />
      )}

      {selectedOrgId && (
        <ManageOrganizationModal
          organizationId={selectedOrgId}
          onClose={() => setSelectedOrgId(null)}
          onUpdate={loadSuperAdminData}
        />
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number | string;
  change: string;
  subtitle: string;
  gradient: string;
  icon: React.ComponentType<{ className?: string }>;
}

function MetricCard({ title, value, change, subtitle, gradient, icon: Icon }: MetricCardProps) {
  return (
    <div className={`relative bg-gradient-to-br ${gradient} rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all overflow-hidden group`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <Icon className="w-6 h-6 text-white/90" />
          <div className="px-2.5 py-1 bg-white/20 rounded-lg backdrop-blur-sm">
            <span className="text-xs font-semibold text-white">{change}</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          <p className="text-xs text-white/70">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
