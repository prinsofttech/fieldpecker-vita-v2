import { useState, useEffect } from 'react';
import {
  X, Mail, Phone, Building2, Calendar, User, TrendingUp, MapPin,
  Clock, Edit2, Save, History, Upload, Image as ImageIcon, Flag, Target, CheckCircle, Flame, Trash2
} from 'lucide-react';
import { LeadService } from '../../lib/leads/lead-service';
import { supabase } from '../../lib/supabase/client';
import type { LeadWithDetails, LeadStatus, LeadStatusHistory, LeadRank, LeadStatusRecord } from '../../lib/leads/types';
import { LEAD_STATUS_CONFIG } from '../../lib/leads/types';
import { useToast } from '../../contexts/ToastContext';

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: LeadWithDetails | null;
  onUpdate: () => void;
  onDelete?: (leadId: string) => void;
}

export function LeadDetailModal({ isOpen, onClose, lead, onUpdate, onDelete }: LeadDetailModalProps) {
  const { showSuccess, showError, confirm } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [statusHistory, setStatusHistory] = useState<LeadStatusHistory[]>([]);
  const [fieldValues, setFieldValues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [territories, setTerritories] = useState<any[]>([]);
  const [subTerritories, setSubTerritories] = useState<any[]>([]);
  const [ranks, setRanks] = useState<LeadRank[]>([]);
  const [statuses, setStatuses] = useState<LeadStatusRecord[]>([]);
  const [picturePreview, setPicturePreview] = useState<string>('');
  const [editData, setEditData] = useState({
    full_name: lead?.full_name || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    company: lead?.company || '',
    status: lead?.status || 'new',
    rank_id: lead?.rank_id || '',
    source: lead?.source || '',
    territory_id: lead?.territory_id || '',
    sub_territory_id: lead?.sub_territory_id || '',
    is_qualified: lead?.is_qualified || false,
    is_stale: lead?.is_stale || false,
    progress_status: lead?.progress_status || '',
    picture_url: lead?.picture_url || '',
    notes: lead?.notes || ''
  });

  useEffect(() => {
    if (lead && isOpen) {
      loadLeadDetails();
      loadTerritories();
      loadRanks();
      loadStatuses();
      setEditData({
        full_name: lead.full_name,
        email: lead.email || '',
        phone: lead.phone || '',
        company: lead.company || '',
        status: lead.status,
        rank_id: lead.rank_id || '',
        source: lead.source || '',
        territory_id: lead.territory_id || '',
        sub_territory_id: lead.sub_territory_id || '',
        is_qualified: lead.is_qualified,
        is_stale: lead.is_stale,
        progress_status: lead.progress_status || '',
        picture_url: lead.picture_url || '',
        notes: lead.notes || ''
      });
      setPicturePreview(lead.picture_url || '');
    }
  }, [lead, isOpen]);

  useEffect(() => {
    if (editData.territory_id) {
      loadSubTerritories(editData.territory_id);
    } else {
      setSubTerritories([]);
    }
  }, [editData.territory_id]);

  const loadLeadDetails = async () => {
    if (!lead) return;
    try {
      const [history, fields] = await Promise.all([
        LeadService.getLeadStatusHistory(lead.id),
        LeadService.getLeadFieldValues(lead.id)
      ]);
      setStatusHistory(history);
      setFieldValues(fields);
    } catch (error) {
      console.error('Error loading lead details:', error);
    }
  };

  const loadTerritories = async () => {
    if (!lead) return;
    try {
      const { data } = await supabase
        .from('regions')
        .select('id, name, code')
        .eq('org_id', lead.org_id)
        .is('parent_id', null)
        .eq('is_active', true)
        .order('name');
      setTerritories(data || []);
    } catch (error) {
      console.error('Error loading territories:', error);
    }
  };

  const loadSubTerritories = async (parentId: string) => {
    if (!lead) return;
    try {
      const { data } = await supabase
        .from('regions')
        .select('id, name, code')
        .eq('org_id', lead.org_id)
        .eq('parent_id', parentId)
        .eq('is_active', true)
        .order('name');
      setSubTerritories(data || []);
    } catch (error) {
      console.error('Error loading sub-territories:', error);
    }
  };

  const loadRanks = async () => {
    if (!lead) return;
    try {
      const data = await LeadService.listRanks(lead.org_id);
      setRanks(data);
    } catch (error) {
      console.error('Error loading ranks:', error);
    }
  };

  const loadStatuses = async () => {
    if (!lead) return;
    try {
      const data = await LeadService.listStatuses(lead.org_id);
      setStatuses(data);
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
      const reader = new FileReader();
      reader.onloadend = () => {
        setPicturePreview(reader.result as string);
        setEditData({ ...editData, picture_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!lead) return;
    setLoading(true);
    try {
      await LeadService.updateLead(lead.id, {
        ...editData,
        rank_id: editData.rank_id || null,
        territory_id: editData.territory_id || null,
        sub_territory_id: editData.sub_territory_id || null,
        progress_status: editData.progress_status || null
      });
      showSuccess('Lead Updated', 'Lead information has been successfully updated');
      setIsEditing(false);
      onUpdate();
      await loadLeadDetails();
    } catch (error) {
      console.error('Error updating lead:', error);
      showError('Update Failed', 'Unable to update lead. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!lead || !onDelete) return;
    const confirmed = await confirm(
      'Delete Lead',
      `Are you sure you want to permanently delete "${lead.full_name}"? This action cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await LeadService.deleteLead(lead.id);
      showSuccess('Lead Deleted', `${lead.full_name} has been removed`);
      onDelete(lead.id);
      onClose();
    } catch (error) {
      console.error('Error deleting lead:', error);
      showError('Delete Failed', 'Unable to delete lead. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const getLeadAge = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return '1 day old';
    if (diffDays < 30) return `${diffDays} days old`;
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} old`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''} old`;
  };

  const getStatusConfig = (statusKey: string) => {
    const dbStatus = statuses.find(s => s.status_key === statusKey);
    if (dbStatus) {
      return { label: dbStatus.status_label, color: dbStatus.status_color, bgColor: dbStatus.status_bg_color };
    }
    return LEAD_STATUS_CONFIG[statusKey as LeadStatus] || { label: statusKey, color: 'text-slate-700', bgColor: 'bg-slate-100' };
  };

  if (!isOpen || !lead) return null;

  const statusConfig = getStatusConfig(lead.status);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-[#015324] to-[#01793a]">
          <div className="flex items-center gap-4">
            {picturePreview ? (
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white">
                <img src={picturePreview} alt={lead.full_name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-[#015324]" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">{lead.full_name}</h2>
              <p className="text-white/80">{lead.company || 'No company'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-2 bg-white/10 hover:bg-red-500/80 text-white rounded-lg transition-colors disabled:opacity-50"
                title="Delete lead"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {isEditing && (
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
                          setPicturePreview('');
                          setEditData({ ...editData, picture_url: '' });
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
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
                  Contact Information
                </h3>

                {isEditing ? (
                  <>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editData.full_name}
                        onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Email</label>
                      <input
                        type="email"
                        value={editData.email}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={editData.phone}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Company</label>
                      <input
                        type="text"
                        value={editData.company}
                        onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324]"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {lead.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="text-xs text-slate-500">Email</div>
                          <a href={`mailto:${lead.email}`} className="text-[#015324] hover:underline">
                            {lead.email}
                          </a>
                        </div>
                      </div>
                    )}

                    {lead.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="text-xs text-slate-500">Phone</div>
                          <a href={`tel:${lead.phone}`} className="text-[#015324] hover:underline">
                            {lead.phone}
                          </a>
                        </div>
                      </div>
                    )}

                    {lead.company && (
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="text-xs text-slate-500">Company</div>
                          <div className="text-slate-800">{lead.company}</div>
                        </div>
                      </div>
                    )}

                    {lead.source && (
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="text-xs text-slate-500">Source</div>
                          <div className="text-slate-800 capitalize">{lead.source.replace('_', ' ')}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
                  Lead Details
                </h3>

                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-slate-400" />
                  <div className="flex-1">
                    <div className="text-xs text-slate-500">Status</div>
                    {isEditing ? (
                      <select
                        value={editData.status}
                        onChange={(e) => setEditData({ ...editData, status: e.target.value as LeadStatus })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324]"
                      >
                        {statuses.map((s) => (
                          <option key={s.id} value={s.status_key}>
                            {s.status_label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    )}
                  </div>
                </div>

                {ranks.length > 0 && (
                  <div className="flex items-center gap-3">
                    <Flame className="w-5 h-5 text-slate-400" />
                    <div className="flex-1">
                      <div className="text-xs text-slate-500">Rank</div>
                      {isEditing ? (
                        <select
                          value={editData.rank_id}
                          onChange={(e) => setEditData({ ...editData, rank_id: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324]"
                        >
                          <option value="">No Rank</option>
                          {ranks.map((rank) => (
                            <option key={rank.id} value={rank.id}>
                              {rank.rank_label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        lead.rank ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${lead.rank.rank_bg_color} ${lead.rank.rank_color}`}>
                            {lead.rank.rank_label}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-sm">Not ranked</span>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-slate-400" />
                  <div className="flex-1">
                    <div className="text-xs text-slate-500 mb-1">Progress Status</div>
                    {isEditing ? (
                      <select
                        value={editData.progress_status}
                        onChange={(e) => setEditData({ ...editData, progress_status: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324]"
                      >
                        <option value="">None</option>
                        <option value="negotiation">Negotiation</option>
                        <option value="won">Won</option>
                        <option value="closed">Closed</option>
                      </select>
                    ) : (
                      <div className="text-slate-800">
                        {lead.progress_status ? lead.progress_status.charAt(0).toUpperCase() + lead.progress_status.slice(1) : 'None'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Flag className="w-5 h-5 text-slate-400" />
                  <div className="flex-1">
                    <div className="text-xs text-slate-500 mb-1">Qualified</div>
                    {isEditing ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editData.is_qualified}
                          onChange={(e) => setEditData({ ...editData, is_qualified: e.target.checked })}
                          className="w-5 h-5 text-[#015324] rounded focus:ring-[#015324]"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          {editData.is_qualified ? 'Yes' : 'No'}
                        </span>
                      </label>
                    ) : (
                      <div className="flex items-center gap-2">
                        {lead.is_qualified ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-600">No</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="flex items-center gap-3">
                    <Flag className="w-5 h-5 text-slate-400" />
                    <div className="flex-1">
                      <div className="text-xs text-slate-500 mb-1">Mark as Stale</div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editData.is_stale}
                          onChange={(e) => setEditData({ ...editData, is_stale: e.target.checked })}
                          className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          {editData.is_stale ? 'Lead is stale' : 'Lead is active'}
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {!isEditing && lead.is_stale && (
                  <div className="flex items-center gap-3">
                    <Flag className="w-5 h-5 text-orange-400" />
                    <div>
                      <div className="text-xs text-slate-500">Status</div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        Stale Lead
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <div>
                    <div className="text-xs text-slate-500">Age</div>
                    <div className="text-slate-800">
                      {getLeadAge(lead.created_at)}
                    </div>
                  </div>
                </div>

                {lead.assigned_user && (
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">Assigned To</div>
                      <div className="text-slate-800">
                        {lead.assigned_user.full_name}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Territory
                  </label>
                  <select
                    value={editData.territory_id}
                    onChange={(e) => setEditData({ ...editData, territory_id: e.target.value, sub_territory_id: '' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324]"
                  >
                    <option value="">Select Territory</option>
                    {territories.map((territory) => (
                      <option key={territory.id} value={territory.id}>
                        {territory.name} {territory.code && `(${territory.code})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Sub-Territory
                  </label>
                  <select
                    value={editData.sub_territory_id}
                    onChange={(e) => setEditData({ ...editData, sub_territory_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324]"
                    disabled={!editData.territory_id}
                  >
                    <option value="">Select Sub-Territory</option>
                    {subTerritories.map((territory) => (
                      <option key={territory.id} value={territory.id}>
                        {territory.name} {territory.code && `(${territory.code})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {!isEditing && (lead.territory || lead.sub_territory) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lead.territory && (
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Territory</div>
                    <div className="text-slate-800 font-medium">{lead.territory.name}</div>
                  </div>
                )}
                {lead.sub_territory && (
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Sub-Territory</div>
                    <div className="text-slate-800 font-medium">{lead.sub_territory.name}</div>
                  </div>
                )}
              </div>
            )}

            {fieldValues.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-4">
                  Additional Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fieldValues.map((fv: any) => (
                    <div key={fv.id} className="bg-slate-50 p-3 rounded-lg">
                      <div className="text-xs text-slate-500 mb-1">{fv.field?.field_label}</div>
                      <div className="text-slate-800">{fv.field_value || '-'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-4">
                Notes
              </h3>
              {isEditing ? (
                <textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324]"
                  rows={4}
                  placeholder="Add notes about this lead..."
                />
              ) : (
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {lead.notes || 'No notes available'}
                  </p>
                </div>
              )}
            </div>

            {statusHistory.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Status History
                </h3>
                <div className="space-y-3">
                  {statusHistory.map((history: any) => (
                    <div key={history.id} className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg">
                      <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {history.old_status && (
                            <>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusConfig(history.old_status).bgColor} ${getStatusConfig(history.old_status).color}`}>
                                {getStatusConfig(history.old_status).label}
                              </span>
                              <span className="text-slate-400">→</span>
                            </>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusConfig(history.new_status).bgColor} ${getStatusConfig(history.new_status).color}`}>
                            {getStatusConfig(history.new_status).label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {new Date(history.changed_at).toLocaleString()} by {history.changed_by_user?.full_name || 'System'}
                        </div>
                        {history.notes && (
                          <div className="text-sm text-slate-600 mt-1">{history.notes}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditData({
                  full_name: lead.full_name,
                  email: lead.email || '',
                  phone: lead.phone || '',
                  company: lead.company || '',
                  status: lead.status,
                  rank_id: lead.rank_id || '',
                  source: lead.source || '',
                  territory_id: lead.territory_id || '',
                  sub_territory_id: lead.sub_territory_id || '',
                  is_qualified: lead.is_qualified,
                  is_stale: lead.is_stale,
                  progress_status: lead.progress_status || '',
                  picture_url: lead.picture_url || '',
                  notes: lead.notes || ''
                });
                setPicturePreview(lead.picture_url || '');
              }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
