import { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, Users, AlertTriangle, X, Save } from 'lucide-react';
import { RoleService, Role, CreateRoleData, UpdateRoleData } from '../../lib/roles/role-service';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { supabase } from '../../lib/supabase/client';

export function RolesManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    checkUserRole();
    loadRoles();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role:roles(name)')
          .eq('id', user.id)
          .single();

        if (userData?.role?.name === 'super_admin') {
          setIsSuperAdmin(true);
        }
      }
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  const loadRoles = async () => {
    try {
      setLoading(true);
      const data = await RoleService.getAllRoles();
      setRoles(data);

      const counts: Record<string, number> = {};
      for (const role of data) {
        counts[role.id] = await RoleService.getRoleUsersCount(role.id);
      }
      setUserCounts(counts);
    } catch (error: any) {
      showToast('error', 'Failed to load roles', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (data: CreateRoleData) => {
    try {
      const exists = await RoleService.checkRoleNameExists(data.name);
      if (exists) {
        showToast('error', 'A role with this name already exists');
        return;
      }

      await RoleService.createRole(data);
      showToast('success', 'Role created successfully');
      setShowCreateModal(false);
      loadRoles();
    } catch (error: any) {
      showToast('error', 'Failed to create role', error.message);
    }
  };

  const handleUpdateRole = async (data: UpdateRoleData) => {
    if (!selectedRole) return;

    try {
      await RoleService.updateRole(selectedRole.id, data);
      showToast('success', 'Role updated successfully');
      setShowEditModal(false);
      setSelectedRole(null);
      loadRoles();
    } catch (error: any) {
      showToast('error', 'Failed to update role', error.message);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;

    try {
      await RoleService.deleteRole(selectedRole.id);
      showToast('success', 'Role deleted successfully');
      setShowDeleteModal(false);
      setSelectedRole(null);
      loadRoles();
    } catch (error: any) {
      showToast('error', 'Failed to delete role', error.message);
    }
  };

  const isSystemRole = (roleName: string) => {
    return ['super_admin', 'client_admin', 'field_agent'].includes(roleName);
  };

  const displayedRoles = isSuperAdmin
    ? roles
    : roles.filter(role => role.name !== 'super_admin');

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Role Management</h1>
            <p className="text-slate-600 mt-1">Define and manage user roles and permissions</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-5 h-5" />
          Create Role
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedRoles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              userCount={userCounts[role.id] || 0}
              isSystemRole={isSystemRole(role.name)}
              onEdit={() => {
                setSelectedRole(role);
                setShowEditModal(true);
              }}
              onDelete={() => {
                setSelectedRole(role);
                setShowDeleteModal(true);
              }}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <RoleFormModal
          title="Create New Role"
          onSave={handleCreateRole}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {showEditModal && selectedRole && (
        <RoleFormModal
          title="Edit Role"
          role={selectedRole}
          isSystemRole={isSystemRole(selectedRole.name)}
          onSave={handleUpdateRole}
          onClose={() => {
            setShowEditModal(false);
            setSelectedRole(null);
          }}
        />
      )}

      {showDeleteModal && selectedRole && (
        <ConfirmationModal
          isOpen={showDeleteModal}
          title="Delete Role"
          message={`Are you sure you want to delete the role "${selectedRole.display_name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDeleteRole}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedRole(null);
          }}
          type="danger"
        />
      )}
    </div>
  );
}

interface RoleCardProps {
  role: Role;
  userCount: number;
  isSystemRole: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function RoleCard({ role, userCount, isSystemRole, onEdit, onDelete }: RoleCardProps) {
  const levelColors: Record<number, { bg: string; text: string; badge: string }> = {
    0: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
    1: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
    2: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
    3: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
    4: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
    5: { bg: 'bg-slate-50', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-800' },
  };

  const colors = levelColors[role.level] || levelColors[5];

  return (
    <div className={`${colors.bg} rounded-2xl p-6 border-2 border-slate-200 hover:border-slate-300 transition-all`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 ${colors.badge} rounded-xl`}>
          <Shield className={`w-6 h-6 ${colors.text}`} />
        </div>
        {!isSystemRole && (
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="p-2 hover:bg-white/80 rounded-lg transition-colors"
              title="Edit role"
            >
              <Edit2 className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={onDelete}
              disabled={userCount > 0}
              className={`p-2 rounded-lg transition-colors ${
                userCount > 0
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-white/80'
              }`}
              title={userCount > 0 ? 'Cannot delete role with users' : 'Delete role'}
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-2">
        {role.display_name}
        {isSystemRole && (
          <span className="ml-2 text-xs font-medium px-2 py-1 bg-slate-200 text-slate-700 rounded">
            System
          </span>
        )}
      </h3>

      {role.description && (
        <p className="text-sm text-slate-600 mb-4 line-clamp-2">
          {role.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            {userCount} {userCount === 1 ? 'user' : 'users'}
          </span>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 ${colors.badge} rounded-full`}>
          Level {role.level}
        </span>
      </div>
    </div>
  );
}

interface RoleFormModalProps {
  title: string;
  role?: Role;
  isSystemRole?: boolean;
  onSave: (data: CreateRoleData | UpdateRoleData) => void;
  onClose: () => void;
}

function RoleFormModal({ title, role, isSystemRole = false, onSave, onClose }: RoleFormModalProps) {
  const [formData, setFormData] = useState({
    name: role?.name || '',
    display_name: role?.display_name || '',
    level: role?.level || 3,
    description: role?.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.display_name.trim()) {
      alert('Please enter a display name');
      return;
    }

    if (!role && !formData.name.trim()) {
      alert('Please enter a role name');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {!role && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Role Name (Internal) *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., regional_manager"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Lowercase, no spaces (will be auto-formatted)
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Display Name *
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="e.g., Regional Manager"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              disabled={isSystemRole}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Hierarchy Level *
            </label>
            <select
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={isSystemRole}
            >
              <option value={0}>Level 0 - System Admin</option>
              <option value={1}>Level 1 - Organization Admin</option>
              <option value={2}>Level 2 - Executive/HQ</option>
              <option value={3}>Level 3 - Manager</option>
              <option value={4}>Level 4 - Supervisor</option>
              <option value={5}>Level 5 - Field Agent</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Lower numbers = higher authority
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role's responsibilities and access level..."
              rows={4}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {isSystemRole && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">System Role</p>
                <p className="text-sm text-amber-700 mt-1">
                  Some fields cannot be modified for system roles.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {role ? 'Update' : 'Create'} Role
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
