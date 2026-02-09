import { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, X, Save, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmationModal } from '../modals/ConfirmationModal';

interface IssueCategory {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
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
  'tag',
  'alert-circle',
  'bug',
  'tool',
  'zap',
  'help-circle',
  'settings',
  'shield'
];

export function IssueCategoriesManager() {
  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory | null>(null);
  const [orgId, setOrgId] = useState<string>('');
  const { showToast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    color: '#6B7280',
    icon: 'tag',
    is_active: true
  });

  useEffect(() => {
    loadOrgIdAndCategories();
  }, []);

  const loadOrgIdAndCategories = async () => {
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
          await loadCategories(userData.org_id);
        }
      }
    } catch (error: any) {
      showToast('error', 'Failed to load data', error.message);
    }
  };

  const loadCategories = async (organizationId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('issue_categories')
        .select('*')
        .eq('org_id', organizationId)
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      showToast('error', 'Failed to load issue categories', error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#6B7280',
      icon: 'tag',
      is_active: true
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      showToast('error', 'Please fill in the category name');
      return;
    }

    try {
      const { error } = await supabase
        .from('issue_categories')
        .insert({
          org_id: orgId,
          name: formData.name,
          description: formData.description || null,
          color: formData.color,
          icon: formData.icon,
          is_active: formData.is_active
        });

      if (error) throw error;

      showToast('success', 'Issue category created successfully');
      setShowCreateModal(false);
      resetForm();
      loadCategories(orgId);
    } catch (error: any) {
      showToast('error', 'Failed to create issue category', error.message);
    }
  };

  const handleEdit = async () => {
    if (!selectedCategory || !formData.name.trim()) {
      showToast('error', 'Please fill in the category name');
      return;
    }

    try {
      const { error } = await supabase
        .from('issue_categories')
        .update({
          name: formData.name,
          description: formData.description || null,
          color: formData.color,
          icon: formData.icon,
          is_active: formData.is_active
        })
        .eq('id', selectedCategory.id);

      if (error) throw error;

      showToast('success', 'Issue category updated successfully');
      setShowEditModal(false);
      setSelectedCategory(null);
      resetForm();
      loadCategories(orgId);
    } catch (error: any) {
      showToast('error', 'Failed to update issue category', error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    try {
      const { error } = await supabase
        .from('issue_categories')
        .delete()
        .eq('id', selectedCategory.id);

      if (error) throw error;

      showToast('success', 'Issue category deleted successfully');
      setShowDeleteModal(false);
      setSelectedCategory(null);
      loadCategories(orgId);
    } catch (error: any) {
      showToast('error', 'Failed to delete issue category', error.message);
    }
  };

  const openEditModal = (category: IssueCategory) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
      icon: category.icon,
      is_active: category.is_active
    });
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openDeleteModal = (category: IssueCategory) => {
    setSelectedCategory(category);
    setShowDeleteModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl shadow-lg">
            <Tag className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Issue Category Management</h1>
            <p className="text-slate-600 mt-1">Configure issue categories for your organization</p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/30"
        >
          <Plus className="w-5 h-5" />
          Create Category
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-12 text-center">
          <Tag className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Categories Yet</h3>
          <p className="text-slate-600 mb-6">Create your first issue category to get started</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Category
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-white border-2 border-slate-200 rounded-xl p-6 hover:border-teal-300 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: category.color + '20' }}
                  >
                    <Tag className="w-5 h-5" style={{ color: category.color }} />
                  </div>
                  <span className="font-semibold text-slate-900">{category.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {category.is_active ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-slate-600">
                  {category.description || 'No description provided'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(category)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => openDeleteModal(category)}
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
                {showCreateModal ? 'Create Issue Category' : 'Edit Issue Category'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedCategory(null);
                  resetForm();
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Bug, Feature Request, Technical Issue"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this category"
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Active</span>
                </label>
              </div>

              <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
                <p className="text-sm text-teal-800 mb-2">
                  <strong>Preview:</strong>
                </p>
                <div
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ backgroundColor: formData.color + '20' }}
                >
                  <Tag className="w-4 h-4" style={{ color: formData.color }} />
                  <span className="text-sm font-semibold" style={{ color: formData.color }}>
                    {formData.name || 'Category Name'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedCategory(null);
                  resetForm();
                }}
                className="px-6 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? handleCreate : handleEdit}
                className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
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
          setSelectedCategory(null);
        }}
        onConfirm={handleDelete}
        title="Delete Issue Category"
        message={`Are you sure you want to delete the category "${selectedCategory?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmStyle="danger"
      />
    </div>
  );
}
