import { useState, useEffect } from 'react';
import {
  Users, Plus, Filter, Download, Search, TrendingUp, Target, Award, BarChart3, Activity, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { LeadService } from '../../lib/leads/lead-service';
import { LEAD_STATUS_CONFIG } from '../../lib/leads/types';
import type { LeadWithDetails, LeadFilters, LeadStats, LeadStatus } from '../../lib/leads/types';
import { TemplateConfigManager } from './TemplateConfigManager';
import { CreateLeadModal } from './CreateLeadModal';
import { LeadDetailModal } from './LeadDetailModal';
import { DateRangeSelector, getInitialDateRange } from '../common/DateRangeSelector';
import type { DateRangeValue } from '../common/DateRangeSelector';
import { useToast } from '../../contexts/ToastContext';

interface LeadsDashboardProps {
  orgId: string;
  userId: string;
  userRole: string;
}

export function LeadsDashboard({ orgId, userId, userRole }: LeadsDashboardProps) {
  const { showSuccess, showError, confirm } = useToast();
  const [leads, setLeads] = useState<LeadWithDetails[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'leads' | 'templates' | 'pipeline'>('leads');
  const [filters, setFilters] = useState<LeadFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadWithDetails | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const isAdmin = ['super_admin', 'client_admin', 'regional_admin', 'branch_admin'].includes(userRole);

  useEffect(() => {
    loadLeads();
    loadStats();
  }, [orgId, filters]);

  useEffect(() => {
    if (dateRange) {
      setFilters(prev => ({
        ...prev,
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      }));
    }
  }, [dateRange]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const data = await LeadService.listLeads(orgId, {
        ...filters,
        search: searchTerm || undefined
      });
      setLeads(data);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await LeadService.getLeadStats(orgId, filters);
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleStatusFilter = (status: LeadStatus | null) => {
    if (status) {
      setFilters({ ...filters, status });
    } else {
      const { status, ...rest } = filters;
      setFilters(rest);
    }
  };

  const handleExportToExcel = async () => {
    try {
      const exportData = leads.map((lead) => ({
        'Full Name': lead.full_name,
        'Email': lead.email || '',
        'Phone': lead.phone || '',
        'Company': lead.company || '',
        'Status': LEAD_STATUS_CONFIG[lead.status]?.label || lead.status,
        'Rank': lead.rank?.rank_label || '',
        'Progress Status': lead.progress_status ? lead.progress_status.charAt(0).toUpperCase() + lead.progress_status.slice(1) : '',
        'Qualified': lead.is_qualified ? 'Yes' : 'No',
        'Stale': lead.is_stale ? 'Yes' : 'No',
        'Source': lead.source ? lead.source.replace('_', ' ') : '',
        'Territory': lead.territory?.name || '',
        'Sub-Territory': lead.sub_territory?.name || '',
        'Assigned To': lead.assigned_user?.full_name || 'Unassigned',
        'Created By': lead.created_by_user?.full_name || 'Unknown',
        'Created At': new Date(lead.created_at).toLocaleString(),
        'Notes': lead.notes || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);

      const columnWidths = [
        { wch: 20 }, // Full Name
        { wch: 25 }, // Email
        { wch: 15 }, // Phone
        { wch: 20 }, // Company
        { wch: 12 }, // Status
        { wch: 15 }, // Progress Status
        { wch: 10 }, // Qualified
        { wch: 8 }, // Stale
        { wch: 15 }, // Source
        { wch: 20 }, // Territory
        { wch: 20 }, // Sub-Territory
        { wch: 20 }, // Assigned To
        { wch: 20 }, // Created By
        { wch: 20 }, // Created At
        { wch: 40 }, // Notes
      ];
      worksheet['!cols'] = columnWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `leads-export-${timestamp}.xlsx`);

      showSuccess('Export Successful', `Exported ${leads.length} leads to Excel`);
    } catch (error) {
      console.error('Error exporting leads:', error);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    loadLeads();
    loadStats();
  };

  const handleDeleteFromRow = async (e: React.MouseEvent, lead: LeadWithDetails) => {
    e.stopPropagation();
    const confirmed = await confirm(
      'Delete Lead',
      `Are you sure you want to permanently delete "${lead.full_name}"? This action cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await LeadService.deleteLead(lead.id);
      showSuccess('Lead Deleted', `${lead.full_name} has been removed`);
      loadLeads();
      loadStats();
    } catch (error) {
      console.error('Error deleting lead:', error);
      showError('Delete Failed', 'Unable to delete lead. Please try again.');
    }
  };

  if (view === 'templates' && isAdmin) {
    return (
      <div className="p-6 pt-20 lg:pt-6">
        <div className="mb-6">
          <button
            onClick={() => setView('leads')}
            className="text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            ← Back to Leads
          </button>
        </div>
        <TemplateConfigManager orgId={orgId} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pt-20 lg:pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Leads Management</h1>
          <p className="text-slate-500 text-sm sm:text-base">Track and manage your sales leads</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {leads.length > 0 && (
            <button
              onClick={handleExportToExcel}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
              title="Export leads to Excel"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setView('templates')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
            >
              <Filter className="w-4 h-4" />
              <span>Templates</span>
            </button>
          )}
          <button
            onClick={() => setView(view === 'pipeline' ? 'leads' : 'pipeline')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
          >
            <BarChart3 className="w-4 h-4" />
            <span>{view === 'pipeline' ? 'List View' : 'Pipeline'}</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {view === 'pipeline' && stats && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Lead Pipeline</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {(['new', 'hot', 'warm', 'negotiation', 'won'] as LeadStatus[]).map((status) => {
              const statusLeads = leads.filter(l => l.status === status);
              const statusConfig = LEAD_STATUS_CONFIG[status];
              return (
                <div key={status} className="bg-white rounded-xl border-2 border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-800">{statusConfig.label}</h3>
                    <span className={`text-2xl font-bold ${statusConfig.color}`}>
                      {statusLeads.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {statusLeads.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => {
                          setSelectedLead(lead);
                          setShowDetailModal(true);
                        }}
                        className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                      >
                        <div className="font-medium text-slate-800 text-sm truncate">
                          {lead.full_name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{lead.company || 'No company'}</div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-600">Score: {lead.score}</span>
                          <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#015324]"
                              style={{ width: `${lead.score}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    ))}
                    {statusLeads.length === 0 && (
                      <div className="text-center py-4 text-slate-400 text-sm">
                        No leads
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'leads' && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-600" />
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
            <div className="text-sm text-slate-500">Total Leads</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{stats.hot}</div>
            <div className="text-sm text-slate-500">Hot Leads</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{stats.won}</div>
            <div className="text-sm text-slate-500">Won</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl font-bold text-slate-800">{stats.conversion_rate}%</div>
            </div>
            <div className="text-sm text-slate-500">Conversion Rate</div>
          </div>
        </div>
      )}

      {view === 'leads' && (
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadLeads()}
                placeholder="Search leads..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
              />
            </div>
            <button
              onClick={loadLeads}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Search
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <DateRangeSelector
              value={dateRange || getInitialDateRange('today')}
              onChange={setDateRange}
              label="Date Range"
            />
            {dateRange && (
              <button
                onClick={() => {
                  setDateRange(null);
                  const { start_date, end_date, ...rest } = filters;
                  setFilters(rest);
                }}
                className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium self-end"
              >
                Clear Date Filter
              </button>
            )}
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
            <button
              onClick={() => handleStatusFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                !filters.status ? 'bg-[#015324] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {(['new', 'hot', 'warm', 'negotiation', 'won'] as LeadStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => handleStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  filters.status === status
                    ? 'bg-[#015324] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {LEAD_STATUS_CONFIG[status].label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Name</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Company</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Rank</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Score</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Assigned To</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Created</th>
                {isAdmin && <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => {
                    setSelectedLead(lead);
                    setShowDetailModal(true);
                  }}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-slate-800">{lead.full_name}</div>
                      <div className="text-sm text-slate-500">{lead.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{lead.company || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${LEAD_STATUS_CONFIG[lead.status].bgColor} ${LEAD_STATUS_CONFIG[lead.status].color}`}>
                      {LEAD_STATUS_CONFIG[lead.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {lead.rank ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${lead.rank.rank_bg_color} ${lead.rank.rank_color}`}>
                        {lead.rank.rank_label}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#015324]"
                          style={{ width: `${lead.score}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-700">{lead.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {lead.assigned_user?.full_name || 'Unassigned'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-sm">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => handleDeleteFromRow(e, lead)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete lead"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {loading && (
            <div className="text-center py-12 text-slate-500">
              <div className="animate-spin w-8 h-8 border-4 border-slate-300 border-t-[#015324] rounded-full mx-auto mb-3"></div>
              <p>Loading leads...</p>
            </div>
          )}

          {!loading && leads.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No leads found</p>
              <p className="text-sm mt-1">Create your first lead to get started</p>
            </div>
          )}
        </div>
      </div>
      )}

      <CreateLeadModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          loadLeads();
          loadStats();
        }}
        orgId={orgId}
        userId={userId}
      />

      <LeadDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedLead(null);
        }}
        lead={selectedLead}
        onUpdate={() => {
          loadLeads();
          loadStats();
        }}
        onDelete={isAdmin ? handleDeleteLead : undefined}
      />
    </div>
  );
}
