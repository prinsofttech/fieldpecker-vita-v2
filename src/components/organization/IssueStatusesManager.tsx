import { useState, useEffect } from 'react';
import { Circle, Plus, Edit2, Trash2, X, Save, Eye, EyeOff, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmationModal } from '../modals/ConfirmationModal';

interface IssueStatus {
  id: string;
  org_id: string | null;
  name: string;
  display_name: string;
  color: string;
  icon: string;
  sort_order: number;
  is_default: boolean;
  is_system: boolean;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  display_name: string;
  color: string;
  icon: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
}

const COLOR_OPTIONS = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Slate', hex: '#6B7280' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Gray', hex: '#1F2937' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Lime', hex: '#84CC16' },
  { name: 'Purple', hex: '#A855F7' }
];

const ICON_OPTIONS = [
  'circle',
  'check-circle',
  'alert-circle',
  'x-circle',
  'loader',
  'pause-circle',
  'user-check',
  'tag'
];

export function IssueStatusesManager() {
  const [statuses, setStatuses] = useState<IssueStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<IssueStatus | null>(null);
  const [orgId, setOrgId] = useState<string>('');
  const { showToast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    display_name: '',
    color: '#3B82F6',
    icon: 'circle',
    description: '',
    is_active: true,
    is_default: false
  });

  useEffect(() => {
    loadOrgIdAndStatuses();
  }, []);

  const loadOrgIdAndStatuses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .single();

        if (userData?.org_id) {
          setOrgId(userData.org_id);
          await loadStatuses(userData.org_id);
        }
      }
    } catch (error: any) {
      showToast('error', 'Failed to load data', error.message);
    }
  };

  const loadStatuses = async (organizationId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('issue_statuses')
        .select('*')
        .eq('org_id', organizationId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setStatuses(data || []);
    } catch (error: any) {
      showToast('error', 'Failed to load issue statuses', error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      display_name: '',
      color: '#3B82F6',
      icon: 'circle',
      description: '',
      is_active: true,
      is_default: false
    });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.display_name) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    try {
      const maxOrder = Math.max(...statuses.map(s => s.sort_order), 0);

      const { error } = await supabase
        .from('issue_statuses')
        .insert({
          org_id: orgId,
          name: formData.name.toLowerCase().replace(/\s+/g, '_'),
          display_name: formData.display_name,
          color: formData.color,
          icon: formData.icon,
          description: formData.description || null,
          sort_order: maxOrder + 1,
          is_active: formData.is_active,
          is_default: formData.is_default,
          is_system: false
        });

      if (error) throw error;

      showToast('success', 'Issue status created successfully');
      setShowCreateModal(false);
      resetForm();
      loadStatuses(orgId);
    } catch (error: any) {
      showToast('error', 'Failed to create issue status', error.message);
    }
  };

  const handleEdit = async () => {
    if (!selectedStatus || !formData.display_name) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('issue_statuses')
        .update({
          display_name: formData.display_name,
          color: formData.color,
          icon: formData.icon,
          description: formData.description || null,
          is_active: formData.is_active,
          is_default: formData.is_default
        })
        .eq('id', selectedStatus.id);

      if (error) throw error;

      showToast('success', 'Issue status updated successfully');
      setShowEditModal(false);
      setSelectedStatus(null);
      resetForm();
      loadStatuses(orgId);
    } catch (error: any) {
      showToast('error', 'Failed to update issue status', error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedStatus) return;

    try {
      // Check if this status is being used by any issues
      const { data: issuesUsingStatus, error: checkError } = await supabase
        .from('issues')
        .select('id')
        .eq('status_id', selectedStatus.id)
        .limit(1);

      if (checkError) throw checkError;

      if (issuesUsingStatus && issuesUsingStatus.length > 0) {
        showToast(
          'error',
          'Cannot delete status',
          `"${selectedStatus.display_name}" is currently assigned to one or more issues. Please reassign those issues first.`
        );
        setShowDeleteModal(false);
        setSelectedStatus(null);
        return;
      }

      // Proceed with deletion if not in use
      const { error } = await supabase
        .from('issue_statuses')
        .delete()
        .eq('id', selectedStatus.id);

      if (error) throw error;

      showToast('success', 'Issue status deleted successfully');
      setShowDeleteModal(false);
      setSelectedStatus(null);
      loadStatuses(orgId);
    } catch (error: any) {
      showToast('error', 'Failed to delete issue status', error.message);
    }
  };

  const openEditModal = (status: IssueStatus) => {
    setSelectedStatus(status);
    setFormData({
      name: status.name,
      display_name: status.display_name,
      color: status.color,
      icon: status.icon,
      description: status.description || '',
      is_active: status.is_active,
      is_default: status.is_default
    });
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openDeleteModal = (status: IssueStatus) => {
    setSelectedStatus(status);
    setShowDeleteModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-violet-600 to-violet-700 rounded-2xl shadow-lg">
            <Circle className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Issue Status Management</h1>
            <p className="text-slate-600 mt-1">Configure issue status workflow for your organization</p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/30"
        >
          <Plus className="w-5 h-5" />
          Create Status
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : statuses.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-12 text-center">
          <Circle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Issue Statuses Yet</h3>
          <p className="text-slate-600 mb-6">Create your first issue status to get started</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Status
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {statuses.map((status) => (
            <div
              key={status.id}
              className="bg-white border-2 border-slate-200 rounded-xl p-6 hover:border-violet-300 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: status.color + '20' }}
                  >
                    <Circle className="w-5 h-5" style={{ color: status.color }} />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">{status.display_name}</span>
                    {status.is_default && (
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500 inline ml-2" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {status.is_active ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">
                  {status.description || 'No description provided'}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Key: {status.name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(status)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => openDeleteModal(status)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800">
                {showCreateModal ? 'Create Issue Status' : 'Edit Issue Status'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedStatus(null);
                  resetForm();
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {showCreateModal && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Status Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., pending_review"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Unique identifier (will be converted to lowercase with underscores)</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="e.g., Pending Review"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color.hex}
                      onClick={() => setFormData({ ...formData, color: color.hex })}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        formData.color === color.hex
                          ? 'border-slate-800 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Icon
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`px-4 py-3 border-2 rounded-lg transition-all flex items-center justify-center ${
                        formData.icon === icon
                          ? 'border-violet-600 bg-violet-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Circle className="w-5 h-5 text-slate-700" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this status means"
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Active</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Default status for new issues</span>
                </label>
              </div>

              <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
                <p className="text-sm text-violet-800 mb-2">
                  <strong>Preview:</strong>
                </p>
                <div
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ backgroundColor: formData.color + '20' }}
                >
                  <Circle className="w-4 h-4" style={{ color: formData.color }} />
                  <span className="text-sm font-semibold" style={{ color: formData.color }}>
                    {formData.display_name || 'Status Name'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedStatus(null);
                  resetForm();
                }}
                className="px-6 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? handleCreate : handleEdit}
                className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
              >
                <Save className="w-5 h-5" />
                {showCreateModal ? 'Create' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedStatus(null);
        }}
        onConfirm={handleDelete}
        title="Delete Issue Status"
        message={`Are you sure you want to delete the status "${selectedStatus?.display_name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmStyle="danger"
      />
    </div>
  );
}
