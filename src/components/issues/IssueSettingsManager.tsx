import { useState, useEffect } from 'react';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  Tag,
  Circle,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Loader,
  PauseCircle,
  XCircle,
  UserCheck
} from 'lucide-react';
import { IssueService } from '../../lib/issues/issue-service';
import type { IssueCategory, IssueCustomStatus } from '../../lib/issues/types';
import { useToast } from '../../contexts/ToastContext';

interface IssueSettingsManagerProps {
  orgId: string;
  onClose: () => void;
}

const ICON_OPTIONS = [
  { name: 'circle', icon: Circle },
  { name: 'check-circle', icon: CheckCircle },
  { name: 'alert-circle', icon: AlertCircle },
  { name: 'x-circle', icon: XCircle },
  { name: 'loader', icon: Loader },
  { name: 'pause-circle', icon: PauseCircle },
  { name: 'user-check', icon: UserCheck },
  { name: 'tag', icon: Tag },
];

const COLOR_OPTIONS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
  '#6B7280', '#EC4899', '#14B8A6', '#F97316', '#1F2937'
];

export function IssueSettingsManager({ orgId, onClose }: IssueSettingsManagerProps) {
  const { showSuccess, showError, confirm } = useToast();
  const [activeTab, setActiveTab] = useState<'statuses' | 'categories'>('statuses');
  const [statuses, setStatuses] = useState<IssueCustomStatus[]>([]);
  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingStatus, setEditingStatus] = useState<IssueCustomStatus | null>(null);
  const [editingCategory, setEditingCategory] = useState<IssueCategory | null>(null);

  const [newStatus, setNewStatus] = useState({
    display_name: '',
    color: '#3B82F6',
    icon: 'circle',
    description: '',
    is_closed: false
  });

  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'tag'
  });

  const [showNewStatusForm, setShowNewStatusForm] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusesData, categoriesData] = await Promise.all([
        IssueService.getCustomStatuses(orgId),
        IssueService.getCategories(orgId)
      ]);
      setStatuses(statusesData);
      setCategories(categoriesData);
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStatus = async () => {
    if (!newStatus.display_name.trim()) {
      setError('Status name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const maxOrder = Math.max(...statuses.map(s => s.sort_order), 0);
      await IssueService.createCustomStatus(orgId, {
        name: newStatus.display_name,
        display_name: newStatus.display_name,
        color: newStatus.color,
        icon: newStatus.icon,
        sort_order: maxOrder + 1,
        description: newStatus.description || undefined,
        is_closed: newStatus.is_closed
      });

      await loadData();
      setNewStatus({ display_name: '', color: '#3B82F6', icon: 'circle', description: '', is_closed: false });
      setShowNewStatusForm(false);
    } catch (err) {
      setError('Failed to create status');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (status: IssueCustomStatus) => {
    if (status.is_system) return;

    setSaving(true);
    setError(null);

    try {
      await IssueService.updateCustomStatus(status.id, {
        display_name: status.display_name,
        color: status.color,
        icon: status.icon,
        description: status.description || undefined
      });

      await loadData();
      setEditingStatus(null);
    } catch (err) {
      setError('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    const confirmed = await confirm('Delete Status', 'Are you sure you want to delete this status?');
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      await IssueService.deleteCustomStatus(statusId);
      await loadData();
      showSuccess('Status Deleted', 'The status has been deleted successfully');
    } catch (err) {
      setError('Failed to delete status');
      showError('Delete Failed', 'Failed to delete status. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      setError('Category name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await IssueService.createCategory(
        orgId,
        newCategory.name,
        newCategory.description,
        newCategory.color,
        newCategory.icon
      );

      await loadData();
      setNewCategory({ name: '', description: '', color: '#3B82F6', icon: 'tag' });
      setShowNewCategoryForm(false);
    } catch (err) {
      setError('Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCategory = async (category: IssueCategory) => {
    setSaving(true);
    setError(null);

    try {
      await IssueService.updateCategory(category.id, {
        name: category.name,
        description: category.description || undefined,
        color: category.color,
        icon: category.icon
      });

      await loadData();
      setEditingCategory(null);
    } catch (err) {
      setError('Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const confirmed = await confirm('Delete Category', 'Are you sure you want to delete this category?');
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      await IssueService.deleteCategory(categoryId);
      await loadData();
      showSuccess('Category Deleted', 'The category has been deleted successfully');
    } catch (err) {
      setError('Failed to delete category');
      showError('Delete Failed', 'Failed to delete category. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    const iconOption = ICON_OPTIONS.find(o => o.name === iconName);
    return iconOption?.icon || Circle;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Issue Tracker Settings</h2>
              <p className="text-sm text-slate-500">Manage custom statuses and categories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('statuses')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'statuses'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Custom Statuses
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'categories'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Categories
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'statuses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600">
                  Custom statuses extend the default workflow. System statuses cannot be modified.
                </p>
                <button
                  onClick={() => setShowNewStatusForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Status
                </button>
              </div>

              {showNewStatusForm && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-4 border border-slate-200">
                  <h4 className="font-medium text-slate-800">New Custom Status</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={newStatus.display_name}
                        onChange={(e) => setNewStatus({ ...newStatus, display_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        placeholder="e.g., Awaiting Review"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={newStatus.description}
                        onChange={(e) => setNewStatus({ ...newStatus, description: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        placeholder="Optional description"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={newStatus.is_closed}
                        onChange={(e) => setNewStatus({ ...newStatus, is_closed: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                      />
                      Mark as Closed Status (issues with this status are considered closed/resolved)
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                      <div className="flex gap-2">
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setNewStatus({ ...newStatus, color })}
                            className={`w-8 h-8 rounded-lg transition-transform ${
                              newStatus.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
                      <div className="flex gap-2">
                        {ICON_OPTIONS.map((opt) => {
                          const IconComponent = opt.icon;
                          return (
                            <button
                              key={opt.name}
                              onClick={() => setNewStatus({ ...newStatus, icon: opt.name })}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                newStatus.icon === opt.name
                                  ? 'bg-slate-200 ring-2 ring-slate-400'
                                  : 'bg-slate-100 hover:bg-slate-200'
                              }`}
                            >
                              <IconComponent className="w-4 h-4 text-slate-600" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowNewStatusForm(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateStatus}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {statuses.map((status) => {
                  const IconComponent = getIconComponent(status.icon);
                  const isEditing = editingStatus?.id === status.id;

                  return (
                    <div
                      key={status.id}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        status.is_system ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex-1 grid grid-cols-4 gap-4">
                          <input
                            type="text"
                            value={editingStatus.display_name}
                            onChange={(e) => setEditingStatus({ ...editingStatus, display_name: e.target.value })}
                            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                          <div className="flex gap-1">
                            {COLOR_OPTIONS.slice(0, 5).map((color) => (
                              <button
                                key={color}
                                onClick={() => setEditingStatus({ ...editingStatus, color })}
                                className={`w-6 h-6 rounded ${editingStatus.color === color ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <div className="flex gap-1">
                            {ICON_OPTIONS.slice(0, 5).map((opt) => {
                              const Icon = opt.icon;
                              return (
                                <button
                                  key={opt.name}
                                  onClick={() => setEditingStatus({ ...editingStatus, icon: opt.name })}
                                  className={`w-6 h-6 rounded flex items-center justify-center ${
                                    editingStatus.icon === opt.name ? 'bg-slate-200' : 'bg-slate-100'
                                  }`}
                                >
                                  <Icon className="w-3 h-3" />
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingStatus(null)}
                              className="p-1.5 hover:bg-slate-100 rounded"
                            >
                              <X className="w-4 h-4 text-slate-500" />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(editingStatus)}
                              className="p-1.5 hover:bg-emerald-100 rounded text-emerald-600"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: status.color + '20' }}
                            >
                              <IconComponent className="w-4 h-4" style={{ color: status.color }} />
                            </div>
                            <div>
                              <div className="font-medium text-slate-800">{status.display_name}</div>
                              {status.description && (
                                <div className="text-xs text-slate-500">{status.description}</div>
                              )}
                            </div>
                            {status.is_system && (
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full">
                                System
                              </span>
                            )}
                            {status.is_closed && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                Closed
                              </span>
                            )}
                          </div>
                          {!status.is_system && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingStatus(status)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4 text-slate-500" />
                              </button>
                              <button
                                onClick={() => handleDeleteStatus(status.id)}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600">
                  Categories help organize and classify issues. Leave empty if no categories needed.
                </p>
                <button
                  onClick={() => setShowNewCategoryForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
              </div>

              {showNewCategoryForm && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-4 border border-slate-200">
                  <h4 className="font-medium text-slate-800">New Category</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        placeholder="e.g., Hardware Issue"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={newCategory.description}
                        onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        placeholder="Optional description"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                      <div className="flex gap-2">
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setNewCategory({ ...newCategory, color })}
                            className={`w-8 h-8 rounded-lg transition-transform ${
                              newCategory.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
                      <div className="flex gap-2">
                        {ICON_OPTIONS.map((opt) => {
                          const IconComponent = opt.icon;
                          return (
                            <button
                              key={opt.name}
                              onClick={() => setNewCategory({ ...newCategory, icon: opt.name })}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                newCategory.icon === opt.name
                                  ? 'bg-slate-200 ring-2 ring-slate-400'
                                  : 'bg-slate-100 hover:bg-slate-200'
                              }`}
                            >
                              <IconComponent className="w-4 h-4 text-slate-600" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowNewCategoryForm(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateCategory}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              {categories.length === 0 && !showNewCategoryForm ? (
                <div className="text-center py-12 text-slate-500">
                  <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No categories defined</p>
                  <p className="text-sm">Categories are optional. Create one if needed.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => {
                    const IconComponent = getIconComponent(category.icon);
                    const isEditing = editingCategory?.id === category.id;

                    return (
                      <div
                        key={category.id}
                        className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200"
                      >
                        {isEditing ? (
                          <div className="flex-1 grid grid-cols-4 gap-4">
                            <input
                              type="text"
                              value={editingCategory.name}
                              onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            />
                            <div className="flex gap-1">
                              {COLOR_OPTIONS.slice(0, 5).map((color) => (
                                <button
                                  key={color}
                                  onClick={() => setEditingCategory({ ...editingCategory, color })}
                                  className={`w-6 h-6 rounded ${editingCategory.color === color ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                            <div className="flex gap-1">
                              {ICON_OPTIONS.slice(0, 5).map((opt) => {
                                const Icon = opt.icon;
                                return (
                                  <button
                                    key={opt.name}
                                    onClick={() => setEditingCategory({ ...editingCategory, icon: opt.name })}
                                    className={`w-6 h-6 rounded flex items-center justify-center ${
                                      editingCategory.icon === opt.name ? 'bg-slate-200' : 'bg-slate-100'
                                    }`}
                                  >
                                    <Icon className="w-3 h-3" />
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingCategory(null)}
                                className="p-1.5 hover:bg-slate-100 rounded"
                              >
                                <X className="w-4 h-4 text-slate-500" />
                              </button>
                              <button
                                onClick={() => handleUpdateCategory(editingCategory)}
                                className="p-1.5 hover:bg-emerald-100 rounded text-emerald-600"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: category.color + '20' }}
                              >
                                <IconComponent className="w-4 h-4" style={{ color: category.color }} />
                              </div>
                              <div>
                                <div className="font-medium text-slate-800">{category.name}</div>
                                {category.description && (
                                  <div className="text-xs text-slate-500">{category.description}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingCategory(category)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4 text-slate-500" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(category.id)}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
