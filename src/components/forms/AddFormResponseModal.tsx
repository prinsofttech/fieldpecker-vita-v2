import { useState, useEffect } from 'react';
import { X, User, FileText, Loader, MapPin, AlertCircle } from 'lucide-react';
import type { Form, FormField } from '../../lib/forms/types';
import { FormService } from '../../lib/forms/form-service';
import { applyInputMask, getMaskPlaceholder } from '../../lib/forms/input-mask-utils';
import { supabase } from '../../lib/supabase/client';

interface Customer {
  id: string;
  customer_name: string;
  customer_code: string;
  territory_name?: string;
  sub_territory_name?: string;
}

interface AddFormResponseModalProps {
  form: Form;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddFormResponseModal({ form, onClose, onSuccess }: AddFormResponseModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCustomers();
  }, [form.org_id]);

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      // Fetch ALL customers with pagination
      let allCustomers: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('customers')
          .select('id, customer_name, customer_code, regions!agents_region_id_fkey(name), branches!agents_branch_id_fkey(name)')
          .eq('org_id', form.org_id)
          .eq('is_active', true)
          .order('customer_name')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          const mapped = data.map((c: any) => ({
            id: c.id,
            customer_name: c.customer_name,
            customer_code: c.customer_code,
            territory_name: c.regions?.name || undefined,
            sub_territory_name: c.branches?.name || undefined,
          }));
          allCustomers = [...allCustomers, ...mapped];
          page++;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      setCustomers(allCustomers);
    } catch (err) {
      console.error('Error loading customers:', err);
      setError('Failed to load customers');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const validateForm = (): boolean => {
    if (!selectedCustomerId) {
      setError('Please select a customer');
      return false;
    }

    for (const field of form.form_schema) {
      if (field.required && !formData[field.id]) {
        setError(`${field.label} is required`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // If form requires customer attachment, attach the customer first
      if (form.attach_to_customer) {
        const attachResult = await FormService.attachFormToCustomers({
          form_id: form.id,
          customer_ids: [selectedCustomerId],
          criteria: [] // Empty criteria means always visible
        });

        if (!attachResult) {
          setError('Failed to attach customer to form');
          setLoading(false);
          return;
        }
      }

      const result = await FormService.submitForm({
        form_id: form.id,
        agent_id: selectedCustomerId,
        submission_data: formData
      });

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        // Provide better error messages
        let errorMessage = 'Failed to submit form';

        if (result.error === 'form_not_visible') {
          const details = result.details as any;
          if (details?.reason === 'max_cycles_reached') {
            errorMessage = `Maximum submissions reached (${details.current_cycle}/${details.max_cycles} cycles)`;
          } else if (details?.reason === 'form_frozen') {
            const remainingMinutes = Math.ceil(details.remaining_seconds / 60);
            errorMessage = `Form is frozen. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
          } else if (details?.reason === 'criteria_not_met') {
            errorMessage = 'Customer does not meet the form criteria requirements';
          } else {
            errorMessage = 'Form is not available for this customer';
          }
        } else {
          errorMessage = result.error || 'Failed to submit form';
        }

        setError(errorMessage);
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      setError('Failed to submit form response');
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id] || '';
    const maskPlaceholder = getMaskPlaceholder(field.inputMask);
    const placeholder = field.placeholder || maskPlaceholder;

    const baseInputClass = "w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all text-slate-700";

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => {
              const masked = applyInputMask(e.target.value, field.inputMask);
              handleFieldChange(field.id, masked);
            }}
            placeholder={placeholder}
            required={field.required}
            rows={4}
            maxLength={field.inputMask?.maxLength}
            className={baseInputClass + " resize-none"}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            className={baseInputClass}
          >
            <option value="">Select an option</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <select
            multiple
            value={Array.isArray(value) ? value : []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, option => option.value);
              handleFieldChange(field.id, selected);
            }}
            required={field.required}
            className={baseInputClass + " h-32"}
          >
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              required={field.required}
              className="w-5 h-5 text-[#015324] border-2 border-slate-300 rounded focus:ring-2 focus:ring-[#015324]/20"
            />
            <span className="text-sm text-slate-600">{field.placeholder || 'Check if applicable'}</span>
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-3">
            {field.options?.map((option) => (
              <div key={option} className="flex items-center gap-3">
                <input
                  type="radio"
                  name={field.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  required={field.required}
                  className="w-5 h-5 text-[#015324] border-2 border-slate-300 focus:ring-2 focus:ring-[#015324]/20"
                />
                <label className="text-sm text-slate-700">{option}</label>
              </div>
            ))}
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            className={baseInputClass}
          />
        );

      case 'time':
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            className={baseInputClass}
          />
        );

      case 'image':
        return (
          <div className="space-y-3">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    handleFieldChange(field.id, {
                      filename: file.name,
                      data: reader.result,
                      type: file.type,
                      size: file.size
                    });
                  };
                  reader.readAsDataURL(file);
                }
              }}
              required={field.required}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#015324] file:text-white hover:file:bg-[#014a20] file:cursor-pointer"
            />
            {value?.data && (
              <div className="relative">
                <img
                  src={value.data}
                  alt="Preview"
                  className="max-w-full h-auto max-h-64 rounded-lg border-2 border-slate-200 object-contain"
                />
                <div className="mt-2 text-xs text-slate-500">
                  {value.filename} ({(value.size / 1024).toFixed(2)} KB)
                </div>
              </div>
            )}
          </div>
        );

      default:
        return (
          <input
            type={field.type === 'phone' ? 'tel' : (field.inputMask?.type === 'currency' ? 'text' : field.type)}
            value={value}
            onChange={(e) => {
              const masked = applyInputMask(e.target.value, field.inputMask);
              handleFieldChange(field.id, masked);
            }}
            placeholder={placeholder}
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
            minLength={field.validation?.minLength}
            maxLength={field.inputMask?.maxLength || field.validation?.maxLength}
            pattern={field.validation?.pattern}
            className={baseInputClass}
          />
        );
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.customer_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
        <div className="sticky top-0 bg-gradient-to-r from-[#015324] to-[#017a33] px-8 py-6 flex items-center justify-between z-10">
          <div>
            <h3 className="text-2xl font-bold text-white">Add Form Response</h3>
            <p className="text-green-100 text-sm mt-1">{form.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">
              Select Customer <span className="text-red-500">*</span>
            </label>
            {loadingCustomers ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 text-[#015324] animate-spin" />
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 mb-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all text-slate-700"
                />
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#015324]/20 focus:border-[#015324] transition-all text-slate-700"
                >
                  <option value="">Choose a customer</option>
                  {filteredCustomers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.customer_name} ({customer.customer_code})
                    </option>
                  ))}
                </select>

                {selectedCustomerId && (() => {
                  const selected = customers.find(c => c.id === selectedCustomerId);
                  if (!selected) return null;
                  return (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Customer Code</p>
                        <p className="text-sm font-bold text-slate-800">{selected.customer_code}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          <p className="text-xs font-semibold text-emerald-600">Territory</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-800">{selected.territory_name || 'Unassigned'}</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MapPin className="w-3.5 h-3.5 text-blue-600" />
                          <p className="text-xs font-semibold text-blue-600">Sub-Territory</p>
                        </div>
                        <p className="text-sm font-bold text-blue-800">{selected.sub_territory_name || 'Unassigned'}</p>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          <div className="border-t-2 border-slate-200 pt-6">
            <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#015324]" />
              Form Fields
            </h4>
            <div className="space-y-4">
              {form.form_schema
                .sort((a, b) => a.order - b.order)
                .map((field) => (
                  <div key={field.id}>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {renderField(field)}
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gradient-to-r from-slate-50 to-white border-t-2 border-slate-200 px-8 py-5 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 text-slate-700 hover:bg-slate-200 rounded-xl transition-all duration-200 font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedCustomerId}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#015324] to-[#017a33] text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Response'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
