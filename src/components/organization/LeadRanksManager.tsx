import { useState, useEffect } from 'react';
import { Flame, Plus, Edit2, Trash2, X, Save, AlertTriangle, Eye, EyeOff, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import type { LeadRank } from '../../lib/leads/types';

interface FormData {
  rank_key: string;
  rank_label: string;
  rank_color: string;
  rank_bg_color: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
}

const COLORS = [
  { name: 'Red', text: 'text-red-700', bg: 'bg-red-100' },
  { name: 'Orange', text: 'text-orange-700', bg: 'bg-orange-100' },
  { name: 'Amber', text: 'text-amber-700', bg: 'bg-amber-100' },
  { name: 'Sky', text: 'text-sky-700', bg: 'bg-sky-100' },
  { name: 'Blue', text: 'text-blue-700', bg: 'bg-blue-100' },
  { name: 'Cyan', text: 'text-cyan-700', bg: 'bg-cyan-100' },
  { name: 'Teal', text: 'text-teal-700', bg: 'bg-teal-100' },
  { name: 'Green', text: 'text-green-700', bg: 'bg-green-100' },
  { name: 'Emerald', text: 'text-emerald-700', bg: 'bg-emerald-100' },
  { name: 'Pink', text: 'text-pink-700', bg: 'bg-pink-100' },
  { name: 'Rose', text: 'text-rose-700', bg: 'bg-rose-100' },
  { name: 'Slate', text: 'text-slate-700', bg: 'bg-slate-100' },
];

const EMPTY_FORM: FormData = {
  rank_key: '',
  rank_label: '',
  rank_color: 'text-slate-700',
  rank_bg_color: 'bg-slate-100',
  description: '',
  is_active: true,
  is_default: false,
};

export function LeadRanksManager() {
  const [ranks, setRanks] = useState<LeadRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRank, setSelectedRank] = useState<LeadRank | null>(null);
  const [orgId, setOrgId] = useState<string>('');
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });

  useEffect(() => {
    loadOrgIdAndRanks();
  }, []);

  const loadOrgIdAndRanks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .maybeSingle();

        if (userData?.org_id) {
          setOrgId(userData.org_id);
          await loadRanks(userData.org_id);
        }
      }
    } catch (error: any) {
      showError('Load Failed', error.message);
    }
  };

  const loadRanks = async (organizationId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lead_ranks')
        .select('*')
        .eq('org_id', organizationId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setRanks(data || []);
    } catch (error: any) {
      showError('Load Failed', 'Failed to load lead ranks: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => setFormData({ ...EMPTY_FORM });

  const handleCreate = async () => {
    if (!formData.rank_key || !formData.rank_label) {
      showError('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      const maxOrder = Math.max(...ranks.map(r => r.display_order), 0);
      const { error } = await supabase.from('lead_ranks').insert({
        org_id: orgId,
        rank_key: formData.rank_key.toLowerCase().replace(/\s+/g, '_'),
        rank_label: formData.rank_label,
        rank_color: formData.rank_color,
        rank_bg_color: formData.rank_bg_color,
        description: formData.description || null,
        display_order: maxOrder + 1,
        is_active: formData.is_active,
        is_default: formData.is_default,
        is_system: false,
      });

      if (error) throw error;
      showSuccess('Rank Created', 'Lead rank has been created successfully');
      setShowCreateModal(false);
      resetForm();
      loadRanks(orgId);
    } catch (error: any) {
      showError('Creation Failed', error.message);
    }
  };

  const handleEdit = async () => {
    if (!selectedRank || !formData.rank_label) {
      showError('Validation Error', 'Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('lead_ranks')
        .update({
          rank_label: formData.rank_label,
          rank_color: formData.rank_color,
          rank_bg_color: formData.rank_bg_color,
          description: formData.description || null,
          is_active: formData.is_active,
          is_default: formData.is_default,
        })
        .eq('id', selectedRank.id);

      if (error) throw error;
      showSuccess('Rank Updated', 'Lead rank has been updated successfully');
      setShowEditModal(false);
      setSelectedRank(null);
      resetForm();
      loadRanks(orgId);
    } catch (error: any) {
      showError('Update Failed', error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedRank) return;

    try {
      const { data: leadsUsingRank, error: checkError } = await supabase
        .from('leads')
        .select('id')
        .eq('rank_id', selectedRank.id)
        .limit(1);

      if (checkError) throw checkError;

      if (leadsUsingRank && leadsUsingRank.length > 0) {
        showError(
          'Cannot Delete',
          `"${selectedRank.rank_label}" is currently assigned to leads. Reassign those leads first.`
        );
        setShowDeleteModal(false);
        setSelectedRank(null);
        return;
      }

      const { error } = await supabase
        .from('lead_ranks')
        .delete()
        .eq('id', selectedRank.id);

      if (error) throw error;
      showSuccess('Rank Deleted', 'Lead rank has been deleted successfully');
      setShowDeleteModal(false);
      setSelectedRank(null);
      loadRanks(orgId);
    } catch (error: any) {
      showError('Delete Failed', error.message);
    }
  };

  const openEditModal = (rank: LeadRank) => {
    setSelectedRank(rank);
    setFormData({
      rank_key: rank.rank_key,
      rank_label: rank.rank_label,
      rank_color: rank.rank_color,
      rank_bg_color: rank.rank_bg_color,
      description: rank.description || '',
      is_active: rank.is_active,
      is_default: rank.is_default,
    });
    setShowEditModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Lead Rank Management</h1>
            <p className="text-slate-600 mt-1">Configure lead temperature/priority ranks for your organization</p>
          </div>
        </div>

        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/30"
        >
          <Plus className="w-5 h-5" />
          Create Rank
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
        </div>
      ) : ranks.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-12 text-center">
          <Flame className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Lead Ranks Yet</h3>
          <p className="text-slate-600 mb-6">Create your first lead rank to get started</p>
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Rank
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ranks.map((rank) => (
            <div
              key={rank.id}
              className="bg-white border-2 border-slate-200 rounded-xl p-6 hover:border-orange-300 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 ${rank.rank_bg_color} rounded-lg`}>
                    <span className={`text-sm font-semibold ${rank.rank_color}`}>
                      {rank.rank_label}
                    </span>
                  </div>
                  {rank.is_default && (
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {rank.is_active ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">
                  {rank.description || 'No description provided'}
                </p>
                <p className="text-xs text-slate-500">Key: {rank.rank_key}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(rank)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                {!rank.is_system && (
                  <button
                    onClick={() => { setSelectedRank(rank); setShowDeleteModal(true); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>

              {rank.is_system && (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <AlertTriangle className="w-3 h-3" />
                  System rank (cannot be deleted)
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800">
                {showCreateModal ? 'Create Lead Rank' : 'Edit Lead Rank'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedRank(null);
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
                    Rank Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.rank_key}
                    onChange={(e) => setFormData({ ...formData, rank_key: e.target.value })}
                    placeholder="e.g., warm"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Unique identifier (lowercase with underscores)</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rank Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.rank_label}
                  onChange={(e) => setFormData({ ...formData, rank_label: e.target.value })}
                  placeholder="e.g., Warm"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        rank_color: color.text,
                        rank_bg_color: color.bg,
                      })}
                      className={`px-3 py-2 ${color.bg} rounded-lg border-2 transition-all ${
                        formData.rank_color === color.text
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
                  placeholder="Describe what this rank means"
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Active</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Default rank for new leads</span>
                </label>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Preview:</strong> Your rank will appear like this:
                </p>
                <div className={`inline-block px-3 py-1.5 ${formData.rank_bg_color} rounded-lg mt-2`}>
                  <span className={`text-sm font-semibold ${formData.rank_color}`}>
                    {formData.rank_label || 'Rank Label'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedRank(null);
                  resetForm();
                }}
                className="px-6 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? handleCreate : handleEdit}
                className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Save className="w-5 h-5" />
                {showCreateModal ? 'Create' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedRank(null); }}
        onConfirm={handleDelete}
        title="Delete Lead Rank"
        message={`Are you sure you want to delete the rank "${selectedRank?.rank_label}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmStyle="danger"
      />
    </div>
  );
}
