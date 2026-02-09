import { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Save, X, GripVertical, Settings
} from 'lucide-react';
import { LeadService } from '../../lib/leads/lead-service';
import type { LeadFormTemplate, LeadFormField, LeadFieldType } from '../../lib/leads/types';
import { useToast } from '../../contexts/ToastContext';

interface TemplateConfigManagerProps {
  orgId: string;
}

export function TemplateConfigManager({ orgId }: TemplateConfigManagerProps) {
  const { showSuccess, showError, confirm } = useToast();
  const [templates, setTemplates] = useState<LeadFormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<LeadFormTemplate | null>(null);
  const [templateFields, setTemplateFields] = useState<LeadFormField[]>([]);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [isAddingField, setIsAddingField] = useState(false);
  const [editingField, setEditingField] = useState<LeadFormField | null>(null);
  const [loading, setLoading] = useState(true);

  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    is_default: false
  });

  const [fieldForm, setFieldForm] = useState<Partial<LeadFormField>>({
    field_name: '',
    field_label: '',
    field_type: 'text' as LeadFieldType,
    is_required: false,
    placeholder: '',
    help_text: '',
    field_options: [],
    display_order: 0
  });

  useEffect(() => {
    loadTemplates();
  }, [orgId]);

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateFields();
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await LeadService.listTemplates(orgId);
      setTemplates(data);
      if (data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data[0]);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateFields = async () => {
    if (!selectedTemplate) return;
    try {
      const fields = await LeadService.getTemplateFields(selectedTemplate.id);
      setTemplateFields(fields);
    } catch (error) {
      console.error('Error loading template fields:', error);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      await LeadService.createTemplate(
        orgId,
        templateForm.name,
        templateForm.description,
        templateForm.is_default
      );
      setTemplateForm({ name: '', description: '', is_default: false });
      setIsEditingTemplate(false);
      await loadTemplates();
      showSuccess('Template Created', 'The template has been created successfully');
    } catch (error) {
      console.error('Error creating template:', error);
      showError('Create Failed', 'Failed to create template. Please try again.');
    }
  };

  const handleAddField = async () => {
    if (!selectedTemplate) return;
    try {
      await LeadService.addFieldToTemplate(selectedTemplate.id, {
        field_name: fieldForm.field_name!,
        field_label: fieldForm.field_label!,
        field_type: fieldForm.field_type!,
        is_required: fieldForm.is_required!,
        placeholder: fieldForm.placeholder,
        help_text: fieldForm.help_text,
        field_options: fieldForm.field_options,
        validation_rules: {},
        display_order: templateFields.length
      });
      setFieldForm({
        field_name: '',
        field_label: '',
        field_type: 'text',
        is_required: false,
        placeholder: '',
        help_text: '',
        field_options: [],
        display_order: 0
      });
      setIsAddingField(false);
      await loadTemplateFields();
      showSuccess('Field Added', 'The field has been added successfully');
    } catch (error) {
      console.error('Error adding field:', error);
      showError('Add Failed', 'Failed to add field. Please try again.');
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    const confirmed = await confirm('Delete Field', 'Are you sure you want to delete this field?');
    if (!confirmed) return;
    try {
      await LeadService.deleteField(fieldId);
      await loadTemplateFields();
      showSuccess('Field Deleted', 'The field has been deleted successfully');
    } catch (error) {
      console.error('Error deleting field:', error);
      showError('Delete Failed', 'Failed to delete field. Please try again.');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const confirmed = await confirm('Delete Template', 'Are you sure you want to delete this template? All associated fields will also be deleted.');
    if (!confirmed) return;
    try {
      await LeadService.deleteTemplate(templateId);
      setSelectedTemplate(null);
      await loadTemplates();
      showSuccess('Template Deleted', 'The template has been deleted successfully');
    } catch (error) {
      console.error('Error deleting template:', error);
      showError('Delete Failed', 'Failed to delete template. Please try again.');
    }
  };

  const fieldTypes: { value: LeadFieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'number', label: 'Number' },
    { value: 'select', label: 'Select Dropdown' },
    { value: 'multiselect', label: 'Multi-Select' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'date', label: 'Date' },
    { value: 'datetime', label: 'Date & Time' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'radio', label: 'Radio Buttons' },
    { value: 'url', label: 'URL' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Lead Form Templates</h2>
          <p className="text-slate-500">Configure custom forms for lead capture</p>
        </div>
        <button
          onClick={() => setIsEditingTemplate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Templates</h3>
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedTemplate?.id === template.id
                    ? 'bg-[#015324]/10 border-2 border-[#015324]'
                    : 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">{template.name}</div>
                    {template.description && (
                      <div className="text-xs text-slate-500 mt-1">{template.description}</div>
                    )}
                    {template.is_default && (
                      <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.id);
                    }}
                    className="p-1 hover:bg-red-100 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          {selectedTemplate ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{selectedTemplate.name}</h3>
                  <p className="text-sm text-slate-500">{selectedTemplate.description}</p>
                </div>
                <button
                  onClick={() => setIsAddingField(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Field
                </button>
              </div>

              <div className="space-y-3">
                {templateFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <GripVertical className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-slate-800">{field.field_label}</div>
                          <div className="text-sm text-slate-500 mt-1">
                            Type: {field.field_type}
                            {field.is_required && (
                              <span className="ml-2 text-red-600">*Required</span>
                            )}
                          </div>
                          {field.help_text && (
                            <div className="text-xs text-slate-500 mt-1">{field.help_text}</div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteField(field.id)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {templateFields.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No fields configured yet</p>
                    <p className="text-sm">Click "Add Field" to start building your form</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <p>Select a template to view and edit fields</p>
            </div>
          )}
        </div>
      </div>

      {isEditingTemplate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Create New Template</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  placeholder="e.g., Sales Lead Form"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  rows={3}
                  placeholder="Describe the purpose of this template"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={templateForm.is_default}
                  onChange={(e) => setTemplateForm({ ...templateForm, is_default: e.target.checked })}
                  className="w-4 h-4 text-[#015324] rounded focus:ring-[#015324]"
                />
                <label className="text-sm text-slate-700">Set as default template</label>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setIsEditingTemplate(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                className="px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddingField && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-slate-800">Add Form Field</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Field Name (Internal)
                </label>
                <input
                  type="text"
                  value={fieldForm.field_name}
                  onChange={(e) => setFieldForm({ ...fieldForm, field_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  placeholder="e.g., company_size"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Field Label (Display)
                </label>
                <input
                  type="text"
                  value={fieldForm.field_label}
                  onChange={(e) => setFieldForm({ ...fieldForm, field_label: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  placeholder="e.g., Company Size"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Field Type
                </label>
                <select
                  value={fieldForm.field_type}
                  onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value as LeadFieldType })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                >
                  {fieldTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Placeholder Text
                </label>
                <input
                  type="text"
                  value={fieldForm.placeholder}
                  onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  placeholder="e.g., Enter company name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Help Text
                </label>
                <input
                  type="text"
                  value={fieldForm.help_text}
                  onChange={(e) => setFieldForm({ ...fieldForm, help_text: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  placeholder="e.g., This field is optional"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={fieldForm.is_required}
                  onChange={(e) => setFieldForm({ ...fieldForm, is_required: e.target.checked })}
                  className="w-4 h-4 text-[#015324] rounded focus:ring-[#015324]"
                />
                <label className="text-sm text-slate-700">Required field</label>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setIsAddingField(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddField}
                disabled={!fieldForm.field_name || !fieldForm.field_label}
                className="px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
