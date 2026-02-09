import { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, X, Save, AlertTriangle, Eye, EyeOff, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmationModal } from '../modals/ConfirmationModal';

interface LeadStatus {
  id: string;
  org_id: string;
  status_key: string;
  status_label: string;
  status_color: string;
  status_bg_color: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  status_key: string;
  status_label: string;
  status_color: string;
  status_bg_color: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
}

const COLORS = [
  { name: 'Blue', text: 'text-blue-700', bg: 'bg-blue-100' },
  { name: 'Cyan', text: 'text-cyan-700', bg: 'bg-cyan-100' },
  { name: 'Teal', text: 'text-teal-700', bg: 'bg-teal-100' },
  { name: 'Green', text: 'text-green-700', bg: 'bg-green-100' },
  { name: 'Emerald', text: 'text-emerald-700', bg: 'bg-emerald-100' },
  { name: 'Amber', text: 'text-amber-700', bg: 'bg-amber-100' },
  { name: 'Orange', text: 'text-orange-700', bg: 'bg-orange-100' },
  { name: 'Red', text: 'text-red-700', bg: 'bg-red-100' },
  { name: 'Pink', text: 'text-pink-700', bg: 'bg-pink-100' },
  { name: 'Rose', text: 'text-rose-700', bg: 'bg-rose-100' },
  { name: 'Violet', text: 'text-violet-700', bg: 'bg-violet-100' },
  { name: 'Purple', text: 'text-purple-700', bg: 'bg-purple-100' },
  { name: 'Indigo', text: 'text-indigo-700', bg: 'bg-indigo-100' },
  { name: 'Sky', text: 'text-sky-700', bg: 'bg-sky-100' },
  { name: 'Slate', text: 'text-slate-700', bg: 'bg-slate-100' },
  { name: 'Gray', text: 'text-gray-700', bg: 'bg-gray-100' }
];

export function LeadStatusesManager() {
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus | null>(null);
  const [orgId, setOrgId] = useState<string>('');
  const { showToast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    status_key: '',
    status_label: '',
    status_color: 'text-slate-700',
    status_bg_color: 'bg-slate-100',
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
        .from('lead_statuses')
        .select('*')
        .eq('org_id', organizationId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setStatuses(data || []);
    } catch (error: any) {
      showToast('error', 'Failed to load lead statuses', error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      status_key: '',
      status_label: '',
      status_color: 'text-slate-700',
      status_bg_color: 'bg-slate-100',
      description: '',
      is_active: true,
      is_default: false
    });
  };

  const handleCreate = async () => {
    if (!formData.status_key || !formData.status_label) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    try {
      const maxOrder = Math.max(...statuses.map(s => s.display_order), 0);

      const { error } = await supabase
        .from('lead_statuses')
        .insert({
          org_id: orgId,
          status_key: formData.status_key.toLowerCase().replace(/\s+/g, '_'),
          status_label: formData.status_label,
          status_color: formData.status_color,
          status_bg_color: formData.status_bg_color,
          description: formData.description || null,
          display_order: maxOrder + 1,
          is_active: formData.is_active,
          is_default: formData.is_default,
          is_system: false
        });

      if (error) throw error;

      showToast('success', 'Lead status created successfully');
      setShowCreateModal(false);
      resetForm();
      loadStatuses(orgId);
    } catch (error: any) {
      showToast('error', 'Failed to create lead status', error.message);
    }
  };

  const handleEdit = async () => {
    if (!selectedStatus || !formData.status_label) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('lead_statuses')
        .update({
          status_label: formData.status_label,
          status_color: formData.status_color,
          status_bg_color: formData.status_bg_color,
          description: formData.description || null,
          is_active: formData.is_active,
          is_default: formData.is_default
        })
        .eq('id', selectedStatus.id);

      if (error) throw error;

      showToast('success', 'Lead status updated successfully');
      setShowEditModal(false);
      setSelectedStatus(null);
      resetForm();
      loadStatuses(orgId);
    } catch (error: any) {
      showToast('error', 'Failed to update lead status', error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedStatus) return;

    try {
      // Check if this status is being used by any leads
      const { data: leadsUsingStatus, error: checkError } = await supabase
        .from('leads')
        .select('id')
        .eq('status', selectedStatus.status_key)
        .limit(1);

      if (checkError) throw checkError;

      if (leadsUsingStatus && leadsUsingStatus.length > 0) {
        showToast(
          'error',
          'Cannot delete status',
          `"${selectedStatus.status_label}" is currently assigned to one or more leads. Please reassign those leads first.`
        );
        setShowDeleteModal(false);
        setSelectedStatus(null);
        return;
      }

      // Proceed with deletion if not in use
      const { error } = await supabase
        .from('lead_statuses')
        .delete()
        .eq('id', selectedStatus.id);

      if (error) throw error;

      showToast('success', 'Lead status deleted successfully');
      setShowDeleteModal(false);
      setSelectedStatus(null);
      loadStatuses(orgId);
    } catch (error: any) {
      showToast('error', 'Failed to delete lead status', error.message);
    }
  };

  const openEditModal = (status: LeadStatus) => {
    setSelectedStatus(status);
    setFormData({
      status_key: status.status_key,
      status_label: status.status_label,
      status_color: status.status_color,
      status_bg_color: status.status_bg_color,
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

  const openDeleteModal = (status: LeadStatus) => {
    setSelectedStatus(status);
    setShowDeleteModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg">
            <Tag className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Lead Status Management</h1>
            <p className="text-slate-600 mt-1">Configure lead status workflow for your organization</p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30"
        >
          <Plus className="w-5 h-5" />
          Create Status
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : statuses.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-12 text-center">
          <Tag className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Lead Statuses Yet</h3>
          <p className="text-slate-600 mb-6">Create your first lead status to get started</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
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
              className="bg-white border-2 border-slate-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 ${status.status_bg_color} rounded-lg`}>
                    <span className={`text-sm font-semibold ${status.status_color}`}>
                      {status.status_label}
                    </span>
                  </div>
                  {status.is_default && (
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  )}
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
                <p className="text-xs text-slate-500">Key: {status.status_key}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(status)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                {!status.is_system && (
                  <button
                    onClick={() => openDeleteModal(status)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>

              {status.is_system && (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <AlertTriangle className="w-3 h-3" />
                  System status (cannot be deleted)
                </div>
              )}
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
                {showCreateModal ? 'Create Lead Status' : 'Edit Lead Status'}
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
                    value={formData.status_key}
                    onChange={(e) => setFormData({ ...formData, status_key: e.target.value })}
                    placeholder="e.g., pending_review"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Unique identifier (will be converted to lowercase with underscores)</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.status_label}
                  onChange={(e) => setFormData({ ...formData, status_label: e.target.value })}
                  placeholder="e.g., Pending Review"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Color Theme
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setFormData({
                        ...formData,
                        status_color: color.text,
                        status_bg_color: color.bg
                      })}
                      className={`px-3 py-2 ${color.bg} rounded-lg border-2 transition-all ${
                        formData.status_color === color.text
                          ? 'border-slate-800 shadow-md'
                          : 'border-transparent'
                      }`}
                    >
                      <span className={`text-sm font-semibold ${color.text}`}>
                        {color.name}
                      </span>
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
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Active</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Default status for new leads</span>
                </label>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Preview:</strong> Your status will appear like this:
                </p>
                <div className={`inline-block px-3 py-1.5 ${formData.status_bg_color} rounded-lg mt-2`}>
                  <span className={`text-sm font-semibold ${formData.status_color}`}>
                    {formData.status_label || 'Status Label'}
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
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
        title="Delete Lead Status"
        message={`Are you sure you want to delete the status "${selectedStatus?.status_label}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmStyle="danger"
      />
    </div>
  );
}
