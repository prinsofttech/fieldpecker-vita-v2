import { useState, useEffect } from 'react';
import { FileText, Clock, CheckCircle, XCircle, Send } from 'lucide-react';
import type { Form, FormVisibility, FormField } from '../../lib/forms/types';
import { FormService } from '../../lib/forms/form-service';
import { applyInputMask, getMaskPlaceholder } from '../../lib/forms/input-mask-utils';
import { useToast } from '../../contexts/ToastContext';

interface AgentFormViewProps {
  agentId: string;
}

export function AgentFormView({ agentId }: AgentFormViewProps) {
  const { showSuccess, showError } = useToast();
  const [availableForms, setAvailableForms] = useState<{ form: Form; visibility: FormVisibility }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formStartTime, setFormStartTime] = useState<Date | null>(null);
  const [geolocation, setGeolocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    loadAvailableForms();
    const interval = setInterval(loadAvailableForms, 30000);
    return () => clearInterval(interval);
  }, [agentId]);

  const loadAvailableForms = async () => {
    try {
      const forms = await FormService.getAvailableForms(agentId);
      setAvailableForms(forms);
    } catch (error) {
      console.error('Error loading available forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id] || '';

    const maskPlaceholder = getMaskPlaceholder(field.inputMask);
    const placeholder = field.placeholder || maskPlaceholder;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <input
            type={field.type === 'phone' ? 'tel' : field.type}
            value={value}
            onChange={(e) => {
              const masked = applyInputMask(e.target.value, field.inputMask);
              handleFieldChange(field.id, masked);
            }}
            placeholder={placeholder}
            required={field.required}
            maxLength={field.inputMask?.maxLength}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
          />
        );

      case 'number':
        return (
          <input
            type={field.inputMask?.type === 'currency' ? 'text' : 'number'}
            value={value}
            onChange={(e) => {
              const masked = applyInputMask(e.target.value, field.inputMask);
              handleFieldChange(field.id, masked);
            }}
            placeholder={placeholder}
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
            maxLength={field.inputMask?.maxLength}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
          />
        );

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
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
          >
            <option value="">Select an option</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'date': {
        const today = new Date().toISOString().split('T')[0];
        let minDate: string | undefined;
        let maxDate: string | undefined;

        if (field.dateRestriction === 'past') {
          maxDate = today;
        } else if (field.dateRestriction === 'future') {
          minDate = today;
        } else if (field.dateRestriction === 'today-future') {
          minDate = today;
        } else if (field.dateRestriction === 'today-past') {
          maxDate = today;
        }

        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            min={minDate}
            max={maxDate}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
          />
        );
      }

      case 'time':
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
          />
        );

      case 'checkbox':
        if (field.options && field.options.length > 0) {
          return (
            <div className="space-y-2">
              {field.options.map((option) => (
                <label key={option} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Array.isArray(value) && value.includes(option)}
                    onChange={(e) => {
                      const currentValue = Array.isArray(value) ? value : [];
                      if (e.target.checked) {
                        handleFieldChange(field.id, [...currentValue, option]);
                      } else {
                        handleFieldChange(field.id, currentValue.filter((v: string) => v !== option));
                      }
                    }}
                    className="w-5 h-5 text-[#015324] border-slate-300 rounded focus:ring-2 focus:ring-[#015324]"
                  />
                  <span className="text-slate-700">{option}</span>
                </label>
              ))}
            </div>
          );
        }
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              className="w-5 h-5 text-[#015324] border-slate-300 rounded focus:ring-2 focus:ring-[#015324]"
            />
            <span className="text-slate-700">{field.label}</span>
          </label>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  className="w-5 h-5 text-[#015324] border-slate-300 focus:ring-2 focus:ring-[#015324]"
                />
                <span className="text-slate-700">{option}</span>
              </label>
            ))}
          </div>
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
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#015324] file:text-white hover:file:bg-[#014a20] file:cursor-pointer"
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
        return <div className="text-slate-500">Unsupported field type: {field.type}</div>;
    }
  };

  const captureGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeolocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting geolocation:', error);
        }
      );
    }
  };

  const handleFormSelect = (form: Form) => {
    setSelectedForm(form);
    setFormData({});
    setFormStartTime(new Date());
    captureGeolocation();
  };

  const calculateTimeSpent = (): string => {
    if (!formStartTime) return '0 seconds';
    const endTime = new Date();
    const diffMs = endTime.getTime() - formStartTime.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const minutes = Math.floor(diffSecs / 60);
    const seconds = diffSecs % 60;
    return `${minutes} minutes ${seconds} seconds`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedForm) return;

    setSubmitting(true);
    try {
      // Get supervisor info from the current user's data
      const { data: userData } = await FormService.getCurrentUserData();

      const result = await FormService.submitForm({
        form_id: selectedForm.id,
        agent_id: agentId,
        submission_data: formData,
        latitude: geolocation?.latitude,
        longitude: geolocation?.longitude,
        time_spent: calculateTimeSpent(),
        supervisor_name: userData?.supervisor_name,
        supervisor_code: userData?.supervisor_code,
        form_started_at: formStartTime?.toISOString()
      });

      if (result.success) {
        showSuccess('Form Submitted', `Form submitted successfully! ${result.frozen_until ? `Next submission available after ${new Date(result.frozen_until).toLocaleString()}` : ''}`);
        setSelectedForm(null);
        setFormData({});
        setFormStartTime(null);
        setGeolocation(null);
        loadAvailableForms();
      } else {
        showError('Submission Failed', `Failed to submit form: ${result.error}`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      showError('Submission Failed', 'Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-[#015324] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (selectedForm) {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => {
            setSelectedForm(null);
            setFormData({});
          }}
          className="mb-4 text-[#015324] hover:underline"
        >
          ← Back to forms list
        </button>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{selectedForm.title}</h2>
          {selectedForm.description && (
            <p className="text-slate-600 mb-6">{selectedForm.description}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {selectedForm.form_schema
              .sort((a, b) => a.order - b.order)
              .map((field) => (
                <div key={field.id}>
                  {field.type !== 'checkbox' && (
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  )}
                  {renderField(field)}
                </div>
              ))}

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setSelectedForm(null);
                  setFormData({});
                }}
                disabled={submitting}
                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Form
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">My Forms</h2>
        <p className="text-slate-600 mt-1">Complete your assigned forms</p>
      </div>

      {availableForms.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
          <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No forms available</h3>
          <p className="text-slate-600">Check back later for new forms to complete</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableForms.map(({ form, visibility }) => (
            <div
              key={form.id}
              className="bg-white rounded-xl border-2 border-slate-200 p-6 hover:shadow-lg transition-all"
            >
              <h3 className="text-lg font-bold text-slate-800 mb-2">{form.title}</h3>
              {form.description && (
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{form.description}</p>
              )}

              <div className="space-y-2 mb-4 pb-4 border-b border-slate-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Progress</span>
                  <span className="font-medium text-[#015324]">
                    {visibility.current_cycle || 0} / {visibility.max_cycles || 0}
                  </span>
                </div>
                {visibility.remaining_submissions !== undefined && (
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-[#015324] h-2 rounded-full transition-all"
                      style={{
                        width: `${((visibility.current_cycle || 0) / (visibility.max_cycles || 1)) * 100}%`
                      }}
                    />
                  </div>
                )}
              </div>

              <button
                onClick={() => handleFormSelect(form)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors"
              >
                <FileText className="w-5 h-5" />
                Fill Form
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
