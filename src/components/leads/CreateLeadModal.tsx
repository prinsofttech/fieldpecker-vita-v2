import { useState, useEffect } from 'react';
import { X, Save, Upload, Image as ImageIcon } from 'lucide-react';
import { LeadService } from '../../lib/leads/lead-service';
import type { LeadFormTemplate, LeadFormField, LeadRank, LeadStatusRecord, CreateLeadData } from '../../lib/leads/types';
import { LEAD_SOURCES } from '../../lib/leads/types';
import { useToast } from '../../contexts/ToastContext';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  userId: string;
}

export function CreateLeadModal({ isOpen, onClose, onSuccess, orgId, userId }: CreateLeadModalProps) {
  const { showSuccess, showError } = useToast();
  const [templates, setTemplates] = useState<LeadFormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<LeadFormTemplate | null>(null);
  const [templateFields, setTemplateFields] = useState<LeadFormField[]>([]);
  const [ranks, setRanks] = useState<LeadRank[]>([]);
  const [statuses, setStatuses] = useState<LeadStatusRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    full_name: '',
    email: '',
    phone: '',
    company: '',
    status: '',
    rank_id: '',
    source: '',
    notes: '',
    picture_url: ''
  });
  const [dynamicFieldValues, setDynamicFieldValues] = useState<Record<string, string>>({});
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      loadRanks();
      loadStatuses();
    }
  }, [isOpen, orgId]);

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateFields();
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    try {
      const data = await LeadService.listTemplates(orgId);
      setTemplates(data);
      if (data.length > 0) {
        const defaultTemplate = data.find(t => t.is_default) || data[0];
        setSelectedTemplate(defaultTemplate);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
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

  const loadRanks = async () => {
    try {
      const data = await LeadService.listRanks(orgId);
      setRanks(data);
      const defaultRank = data.find(r => r.is_default);
      if (defaultRank) {
        setFormData((prev: any) => ({ ...prev, rank_id: defaultRank.id }));
      }
    } catch (error) {
      console.error('Error loading ranks:', error);
    }
  };

  const loadStatuses = async () => {
    try {
      const data = await LeadService.listStatuses(orgId);
      setStatuses(data);
      const defaultStatus = data.find(s => s.is_default);
      if (defaultStatus) {
        setFormData((prev: any) => ({ ...prev, status: defaultStatus.status_key }));
      } else if (data.length > 0) {
        setFormData((prev: any) => ({ ...prev, status: data[0].status_key }));
      }
    } catch (error) {
      console.error('Error loading statuses:', error);
    }
  };

  const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showError('File Too Large', 'Please select an image smaller than 5MB');
        return;
      }
      setPictureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPicturePreview(reader.result as string);
        setFormData({ ...formData, picture_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fieldValues = Object.entries(dynamicFieldValues).map(([fieldId, value]) => ({
        field_id: fieldId,
        field_value: value
      }));

      const { rank_id, ...restForm } = formData;
      const leadData: CreateLeadData = {
        org_id: orgId,
        template_id: selectedTemplate?.id,
        ...restForm,
        rank_id: rank_id || undefined,
        field_values: fieldValues
      };

      await LeadService.createLead(leadData);
      showSuccess('Lead Created', 'New lead has been successfully created');
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error creating lead:', error);
      showError('Creation Failed', 'Unable to create lead. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    const defaultStatus = statuses.find(s => s.is_default);
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      company: '',
      status: defaultStatus?.status_key || '',
      rank_id: '',
      source: '',
      notes: '',
      picture_url: ''
    });
    setDynamicFieldValues({});
    setPictureFile(null);
    setPicturePreview('');
    onClose();
  };

  const renderDynamicField = (field: LeadFormField) => {
    const value = dynamicFieldValues[field.id] || '';

    switch (field.field_type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => setDynamicFieldValues({ ...dynamicFieldValues, [field.id]: e.target.value })}
            placeholder={field.placeholder}
            required={field.is_required}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
            rows={3}
          />
        );
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => setDynamicFieldValues({ ...dynamicFieldValues, [field.id]: e.target.value })}
            required={field.is_required}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
          >
            <option value="">Select {field.field_label}</option>
            {field.field_options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => setDynamicFieldValues({ ...dynamicFieldValues, [field.id]: e.target.checked.toString() })}
            className="w-4 h-4 text-[#015324] rounded focus:ring-[#015324]"
          />
        );
      default:
        return (
          <input
            type={field.field_type}
            value={value}
            onChange={(e) => setDynamicFieldValues({ ...dynamicFieldValues, [field.id]: e.target.value })}
            placeholder={field.placeholder}
            required={field.is_required}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
          />
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Create New Lead</h2>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {templates.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Form Template
                </label>
                <select
                  value={selectedTemplate?.id || ''}
                  onChange={(e) => {
                    const template = templates.find(t => t.id === e.target.value);
                    setSelectedTemplate(template || null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Lead Picture
              </label>
              <div className="flex items-center gap-4">
                {picturePreview ? (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-slate-300">
                    <img src={picturePreview} alt="Lead preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setPictureFile(null);
                        setPicturePreview('');
                        setFormData({ ...formData, picture_url: '' });
                      }}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-slate-400" />
                  </div>
                )}
                <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Upload Picture</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePictureChange}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-2">Max file size: 5MB</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Company
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  placeholder="Company Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lead Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.status_key}>
                      {s.status_label}
                    </option>
                  ))}
                </select>
              </div>

              {ranks.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Lead Rank
                  </label>
                  <select
                    value={formData.rank_id}
                    onChange={(e) => setFormData({ ...formData, rank_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  >
                    <option value="">Select Rank</option>
                    {ranks.map((rank) => (
                      <option key={rank.id} value={rank.id}>
                        {rank.rank_label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lead Source
                </label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                >
                  <option value="">Select Source</option>
                  {LEAD_SOURCES.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {templateFields.length > 0 && (
              <>
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Additional Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templateFields.map((field) => (
                      <div key={field.id} className={field.field_type === 'textarea' ? 'md:col-span-2' : ''}>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          {field.field_label}
                          {field.is_required && <span className="text-red-600 ml-1">*</span>}
                        </label>
                        {renderDynamicField(field)}
                        {field.help_text && (
                          <p className="text-xs text-slate-500 mt-1">{field.help_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                rows={3}
                placeholder="Add any additional notes..."
              />
            </div>
          </div>

          <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
