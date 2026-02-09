import { useState, useEffect } from 'react';
import { X, UserPlus, Mail, User, Building2, Shield, Lock, Users, MapPin, Map, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { PasswordService } from '../../lib/security/password-service';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Role {
  id: string;
  name: string;
  display_name: string;
}

interface Manager {
  id: string;
  full_name: string;
  email: string;
  role: {
    display_name: string;
  };
}

interface Region {
  id: string;
  name: string;
  code: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  region_id: string;
}

interface CreateUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
  preselectedOrgId?: string;
}

export function CreateUserModal({ onClose, onSuccess, preselectedOrgId }: CreateUserModalProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    org_id: preselectedOrgId || '',
    role_id: '',
    reports_to_user_id: '',
    supervisor_code: '',
  });
  const [selectedTerritories, setSelectedTerritories] = useState<Set<string>>(new Set());
  const [branchesState, setBranchesState] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    loadFormData();
  }, []);

  const loadFormData = async () => {
    try {
      const { data: orgsData } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('status', 'active')
        .order('name');

      const { data: rolesData } = await supabase
        .from('roles')
        .select('id, name, display_name')
        .neq('name', 'super_admin')
        .order('display_name');

      setOrganizations(orgsData || []);
      setRoles(rolesData || []);

      if (rolesData && rolesData.length > 0 && !formData.role_id) {
        setFormData(prev => ({ ...prev, role_id: rolesData[0].id }));
      }

      if (preselectedOrgId) {
        loadManagers(preselectedOrgId);
        loadTerritoriesAndBranches(preselectedOrgId);
      }
    } catch (err: any) {
      console.error('Error loading form data:', err);
      setError('Failed to load organizations and roles');
    }
  };

  const loadManagers = async (orgId: string) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, email, role:roles(display_name)')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('full_name');

      setManagers(data || []);
    } catch (err: any) {
      console.error('Error loading managers:', err);
    }
  };

  const loadTerritoriesAndBranches = async (orgId: string) => {
    try {
      const { data: regionsData } = await supabase
        .from('regions')
        .select('id, name, code')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('name');

      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name, code, region_id')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('name');

      setRegions(regionsData || []);
      setBranches(branchesData || []);
    } catch (err: any) {
      console.error('Error loading territories and branches:', err);
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
    setLoading(true);

    try {
      if (!formData.email || !formData.password || !formData.full_name || !formData.org_id || !formData.role_id) {
        throw new Error('All fields are required');
      }

      const passwordValidation = PasswordService.validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors.join('. '));
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const territories = Array.from(selectedTerritories);
      const branchAssignments = Array.from(branchesState.entries()).map(([branchId, isEnabled]) => ({
        branch_id: branchId,
        is_enabled: isEnabled,
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
          org_id: formData.org_id,
          role_id: formData.role_id,
          reports_to_user_id: formData.reports_to_user_id || null,
          supervisor_code: formData.supervisor_code || null,
          territories,
          branches: branchAssignments,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create user');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
        <div className="bg-gradient-to-r from-[#015324] to-[#014a20] rounded-t-2xl px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Create New User</h2>
                <p className="text-sm text-white/80 mt-1">Add a user to an organization</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <User className="w-4 h-4 text-slate-400" />
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Lock className="w-4 h-4 text-slate-400" />
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                placeholder="Minimum 8 characters"
              />
              <div className="mt-2 bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-700 mb-2">Password Requirements:</p>
                <div className="grid grid-cols-2 gap-1">
                  <div className="flex items-center gap-2">
                    {formData.password.length >= 8 ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <X className="w-3 h-3 text-slate-300" />
                    )}
                    <span className={`text-xs ${formData.password.length >= 8 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      8+ characters
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/[A-Z]/.test(formData.password) ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <X className="w-3 h-3 text-slate-300" />
                    )}
                    <span className={`text-xs ${/[A-Z]/.test(formData.password) ? 'text-emerald-600' : 'text-slate-500'}`}>
                      Uppercase
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/[a-z]/.test(formData.password) ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <X className="w-3 h-3 text-slate-300" />
                    )}
                    <span className={`text-xs ${/[a-z]/.test(formData.password) ? 'text-emerald-600' : 'text-slate-500'}`}>
                      Lowercase
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/[0-9]/.test(formData.password) ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <X className="w-3 h-3 text-slate-300" />
                    )}
                    <span className={`text-xs ${/[0-9]/.test(formData.password) ? 'text-emerald-600' : 'text-slate-500'}`}>
                      Number
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <X className="w-3 h-3 text-slate-300" />
                    )}
                    <span className={`text-xs ${/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? 'text-emerald-600' : 'text-slate-500'}`}>
                      Special char
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                Organization
              </label>
              <select
                required
                value={formData.org_id}
                onChange={(e) => {
                  const newOrgId = e.target.value;
                  setFormData({ ...formData, org_id: newOrgId, reports_to_user_id: '' });
                  setSelectedTerritories(new Set());
                  setBranchesState(new Map());
                  if (newOrgId) {
                    loadManagers(newOrgId);
                    loadTerritoriesAndBranches(newOrgId);
                  }
                }}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                disabled={!!preselectedOrgId}
              >
                <option value="">Select an organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.slug})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Shield className="w-4 h-4 text-slate-400" />
                Role
              </label>
              <select
                required
                value={formData.role_id}
                onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
              >
                <option value="">Select a role</option>
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
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Shield className="w-4 h-4 text-slate-400" />
                  Supervisor Code
                </label>
                <input
                  type="text"
                  value={formData.supervisor_code}
                  onChange={(e) => setFormData({ ...formData, supervisor_code: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                  placeholder="Enter supervisor code"
                />
                <p className="text-xs text-slate-500 mt-1">Unique identifier for this supervisor/agent</p>
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Users className="w-4 h-4 text-slate-400" />
                Reports To (Manager)
              </label>
              <select
                value={formData.reports_to_user_id}
                onChange={(e) => setFormData({ ...formData, reports_to_user_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent transition-all"
                disabled={!formData.org_id}
              >
                <option value="">No manager (top level)</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name} - {manager.role?.display_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Select who this user reports to in the hierarchy</p>
            </div>

            {formData.org_id && regions.length > 0 && (
              <>
                <div className="border-t pt-6">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                    <Map className="w-4 h-4 text-slate-400" />
                    Territory Access
                    {selectedTerritories.size > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        {selectedTerritories.size} selected
                      </span>
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-3 bg-slate-50 rounded-lg border border-slate-200">
                    {regions.map((region) => (
                      <label
                        key={region.id}
                        className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 hover:border-[#015324] cursor-pointer transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTerritories.has(region.id)}
                          onChange={() => handleTerritoryToggle(region.id)}
                          className="w-4 h-4 text-[#015324] border-slate-300 rounded focus:ring-[#015324] cursor-pointer"
                        />
                        <span className="text-sm text-slate-700 font-medium">{region.name}</span>
                        <span className="text-xs text-slate-500">({region.code})</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Select territories this user can access</p>
                </div>

                {branches.length > 0 && (
                  <div className="border-t pt-6">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      Sub-Territory Access (Branches)
                      {branchesState.size > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                          {Array.from(branchesState.values()).filter(v => v).length} enabled
                        </span>
                      )}
                    </label>
                    <div className="max-h-64 overflow-y-auto p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                      {regions.map((region) => {
                        const regionBranches = branches.filter(b => b.region_id === region.id);
                        if (regionBranches.length === 0) return null;

                        return (
                          <div key={region.id} className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-2">
                              <Map className="w-3 h-3" />
                              {region.name}
                            </div>
                            <div className="space-y-2">
                              {regionBranches.map((branch) => {
                                const isSelected = branchesState.has(branch.id);
                                const isEnabled = branchesState.get(branch.id);

                                return (
                                  <div key={branch.id} className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded border border-slate-200">
                                    <label className="flex items-center gap-2 flex-1 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleBranchToggle(branch.id)}
                                        className="w-4 h-4 text-[#015324] border-slate-300 rounded focus:ring-[#015324] cursor-pointer"
                                      />
                                      <span className="text-sm text-slate-700">{branch.name}</span>
                                      <span className="text-xs text-slate-500">({branch.code})</span>
                                    </label>
                                    {isSelected && (
                                      <button
                                        type="button"
                                        onClick={() => toggleBranchEnabled(branch.id)}
                                        className={`px-3 py-1 text-xs font-medium rounded transition-all ${
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
                    <p className="text-xs text-slate-500 mt-2">
                      Select branches and enable/disable access for each one
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
