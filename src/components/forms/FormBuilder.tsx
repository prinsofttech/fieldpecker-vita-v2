import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, GripVertical, Save, X, ChevronUp, ChevronDown, FileText, Shield } from 'lucide-react';
import type { FormField, CreateFormData, InputMaskType } from '../../lib/forms/types';
import { FormService } from '../../lib/forms/form-service';
import { INPUT_MASK_PRESETS } from '../../lib/forms/input-mask-utils';
import { supabase } from '../../lib/supabase/client';
import { useToast } from '../../contexts/ToastContext';

interface FormBuilderProps {
  orgId: string;
  formId?: string;
  onClose: () => void;
  onSave: () => void;
}

export function FormBuilder({ orgId, formId, onClose, onSave }: FormBuilderProps) {
  const { showSuccess, showError, showWarning } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [attachToCustomer, setAttachToCustomer] = useState(false);
  const [cyclesPerMonth, setCyclesPerMonth] = useState<1 | 2 | 3 | 4>(1);
  const [enableFreeze, setEnableFreeze] = useState(false);
  const [freezeDuration, setFreezeDuration] = useState('1 day');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadDepartments();
    if (formId) {
      loadFormData();
    }
  }, [formId, orgId]);

  const loadDepartments = async () => {
    try {
      const { data } = await supabase
        .from('departments')
        .select('id, name')
        .eq('org_id', orgId)
        .order('name');
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadFormData = async () => {
    setLoading(true);
    try {
      const form = await FormService.getForm(formId!);
      if (form) {
        setTitle(form.title);
        setDescription(form.description || '');
        setFields(form.form_schema);
        setDepartmentId(form.department_id || '');
        setAttachToCustomer(form.attach_to_customer);
        setCyclesPerMonth(form.cycles_per_month);
        setEnableFreeze(form.enable_freeze);
        setFreezeDuration(form.cycle_freeze_duration || '1 day');
      }
    } catch (error) {
      console.error('Error loading form data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fieldTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'select', label: 'Dropdown' },
    { value: 'multiselect', label: 'Multiple Choice' },
    { value: 'date', label: 'Date' },
    { value: 'time', label: 'Time' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'radio', label: 'Radio' },
    { value: 'image', label: 'Image' },
  ];

  const addField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: 'text',
      label: '',
      required: false,
      order: fields.length
    };
    setFields([...fields, newField]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const moveFieldUp = (index: number) => {
    if (index === 0) return;
    const newFields = [...fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    newFields.forEach((field, idx) => {
      field.order = idx;
    });
    setFields(newFields);
  };

  const moveFieldDown = (index: number) => {
    if (index === fields.length - 1) return;
    const newFields = [...fields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    newFields.forEach((field, idx) => {
      field.order = idx;
    });
    setFields(newFields);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showWarning('Form Title Required', 'Please enter a form title');
      return;
    }

    if (fields.length === 0) {
      showWarning('Fields Required', 'Please add at least one field');
      return;
    }

    setSaving(true);
    try {
      const formData: CreateFormData = {
        title,
        description: description || undefined,
        form_schema: fields,
        department_id: departmentId || undefined,
        attach_to_customer: attachToCustomer,
        cycles_per_month: cyclesPerMonth,
        enable_freeze: enableFreeze,
        cycle_freeze_duration: enableFreeze ? freezeDuration : undefined
      };

      if (formId) {
        await FormService.updateForm(formId, formData);
        showSuccess('Form Updated', 'The form has been updated successfully');
      } else {
        await FormService.createForm(orgId, formData);
        showSuccess('Form Created', 'The form has been created successfully');
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving form:', error);
      showError('Save Failed', 'Failed to save form. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="w-12 h-12 border-4 border-[#015324] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 mt-4">Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-gradient-to-r from-[#015324] to-[#017a33] px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white">
              {formId ? 'Edit Form' : 'Create New Form'}
            </h2>
            <p className="text-white/80 text-sm mt-1">Design your custom data collection form</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-all duration-200 group"
          >
            <X className="w-6 h-6 text-white group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-8 space-y-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-[#015324] rounded-full"></div>
                Basic Information
              </h3>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Form Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] focus:bg-white transition-all duration-200 text-slate-800 placeholder-slate-400"
                    placeholder="e.g., Daily Sales Report"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] focus:bg-white transition-all duration-200 text-slate-800 placeholder-slate-400 resize-none"
                    placeholder="Provide a brief description of this form's purpose"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-[#015324] rounded-full"></div>
                Form Configuration
              </h3>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Department (optional)
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] focus:bg-white transition-all duration-200 text-slate-800"
                  >
                    <option value="">Select a department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Cycles Per Month <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={cyclesPerMonth}
                      onChange={(e) => setCyclesPerMonth(Number(e.target.value) as 1 | 2 | 3 | 4)}
                      className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] focus:bg-white transition-all duration-200 text-slate-800"
                    >
                      <option value={1}>1 - Once per month</option>
                      <option value={2}>2 - Twice per month</option>
                      <option value={3}>3 - Three times per month</option>
                      <option value={4}>4 - Four times per month</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Customer Attachment
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl hover:border-[#015324]/30 transition-all duration-200">
                      <input
                        type="checkbox"
                        checked={attachToCustomer}
                        onChange={(e) => setAttachToCustomer(e.target.checked)}
                        className="w-5 h-5 text-[#015324] border-slate-300 rounded focus:ring-2 focus:ring-[#015324]"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-700 block">
                          Attach to Specific Customers
                        </span>
                        <span className="text-xs text-slate-500">
                          Requires customer criteria matching
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-5 border-2 border-slate-200">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableFreeze}
                      onChange={(e) => setEnableFreeze(e.target.checked)}
                      className="w-5 h-5 text-[#015324] border-slate-300 rounded focus:ring-2 focus:ring-[#015324]"
                    />
                    <span className="text-sm font-semibold text-slate-700">
                      Enable Freeze Period After Submission
                    </span>
                  </label>

                  {enableFreeze && (
                    <div className="mt-4 pl-8">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Freeze Duration
                      </label>
                      <input
                        type="text"
                        value={freezeDuration}
                        onChange={(e) => setFreezeDuration(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all duration-200 text-slate-800 placeholder-slate-400"
                        placeholder="e.g., 3 days, 12 hours"
                      />
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                        Examples: "1 day", "12 hours", "3 days", "2 hours"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-[#015324] rounded-full"></div>
                    Form Fields
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 ml-5">Design your form questions and inputs</p>
                </div>
                <button
                  onClick={addField}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#015324] to-[#017a33] text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Add Field
                </button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="group bg-gradient-to-br from-white to-slate-50/50 rounded-2xl p-5 border-2 border-slate-200 hover:border-[#015324]/30 hover:shadow-md transition-all duration-200">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center gap-2">
                          <button
                            onClick={() => moveFieldUp(index)}
                            disabled={index === 0}
                            className="p-1.5 text-slate-400 hover:text-[#015324] hover:bg-[#015324]/10 rounded-lg transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#015324] to-[#017a33] text-white text-sm font-bold flex items-center justify-center shadow-md">
                            {index + 1}
                          </div>
                          <button
                            onClick={() => moveFieldDown(index)}
                            disabled={index === fields.length - 1}
                            className="p-1.5 text-slate-400 hover:text-[#015324] hover:bg-[#015324]/10 rounded-lg transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                              Field Type
                            </label>
                            <select
                              value={field.type}
                              onChange={(e) => updateField(field.id, { type: e.target.value as any })}
                              className="w-full px-3 py-2.5 text-sm bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all duration-200"
                            >
                              {fieldTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                              Field Label
                            </label>
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => updateField(field.id, { label: e.target.value })}
                              className="w-full px-3 py-2.5 text-sm bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all duration-200 placeholder-slate-400"
                              placeholder="e.g., Customer Name"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-2">
                            Placeholder (optional)
                          </label>
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                            className="w-full px-3 py-2.5 text-sm bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all duration-200 placeholder-slate-400"
                            placeholder="Hint text for the field"
                          />
                        </div>

                        {['text', 'phone', 'number', 'textarea', 'email'].includes(field.type) && (
                          <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-3">
                              <Shield className="w-3.5 h-3.5" />
                              Input Mask (optional)
                            </label>
                            <select
                              value={field.inputMask?.type || 'none'}
                              onChange={(e) => {
                                const maskType = e.target.value as InputMaskType;
                                if (maskType === 'none') {
                                  const { inputMask, ...rest } = field;
                                  updateField(field.id, { inputMask: undefined } as any);
                                } else {
                                  updateField(field.id, {
                                    inputMask: {
                                      type: maskType,
                                      ...(field.inputMask?.type === maskType ? field.inputMask : {})
                                    }
                                  });
                                }
                              }}
                              className="w-full px-3 py-2.5 text-sm bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all duration-200"
                            >
                              {INPUT_MASK_PRESETS.map(preset => (
                                <option key={preset.value} value={preset.value}>
                                  {preset.label} - {preset.description}
                                </option>
                              ))}
                            </select>

                            {field.inputMask?.type === 'custom' && (
                              <div className="mt-3 space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                    Format Pattern
                                  </label>
                                  <input
                                    type="text"
                                    value={field.inputMask.format || ''}
                                    onChange={(e) =>
                                      updateField(field.id, {
                                        inputMask: { ...field.inputMask!, format: e.target.value }
                                      })
                                    }
                                    className="w-full px-3 py-2.5 text-sm bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all duration-200 placeholder-slate-400"
                                    placeholder="e.g., ###-###-#### or AA-####"
                                  />
                                  <p className="text-xs text-slate-400 mt-1"># = digit, A = letter. Other characters are literal.</p>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                    Regex Validation (optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={field.inputMask.customPattern || ''}
                                    onChange={(e) =>
                                      updateField(field.id, {
                                        inputMask: { ...field.inputMask!, customPattern: e.target.value }
                                      })
                                    }
                                    className="w-full px-3 py-2.5 text-sm bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all duration-200 placeholder-slate-400 font-mono"
                                    placeholder="e.g., ^[A-Z]{2}-\d{4}$"
                                  />
                                </div>
                              </div>
                            )}

                            {field.inputMask && field.inputMask.type !== 'none' && (
                              <div className="mt-3">
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                  Max Length (optional)
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={500}
                                  value={field.inputMask.maxLength || ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                                    updateField(field.id, {
                                      inputMask: { ...field.inputMask!, maxLength: val }
                                    });
                                  }}
                                  className="w-32 px-3 py-2.5 text-sm bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all duration-200 placeholder-slate-400"
                                  placeholder="No limit"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {(field.type === 'select' || field.type === 'multiselect' || field.type === 'radio' || field.type === 'checkbox') && (
                          <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200">
                            <label className="block text-xs font-semibold text-slate-600 mb-3">
                              Options {field.type === 'checkbox' && <span className="text-slate-500 font-normal">(for multiple checkboxes)</span>}
                            </label>
                            <div className="space-y-2">
                              {(field.options || []).map((option, optIndex) => (
                                <div key={optIndex} className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                                    {optIndex + 1}
                                  </div>
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) => {
                                      const newOptions = [...(field.options || [])];
                                      newOptions[optIndex] = e.target.value;
                                      updateField(field.id, { options: newOptions });
                                    }}
                                    className="flex-1 px-3 py-2.5 text-sm bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all duration-200 placeholder-slate-400"
                                    placeholder={`Option ${optIndex + 1}`}
                                  />
                                  <button
                                    onClick={() => {
                                      const newOptions = (field.options || []).filter((_, i) => i !== optIndex);
                                      updateField(field.id, { options: newOptions });
                                    }}
                                    className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-all duration-200"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => {
                                  const newOptions = [...(field.options || []), ''];
                                  updateField(field.id, { options: newOptions });
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#015324] bg-[#015324]/5 hover:bg-[#015324]/10 rounded-xl transition-all duration-200 w-full justify-center border-2 border-dashed border-[#015324]/30"
                              >
                                <Plus className="w-4 h-4" />
                                Add Option
                              </button>
                            </div>
                          </div>
                        )}

                        {field.type === 'date' && (
                          <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200">
                            <label className="block text-xs font-semibold text-slate-600 mb-3">
                              Date Restriction
                            </label>
                            <select
                              value={field.dateRestriction || 'none'}
                              onChange={(e) => updateField(field.id, { dateRestriction: e.target.value as any })}
                              className="w-full px-3 py-2.5 text-sm bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all duration-200"
                            >
                              <option value="none">No Restriction</option>
                              <option value="past">Past Dates Only</option>
                              <option value="future">Future Dates Only</option>
                              <option value="today-future">Today and Future</option>
                              <option value="today-past">Today and Past</option>
                            </select>
                          </div>
                        )}

                        <label className="flex items-center gap-3 cursor-pointer px-4 py-3 bg-slate-50/50 rounded-xl border border-slate-200 hover:border-[#015324]/30 transition-all duration-200">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(field.id, { required: e.target.checked })}
                            className="w-5 h-5 text-[#015324] border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324]"
                          />
                          <span className="text-sm font-medium text-slate-700">Required field</span>
                        </label>
                      </div>

                      <button
                        onClick={() => removeField(field.id)}
                        className="p-2.5 text-red-600 hover:bg-red-100 rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100"
                        title="Delete field"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}

                {fields.length === 0 && (
                  <div className="text-center py-12 px-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">No fields added yet</p>
                    <p className="text-sm text-slate-400 mt-1">Click "Add Field" to start building your form</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent px-8 py-5 flex items-center justify-end gap-3 border-t-2 border-slate-200">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 disabled:opacity-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#015324] to-[#017a33] text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 font-medium"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Form
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
