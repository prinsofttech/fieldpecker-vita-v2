import { useState, useEffect } from 'react';
import {
  Plus, Edit, Trash2, FileText, Users, Calendar, Search,
  TrendingUp, Clock, Sparkles, PlusCircle, Upload
} from 'lucide-react';
import type { Form } from '../../lib/forms/types';
import { FormService } from '../../lib/forms/form-service';
import { FormBuilder } from './FormBuilder';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { AddFormResponseModal } from './AddFormResponseModal';
import { ImportFormSubmissionsModal } from './ImportFormSubmissionsModal';
import { useToast } from '../../contexts/ToastContext';

interface FormsManagementProps {
  orgId: string;
}

export function FormsManagement({ orgId }: FormsManagementProps) {
  const { showError, showSuccess } = useToast();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingFormId, setEditingFormId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; formId?: string; formTitle?: string }>({
    show: false
  });
  const [showAddResponseModal, setShowAddResponseModal] = useState(false);
  const [selectedFormForResponse, setSelectedFormForResponse] = useState<Form | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    loadForms();
  }, [orgId]);

  const loadForms = async () => {
    setLoading(true);
    try {
      const data = await FormService.listForms(orgId);
      setForms(data);
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateForm = () => {
    setEditingFormId(undefined);
    setShowBuilder(true);
  };

  const handleEditForm = (formId: string) => {
    setEditingFormId(formId);
    setShowBuilder(true);
  };

  const handleDeleteForm = async () => {
    if (!deleteModal.formId) return;

    try {
      await FormService.deleteForm(deleteModal.formId);
      setDeleteModal({ show: false });
      showSuccess('Form Deleted', 'The form has been successfully deleted');
      loadForms();
    } catch (error) {
      console.error('Error deleting form:', error);
      showError('Delete Failed', 'Failed to delete the form. Please try again.');
    }
  };

  const handleToggleActive = async (formId: string, isActive: boolean) => {
    try {
      await FormService.updateForm(formId, { is_active: !isActive });
      loadForms();
    } catch (error) {
      console.error('Error toggling form status:', error);
    }
  };

  const handleAddResponse = (form: Form) => {
    setSelectedFormForResponse(form);
    setShowAddResponseModal(true);
  };

  const handleResponseSuccess = () => {
    setShowAddResponseModal(false);
    setSelectedFormForResponse(null);
    loadForms();
  };

  const filteredForms = forms.filter(form =>
    form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (form.description && form.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-[#015324] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">Forms Management</h1>
              <p className="text-slate-600">Create and manage data collection forms for your organization</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-6 py-3.5 bg-white border-2 border-slate-200 text-slate-700 rounded-xl hover:border-[#015324] hover:text-[#015324] hover:shadow-md transition-all duration-200 font-medium"
              >
                <Upload className="w-5 h-5" />
                Import CSV
              </button>
              <button
                onClick={handleCreateForm}
                className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#015324] to-[#017a33] text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-medium"
              >
                <Plus className="w-5 h-5" />
                Add
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search forms by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all placeholder-slate-400"
              />
            </div>
            <div className="px-4 py-3.5 bg-white border-2 border-slate-200 rounded-xl">
              <span className="text-sm font-medium text-slate-600">
                {filteredForms.length} {filteredForms.length === 1 ? 'Form' : 'Forms'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {forms.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-white rounded-2xl border-2 border-dashed border-slate-300">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#015324]/10 to-[#017a33]/10 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-[#015324]" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">No forms yet</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">Create your first form to start collecting data from your team and customers</p>
          <button
            onClick={handleCreateForm}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#015324] to-[#017a33] text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Your First Form
          </button>
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">No forms found</h3>
          <p className="text-slate-600 mb-6">Try adjusting your search query</p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-[#015324] hover:underline font-medium"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredForms.map((form) => (
            <div
              key={form.id}
              className={`group relative bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 p-6 hover:shadow-xl transition-all duration-200 ${
                form.is_active ? 'border-slate-200 hover:border-[#015324]/30' : 'border-slate-300 opacity-75'
              }`}
            >
              <div className="absolute top-6 right-6">
                <div className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
                  form.is_active
                    ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {form.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="mb-6 pr-20">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#015324] to-[#017a33] flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <Sparkles className="w-4 h-4 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{form.title}</h3>
                {form.description && (
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{form.description}</p>
                )}
              </div>

              <div className="space-y-3 mb-6 pb-6 border-b-2 border-slate-100">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium">{form.form_schema.length} fields</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-medium">{form.cycles_per_month}x per month</span>
                </div>
                {form.attach_to_customer && (
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                      <Users className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="font-medium">Customer-specific</span>
                  </div>
                )}
                {form.enable_freeze && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="font-medium text-amber-700">Freeze: {form.cycle_freeze_duration}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleAddResponse(form)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#015324] to-[#017a33] text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-medium"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add Response
                </button>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleEditForm(form.id)}
                    className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 hover:scale-105 transition-all duration-200 font-medium"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteModal({ show: true, formId: form.id, formTitle: form.title })}
                    className="p-3 text-red-600 hover:bg-red-100 rounded-xl transition-all duration-200"
                    title="Delete form"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onClick={() => handleToggleActive(form.id, form.is_active)}
                  className={`w-full px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                    form.is_active
                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                      : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                  }`}
                >
                  {form.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showBuilder && (
        <FormBuilder
          orgId={orgId}
          formId={editingFormId}
          onClose={() => setShowBuilder(false)}
          onSave={loadForms}
        />
      )}

      {showAddResponseModal && selectedFormForResponse && (
        <AddFormResponseModal
          form={selectedFormForResponse}
          onClose={() => {
            setShowAddResponseModal(false);
            setSelectedFormForResponse(null);
          }}
          onSuccess={handleResponseSuccess}
        />
      )}

      {deleteModal.show && (
        <ConfirmationModal
          title="Delete Form"
          message={`Are you sure you want to delete "${deleteModal.formTitle}"? This action cannot be undone and will remove all associated submissions.`}
          confirmText="Delete Form"
          confirmStyle="danger"
          onConfirm={handleDeleteForm}
          onCancel={() => setDeleteModal({ show: false })}
        />
      )}

      <ImportFormSubmissionsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        orgId={orgId}
        onImportComplete={loadForms}
      />
    </div>
  );
}
