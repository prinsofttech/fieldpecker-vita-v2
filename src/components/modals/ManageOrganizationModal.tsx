import { useState, useEffect } from 'react';
import { X, Users, Package, Activity, Trash2, Edit2, Building2, TrendingUp, Calendar, Hash, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { CreateUserModal } from './CreateUserModal';
import { useToast } from '../../contexts/ToastContext';

interface Organization {
  id: string;
  name: string;
  subscription_tier: string;
  status: string;
  created_at: string;
  slug: string;
  logo_url: string | null;
  max_users: number;
  max_customers: number;
  max_modules: number;
  total_users: number;
  total_customers: number;
  enabled_modules_count: number;
}

interface OrgUser {
  id: string;
  full_name: string;
  email: string;
  status: string;
  role: {
    display_name: string;
  };
}

interface ManageOrganizationModalProps {
  organizationId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function ManageOrganizationModal({ organizationId, onClose, onUpdate }: ManageOrganizationModalProps) {
  const { showSuccess, showError, confirm } = useToast();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    subscription_tier: '',
    status: '',
    logo_url: '',
    max_users: 0,
    max_customers: 0,
    max_modules: 0,
  });
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    enabledModules: 0,
    recentActivity: 0,
  });

  useEffect(() => {
    loadOrganizationDetails();
  }, [organizationId]);

  const loadOrganizationDetails = async () => {
    try {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (orgError) throw orgError;

      setOrganization(orgData);
      setEditForm({
        name: orgData.name,
        subscription_tier: orgData.subscription_tier,
        status: orgData.status,
        logo_url: orgData.logo_url || '',
        max_users: orgData.max_users || 10,
        max_customers: orgData.max_customers || 5,
        max_modules: orgData.max_modules || 5,
      });

      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email, status, role:roles(display_name)')
        .eq('org_id', organizationId);

      setUsers(usersData || []);

      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', organizationId);

      const { count: activeUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', organizationId)
        .eq('status', 'active');

      const { count: enabledModules } = await supabase
        .from('org_modules')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', organizationId)
        .eq('is_enabled', true);

      const { count: recentActivity } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', organizationId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        enabledModules: enabledModules || 0,
        recentActivity: recentActivity || 0,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load organization details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setError('');
    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name: editForm.name,
          subscription_tier: editForm.subscription_tier,
          status: editForm.status,
          logo_url: editForm.logo_url || null,
          max_users: editForm.max_users,
          max_customers: editForm.max_customers,
          max_modules: editForm.max_modules,
        })
        .eq('id', organizationId);

      if (updateError) throw updateError;

      await loadOrganizationDetails();
      setIsEditing(false);
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to update organization');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmed = await confirm('Delete User', 'Are you sure you want to delete this user?');
    if (!confirmed) return;

    try {
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteError) throw deleteError;

      await loadOrganizationDetails();
      showSuccess('User Deleted', 'The user has been deleted successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
      showError('Delete Failed', err.message || 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!organization) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-[#B1D003]/10 text-[#015324]';
      case 'trial': return 'bg-[#015324]/10 text-[#015324]';
      case 'suspended': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'basic': return 'bg-amber-100 text-amber-700';
      case 'professional': return 'bg-violet-100 text-violet-700';
      case 'enterprise': return 'bg-pink-100 text-pink-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl shadow-2xl max-w-6xl w-full">
          <div className="bg-white rounded-t-2xl border-b border-slate-200 px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 w-16 h-16 flex items-center justify-center overflow-hidden">
                  {organization.logo_url ? (
                    <img
                      src={organization.logo_url}
                      alt={`${organization.name} logo`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {isEditing ? 'Edit Organization' : organization.name}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Organization Management</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#015324] hover:bg-[#014a20] text-white rounded-lg transition-all shadow-md hover:shadow-lg font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-slate-600" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-8 max-h-[calc(100vh-200px)] overflow-y-auto">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {isEditing ? (
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Basic Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Organization Name
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Logo URL
                      </label>
                      <input
                        type="text"
                        value={editForm.logo_url}
                        onChange={(e) => setEditForm({ ...editForm, logo_url: e.target.value })}
                        placeholder="https://example.com/logo.png"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                      />
                      <p className="text-xs text-slate-500 mt-1">Enter a URL to the organization's logo image</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Subscription Tier
                        </label>
                        <select
                          value={editForm.subscription_tier}
                          onChange={(e) => setEditForm({ ...editForm, subscription_tier: e.target.value })}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                        >
                          <option value="basic">Basic</option>
                          <option value="professional">Professional</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Status
                        </label>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                        >
                          <option value="active">Active</option>
                          <option value="trial">Trial</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Resource Limits</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Max Users
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={editForm.max_users}
                        onChange={(e) => setEditForm({ ...editForm, max_users: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Max Customers
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={editForm.max_customers}
                        onChange={(e) => setEditForm({ ...editForm, max_customers: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Max Modules
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={editForm.max_modules}
                        onChange={(e) => setEditForm({ ...editForm, max_modules: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditForm({
                        name: organization.name,
                        subscription_tier: organization.subscription_tier,
                        status: organization.status,
                        logo_url: organization.logo_url || '',
                        max_users: organization.max_users,
                        max_customers: organization.max_customers,
                        max_modules: organization.max_modules,
                      });
                    }}
                    className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    className="flex-1 px-6 py-3 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-all font-medium shadow-md hover:shadow-lg"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  <MetricCard
                    title="Total Users"
                    value={organization.total_users}
                    max={organization.max_users}
                    subtitle={`${stats.activeUsers} active`}
                    color="from-amber-400 to-orange-500"
                    icon={Users}
                  />
                  <MetricCard
                    title="Customers"
                    value={organization.total_customers}
                    max={organization.max_customers}
                    subtitle="Customer accounts"
                    color="from-[#B1D003] to-[#014a20]"
                    icon={Activity}
                  />
                  <MetricCard
                    title="Modules"
                    value={organization.enabled_modules_count}
                    max={organization.max_modules}
                    subtitle="Enabled modules"
                    color="from-violet-400 to-purple-600"
                    icon={Package}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-600 mb-4">Organization Details</h3>
                    <div className="space-y-4">
                      <DetailRow icon={Building2} label="Name" value={organization.name} />
                      <DetailRow icon={Hash} label="Slug" value={organization.slug} mono />
                      <DetailRow icon={Calendar} label="Created" value={new Date(organization.created_at).toLocaleDateString()} />
                      <DetailRow
                        icon={TrendingUp}
                        label="Tier"
                        value={
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getTierColor(organization.subscription_tier)}`}>
                            {organization.subscription_tier}
                          </span>
                        }
                      />
                      <DetailRow
                        icon={Activity}
                        label="Status"
                        value={
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(organization.status)}`}>
                            {organization.status}
                          </span>
                        }
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-600 mb-4">Activity Overview</h3>
                    <div className="space-y-4">
                      <ActivityStat label="Total Users" value={stats.totalUsers} />
                      <ActivityStat label="Active Users" value={stats.activeUsers} />
                      <ActivityStat label="Enabled Modules" value={stats.enabledModules} />
                      <ActivityStat label="Recent Activity (24h)" value={stats.recentActivity} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Organization Users</h3>
                      <p className="text-sm text-slate-500 mt-1">{users.length} total members</p>
                    </div>
                    <button
                      onClick={() => setShowCreateUserModal(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-[#B1D003] hover:bg-[#9ab803] text-white rounded-lg transition-all font-medium text-sm shadow-md"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add User
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {users.length > 0 ? (
                      <table className="w-full">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Name
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Email
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Role
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="text-sm font-medium text-slate-800">{user.full_name}</p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm text-slate-600">{user.email}</p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm text-slate-600">{user.role?.display_name}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    user.status === 'active'
                                      ? 'bg-[#B1D003]/10 text-[#015324]'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {user.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete user"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-12 text-center">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-medium">No users in this organization yet</p>
                        <p className="text-sm text-slate-500 mt-1">Users will appear here once added</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateUserModal && (
        <CreateUserModal
          onClose={() => setShowCreateUserModal(false)}
          onSuccess={() => {
            setShowCreateUserModal(false);
            loadOrganizationDetails();
          }}
          preselectedOrgId={organizationId}
        />
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  max: number;
  subtitle: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

function MetricCard({ title, value, max, subtitle, color, icon: Icon }: MetricCardProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-600">{title}</h3>
        <div className={`p-2 bg-gradient-to-br ${color} rounded-lg shadow-md`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold text-slate-800">{value}</span>
        <span className="text-sm text-slate-500">/ {max}</span>
      </div>
      <div className="mb-2">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

interface DetailRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

function DetailRow({ icon: Icon, label, value, mono }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <div className={mono ? 'font-mono text-sm text-slate-800' : 'text-sm font-medium text-slate-800'}>
        {value}
      </div>
    </div>
  );
}

interface ActivityStatProps {
  label: string;
  value: number;
}

function ActivityStat({ label, value }: ActivityStatProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-lg font-bold text-slate-800">{value}</span>
    </div>
  );
}
