import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, UserCircle, Search, Unlock, Key, KeyRound, Lock, MoreVertical, AlertTriangle, Map as MapIcon, MapPin, UserX, UserCheck, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { OrgStructureService } from '../../lib/organization/org-structure-service';
import { LoginAttemptService } from '../../lib/security/login-attempt-service';
import { PasswordService } from '../../lib/security/password-service';
import { UserService } from '../../lib/users/user-service';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import type { User, Role, Region, Branch, Department } from '../../lib/supabase/types';

interface UserManagementProps {
  orgId: string;
}

export function UserManagement({ orgId }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTerritory, setFilterTerritory] = useState('');
  const [filterSubTerritory, setFilterSubTerritory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role_id: '',
    region_id: '',
    branch_id: '',
    department_id: '',
    reports_to_user_id: '',
    supervisor_code: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [actionMenuUserId, setActionMenuUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedTerritories, setSelectedTerritories] = useState<Set<string>>(new Set());
  const [branchesState, setBranchesState] = useState<Map<string, boolean>>(new Map());
  const [territorySearch, setTerritorySearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordVisible, setResetPasswordVisible] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Query users - explicitly specify foreign key constraints to avoid ambiguity
      const [usersRes, rolesRes, regionsRes, branchesRes, departmentsRes] = await Promise.all([
        supabase
          .from('users')
          .select('*, role:roles(*), region:regions!users_region_id_fkey(*), branch:branches!users_branch_id_fkey(*), department:departments!users_department_id_fkey(*)')
          .eq('org_id', orgId)
          .order('full_name'),
        supabase.from('roles').select('*').neq('name', 'super_admin').order('level'),
        OrgStructureService.getRegions(orgId),
        OrgStructureService.getBranches(orgId),
        OrgStructureService.getDepartments(orgId),
      ]);

      if (usersRes.error) {
        console.error('Error loading users:', usersRes.error);
        setError(`Failed to load users: ${usersRes.error.message}`);
      }

      const usersWithCounts = await Promise.all((usersRes.data || []).map(async (user) => {
        const [territoriesRes, branchesRes] = await Promise.all([
          supabase
            .from('user_territories')
            .select('id')
            .eq('user_id', user.id),
          supabase
            .from('user_branches')
            .select('id, is_enabled')
            .eq('user_id', user.id)
            .eq('is_enabled', true),
        ]);

        return {
          ...user,
          territory_count: territoriesRes.data?.length || 0,
          branch_count: branchesRes.data?.length || 0,
        };
      }));

      setUsers(usersWithCounts);
      setRoles(rolesRes.data || []);
      setRegions(regionsRes.data);
      setBranches(branchesRes.data);
      setDepartments(departmentsRes.data);
      setManagers(usersWithCounts);
    } catch (err) {
      console.error('Error in loadData:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTerritoryToggle = (territoryId: string) => {
    const newSelected = new Set(selectedTerritories);
    if (newSelected.has(territoryId)) {
      newSelected.delete(territoryId);
      const newBranchesState = new Map(branchesState);
      branches.filter(b => b.region_id === territoryId).forEach(b => {
        newBranchesState.delete(b.id);
      });
      setBranchesState(newBranchesState);
    } else {
      newSelected.add(territoryId);
    }
    setSelectedTerritories(newSelected);
  };

  const handleBranchToggle = (branchId: string) => {
    const newBranchesState = new Map(branchesState);
    if (newBranchesState.has(branchId)) {
      newBranchesState.delete(branchId);
    } else {
      newBranchesState.set(branchId, true);
    }
    setBranchesState(newBranchesState);
  };

  const toggleBranchEnabled = (branchId: string) => {
    const newBranchesState = new Map(branchesState);
    const currentValue = newBranchesState.get(branchId);
    newBranchesState.set(branchId, !currentValue);
    setBranchesState(newBranchesState);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      if (editingUser) {
        const { error } = await supabase
          .from('users')
          .update({
            full_name: formData.full_name,
            phone: formData.phone,
            role_id: formData.role_id,
            department_id: formData.department_id || null,
            reports_to_user_id: formData.reports_to_user_id || null,
            supervisor_code: formData.supervisor_code || null,
          })
          .eq('id', editingUser.id);

        if (error) {
          setError('Error updating user: ' + error.message);
          return;
        }

        // Update territories
        await supabase
          .from('user_territories')
          .delete()
          .eq('user_id', editingUser.id);

        if (selectedTerritories.size > 0) {
          const territoryInserts = Array.from(selectedTerritories).map(region_id => ({
            user_id: editingUser.id,
            region_id,
            org_id: orgId,
          }));

          await supabase
            .from('user_territories')
            .insert(territoryInserts);
        }

        // Update branches
        await supabase
          .from('user_branches')
          .delete()
          .eq('user_id', editingUser.id);

        if (branchesState.size > 0) {
          const branchInserts = Array.from(branchesState.entries()).map(([branch_id, is_enabled]) => ({
            user_id: editingUser.id,
            branch_id,
            is_enabled,
            org_id: orgId,
          }));

          await supabase
            .from('user_branches')
            .insert(branchInserts);
        }
      } else {
        if (!formData.password || formData.password.length < 8) {
          setError('Password must be at least 8 characters');
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Not authenticated');
          return;
        }

        const territories = Array.from(selectedTerritories);
        const branchAssignments = Array.from(branchesState.entries()).map(([branch_id, is_enabled]) => ({
          branch_id,
          is_enabled,
        }));

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user-admin`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            org_id: orgId,
            role_id: formData.role_id,
            reports_to_user_id: formData.reports_to_user_id || null,
            territories,
            branches: branchAssignments,
          }),
        });

        const result = await response.json();

        if (!result.success) {
          setError(result.error || 'Failed to create user');
          return;
        }

        if (formData.department_id || formData.phone) {
          await supabase
            .from('users')
            .update({
              phone: formData.phone || null,
              department_id: formData.department_id || null,
            })
            .eq('id', result.user_id);
        }
      }

      setShowModal(false);
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        full_name: '',
        phone: '',
        role_id: '',
        region_id: '',
        branch_id: '',
        department_id: '',
        reports_to_user_id: '',
      });
      setSelectedTerritories(new Set());
      setBranchesState(new Map());
      setTerritorySearch('');
      setBranchSearch('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      full_name: user.full_name,
      phone: user.phone || '',
      role_id: user.role_id,
      region_id: user.region_id || '',
      branch_id: user.branch_id || '',
      department_id: user.department_id || '',
      reports_to_user_id: (user as any).reports_to_user_id || '',
      supervisor_code: (user as any).supervisor_code || '',
    });

    // Load user's territories and branches
    try {
      const { data: userTerritories } = await supabase
        .from('user_territories')
        .select('region_id')
        .eq('user_id', user.id);

      const { data: userBranches } = await supabase
        .from('user_branches')
        .select('branch_id, is_enabled')
        .eq('user_id', user.id);

      if (userTerritories) {
        setSelectedTerritories(new Set(userTerritories.map(ut => ut.region_id)));
      }

      if (userBranches) {
        const branchMap = new Map<string, boolean>();
        userBranches.forEach(ub => {
          branchMap.set(ub.branch_id, ub.is_enabled);
        });
        setBranchesState(branchMap);
      }
    } catch (err) {
      console.error('Error loading user territories/branches:', err);
      setSelectedTerritories(new Set());
      setBranchesState(new Map());
    }

    setTerritorySearch('');
    setBranchSearch('');
    setError('');
    setShowModal(true);
  };

  const handleResetLockout = async (user: User) => {
    setActionLoading(user.id);
    try {
      await LoginAttemptService.clearLockout(user.id);
      setSuccessMessage(`Lockout cleared for ${user.full_name}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to reset lockout');
    } finally {
      setActionLoading(null);
      setActionMenuUserId(null);
    }
  };

  const handleForcePasswordChange = async (user: User) => {
    setActionLoading(user.id);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await PasswordService.forcePasswordChangeOnNextLogin(user.id, currentUser.id);
        setSuccessMessage(`${user.full_name} will be required to change password on next login`);
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to force password change');
    } finally {
      setActionLoading(null);
      setActionMenuUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setError('Not authenticated');
        return;
      }

      const result = await UserService.deleteUser(userToDelete.id, currentUser.id);

      if (!result.success) {
        setError(result.error || 'Failed to delete user');
        return;
      }

      setSuccessMessage(`${userToDelete.full_name} has been deleted successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowDeleteModal(false);
      setUserToDelete(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleSuspendUser = async (user: User) => {
    setActionLoading(user.id);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setError('Not authenticated');
        return;
      }

      const result = await UserService.deactivateUser(user.id, currentUser.id);

      if (!result.success) {
        setError(result.error || 'Failed to suspend user');
        return;
      }

      setSuccessMessage(`${user.full_name} has been suspended`);
      setTimeout(() => setSuccessMessage(''), 3000);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to suspend user');
    } finally {
      setActionLoading(null);
      setActionMenuUserId(null);
    }
  };

  const handleActivateUser = async (user: User) => {
    setActionLoading(user.id);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setError('Not authenticated');
        return;
      }

      const result = await UserService.activateUser(user.id, currentUser.id);

      if (!result.success) {
        setError(result.error || 'Failed to activate user');
        return;
      }

      setSuccessMessage(`${user.full_name} has been activated`);
      setTimeout(() => setSuccessMessage(''), 3000);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to activate user');
    } finally {
      setActionLoading(null);
      setActionMenuUserId(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !resetPassword) return;

    const validation = PasswordService.validatePassword(resetPassword);
    if (!validation.isValid) {
      setError(validation.errors.join('. '));
      return;
    }

    setResettingPassword(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: resetPasswordUser.id,
          new_password: resetPassword,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to reset password');
        return;
      }

      setShowResetPasswordModal(false);
      setResetPasswordUser(null);
      setResetPassword('');
      setResetPasswordVisible(false);
      setSuccessMessage(`Password reset for ${resetPasswordUser.full_name}. They will be required to change it on next login.`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || user.role_id === filterRole;
    const matchesDepartment = !filterDepartment || user.department_id === filterDepartment;
    const matchesStatus = !filterStatus || (user as any).status === filterStatus;
    const matchesTerritory = !filterTerritory || user.region_id === filterTerritory;
    const matchesSubTerritory = !filterSubTerritory || user.branch_id === filterSubTerritory;

    return matchesSearch && matchesRole && matchesDepartment && matchesStatus && matchesTerritory && matchesSubTerritory;
  });

  const filteredBranchesForFilter = filterTerritory
    ? branches.filter(b => b.region_id === filterTerritory)
    : branches;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-[#015324] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0 pt-16 lg:pt-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">User Management</h2>
          <p className="text-sm sm:text-base text-slate-600">Manage users and assignments</p>
        </div>
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {successMessage}
          </div>
        )}
        <button
          onClick={() => {
            setEditingUser(null);
            setSelectedTerritories(new Set());
            setBranchesState(new Map());
            setTerritorySearch('');
            setBranchSearch('');
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add User
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent text-sm"
            >
              <option value="">All Roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.display_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Department</label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent text-sm"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent text-sm"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Territory</label>
            <select
              value={filterTerritory}
              onChange={(e) => {
                setFilterTerritory(e.target.value);
                setFilterSubTerritory('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent text-sm"
            >
              <option value="">All Territories</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Sub-Territory</label>
            <select
              value={filterSubTerritory}
              onChange={(e) => setFilterSubTerritory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent text-sm"
              disabled={!filterTerritory}
            >
              <option value="">All Sub-Territories</option>
              {filteredBranchesForFilter.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Territory
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Sub-Territory
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((user) => {
                const isLocked = (user as any).status === 'locked';
                return (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isLocked ? 'bg-red-500' : 'bg-[#015324]'}`}>
                        {isLocked ? <Lock className="w-5 h-5 text-white" /> : <UserCircle className="w-6 h-6 text-white" />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{user.full_name}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-[#015324]/10 text-[#015324] rounded">
                      {user.role?.display_name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {isLocked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">
                        <Lock className="w-3 h-3" />
                        Locked
                      </span>
                    ) : user.status === 'inactive' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded">
                        <UserX className="w-3 h-3" />
                        Suspended
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {(user as any).territory_count > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        <span>{(user as any).territory_count}</span>
                        <span>territories</span>
                      </span>
                    ) : (
                      <span className="text-sm text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {(user as any).branch_count > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                        <span>{(user as any).branch_count}</span>
                        <span>enabled</span>
                      </span>
                    ) : (
                      <span className="text-sm text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {user.department?.name || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit user"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuUserId(actionMenuUserId === user.id ? null : user.id)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="More actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {actionMenuUserId === user.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-10">
                            {isLocked && (
                              <button
                                onClick={() => handleResetLockout(user)}
                                disabled={actionLoading === user.id}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-slate-700 hover:bg-slate-50 first:rounded-t-lg"
                              >
                                <Unlock className="w-4 h-4 text-green-600" />
                                Reset Lockout
                              </button>
                            )}
                            <button
                              onClick={() => handleForcePasswordChange(user)}
                              disabled={actionLoading === user.id}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-slate-700 hover:bg-slate-50"
                            >
                              <Key className="w-4 h-4 text-amber-600" />
                              Force Password Change
                            </button>
                            <button
                              onClick={() => {
                                setResetPasswordUser(user);
                                setResetPassword('');
                                setResetPasswordVisible(false);
                                setError('');
                                setShowResetPasswordModal(true);
                                setActionMenuUserId(null);
                              }}
                              disabled={actionLoading === user.id}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-slate-700 hover:bg-slate-50"
                            >
                              <KeyRound className="w-4 h-4 text-blue-600" />
                              Reset Password
                            </button>
                            {user.status === 'active' ? (
                              <button
                                onClick={() => handleSuspendUser(user)}
                                disabled={actionLoading === user.id}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-slate-700 hover:bg-slate-50"
                              >
                                <UserX className="w-4 h-4 text-orange-600" />
                                Suspend User
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivateUser(user)}
                                disabled={actionLoading === user.id}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-slate-700 hover:bg-slate-50"
                              >
                                <UserCheck className="w-4 h-4 text-green-600" />
                                Activate User
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setUserToDelete(user);
                                setShowDeleteModal(true);
                                setActionMenuUserId(null);
                              }}
                              disabled={actionLoading === user.id}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-red-600 hover:bg-red-50 last:rounded-b-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete User
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>

          {filteredUsers.length === 0 && !loading && (
            <div className="text-center py-12">
              <UserCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No users found</p>
              <p className="text-sm text-slate-500 mb-4">
                {searchTerm ? 'Try adjusting your search term' : 'Try refreshing your session'}
              </p>
              {!searchTerm && (
                <button
                  onClick={async () => {
                    await supabase.auth.refreshSession();
                    window.location.reload();
                  }}
                  className="px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors text-sm"
                >
                  Refresh Session
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">
                {editingUser ? 'Edit User' : 'Add User'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!editingUser}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent disabled:bg-slate-100"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                    placeholder="Minimum 8 characters"
                  />
                  <p className="text-xs text-slate-500 mt-1">Min 8 characters with uppercase, lowercase, number, and special character</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Role
                </label>
                <select
                  value={formData.role_id}
                  onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                >
                  <option value="">Select Role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.role_id && roles.find(r => r.id === formData.role_id)?.name &&
               ['field_supervisor', 'field_agent'].includes(roles.find(r => r.id === formData.role_id)?.name || '') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Supervisor Code
                  </label>
                  <input
                    type="text"
                    value={formData.supervisor_code}
                    onChange={(e) => setFormData({ ...formData, supervisor_code: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                    placeholder="Enter supervisor code"
                  />
                  <p className="text-xs text-slate-500 mt-1">Unique identifier for this supervisor/agent</p>
                </div>
              )}

              {regions.length > 0 && (
                <>
                  <div className="border-t pt-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                      <MapIcon className="w-4 h-4 text-slate-400" />
                      Territory Access
                      {selectedTerritories.size > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          {selectedTerritories.size} selected
                        </span>
                      )}
                    </label>
                    <div className="mb-2">
                      <input
                        type="text"
                        placeholder="Search territories..."
                        value={territorySearch}
                        onChange={(e) => setTerritorySearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                      {regions
                        .filter(region =>
                          region.name.toLowerCase().includes(territorySearch.toLowerCase()) ||
                          region.code.toLowerCase().includes(territorySearch.toLowerCase())
                        )
                        .map((region) => (
                        <label
                          key={region.id}
                          className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 hover:border-[#015324] cursor-pointer transition-all text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTerritories.has(region.id)}
                            onChange={() => handleTerritoryToggle(region.id)}
                            className="w-4 h-4 text-[#015324] border-slate-300 rounded focus:ring-[#015324] cursor-pointer"
                          />
                          <span className="text-slate-700 font-medium">{region.name}</span>
                          <span className="text-xs text-slate-500">({region.code})</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {branches.length > 0 && (
                    <div className="border-t pt-4">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        Sub-Territory Access (Branches)
                        {branchesState.size > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                            {Array.from(branchesState.values()).filter(v => v).length} enabled
                          </span>
                        )}
                      </label>
                      <div className="mb-2">
                        <input
                          type="text"
                          placeholder="Search branches..."
                          value={branchSearch}
                          onChange={(e) => setBranchSearch(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                        {regions.map((region) => {
                          const regionBranches = branches.filter(b =>
                            b.region_id === region.id &&
                            (branchSearch === '' ||
                              b.name.toLowerCase().includes(branchSearch.toLowerCase()) ||
                              b.code.toLowerCase().includes(branchSearch.toLowerCase()))
                          );
                          if (regionBranches.length === 0) return null;

                          return (
                            <div key={region.id} className="bg-white rounded-lg p-2 border border-slate-200">
                              <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                                <MapIcon className="w-3 h-3" />
                                {region.name}
                              </div>
                              <div className="space-y-1">
                                {regionBranches.map((branch) => {
                                  const isSelected = branchesState.has(branch.id);
                                  const isEnabled = branchesState.get(branch.id);

                                  return (
                                    <div key={branch.id} className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 rounded border border-slate-200">
                                      <label className="flex items-center gap-2 flex-1 cursor-pointer text-sm">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => handleBranchToggle(branch.id)}
                                          className="w-4 h-4 text-[#015324] border-slate-300 rounded focus:ring-[#015324] cursor-pointer"
                                        />
                                        <span className="text-slate-700">{branch.name}</span>
                                        <span className="text-xs text-slate-500">({branch.code})</span>
                                      </label>
                                      {isSelected && (
                                        <button
                                          type="button"
                                          onClick={() => toggleBranchEnabled(branch.id)}
                                          className={`px-2 py-0.5 text-xs font-medium rounded transition-all ${
                                            isEnabled
                                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                                          }`}
                                        >
                                          {isEnabled ? 'Enabled' : 'Disabled'}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Department
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                >
                  <option value="">None</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Reports To (Manager)
                </label>
                <select
                  value={formData.reports_to_user_id}
                  onChange={(e) => setFormData({ ...formData, reports_to_user_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                >
                  <option value="">No manager (top level)</option>
                  {managers
                    .filter((u) => !editingUser || u.id !== editingUser.id)
                    .map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.full_name} - {manager.role?.display_name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Select who this user reports to in the hierarchy</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Please wait...' : (editingUser ? 'Update' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && userToDelete && (
        <ConfirmationModal
          isOpen={showDeleteModal}
          title="Delete User"
          message={`Are you sure you want to delete ${userToDelete.full_name}? This action cannot be undone. All user data, including sessions and activity history, will be permanently removed.`}
          confirmText={deleting ? 'Deleting...' : 'Delete'}
          cancelText="Cancel"
          onConfirm={handleDeleteUser}
          onCancel={() => {
            setShowDeleteModal(false);
            setUserToDelete(null);
          }}
          type="danger"
        />
      )}

      {showResetPasswordModal && resetPasswordUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Reset Password</h3>
                  <p className="text-sm text-slate-500">{resetPasswordUser.full_name}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  This will set a temporary password. The user will be forced to change it on their next login.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Temporary Password
                </label>
                <div className="relative">
                  <input
                    type={resetPasswordVisible ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Enter temporary password"
                    className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setResetPasswordVisible(!resetPasswordVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {resetPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Min 8 characters with uppercase, lowercase, number, and special character
                </p>
                {resetPassword && (
                  <div className="mt-2">
                    {(() => {
                      const strength = PasswordService.getPasswordStrength(resetPassword);
                      return (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${(strength.score / 7) * 100}%`,
                                backgroundColor: strength.color,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium" style={{ color: strength.color }}>
                            {strength.label}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setResetPasswordUser(null);
                    setResetPassword('');
                    setResetPasswordVisible(false);
                    setError('');
                  }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resettingPassword || !resetPassword || resetPassword.length < 8}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {resettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
