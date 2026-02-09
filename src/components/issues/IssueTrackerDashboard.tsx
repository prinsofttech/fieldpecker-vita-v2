import React, { useState, useEffect } from 'react';
import { Plus, Filter, Search, AlertCircle, Clock, CheckCircle, Eye, ChevronRight, Calendar, Settings, Download, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { IssueService } from '../../lib/issues/issue-service';
import { supabase } from '../../lib/supabase/client';
import type { Issue, IssueStats, IssueFilters } from '../../lib/issues/types';
import { CreateIssueModal } from './CreateIssueModal';
import { IssueDetailModal } from './IssueDetailModal';
import { IssueSettingsManager } from './IssueSettingsManager';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { DateRangeSelector, getInitialDateRange } from '../common/DateRangeSelector';
import type { DateRangeValue } from '../common/DateRangeSelector';
import { useToast } from '../../contexts/ToastContext';

export function IssueTrackerDashboard() {
  const { showSuccess, showError } = useToast();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState<IssueFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>(getInitialDateRange('today'));
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [regions, setRegions] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<Map<string, any>>(new Map());
  const [customers, setCustomers] = useState<Map<string, any>>(new Map());
  const [categories, setCategories] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);

  useEffect(() => {
    fetchUserOrg();
  }, []);

  useEffect(() => {
    if (orgId) {
      loadStats();
      loadRegions();
      loadUsers();
      loadCustomers();
      loadCategories();
      loadStatuses();
    }
  }, [orgId]);

  useEffect(() => {
    if (filters.region_id) {
      loadBranches(filters.region_id);
    } else {
      setBranches([]);
    }
  }, [filters.region_id]);

  const fetchUserOrg = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('org_id, role:roles(name)')
        .eq('id', user.id)
        .single();

      if (data) {
        setOrgId(data.org_id);
        setUserRole((data.role as any)?.name || '');
      }
    }
  };

  const loadStats = async () => {
    if (!orgId) return;
    const data = await IssueService.getIssueStats(orgId);
    setStats(data);
  };

  const loadRegions = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('regions')
      .select('id, name, code')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('name');
    setRegions(data || []);
  };

  const loadUsers = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('org_id', orgId);

    if (data) {
      const userMap = new Map(data.map(u => [u.id, u]));
      setUsers(userMap);
    }
  };

  const loadCustomers = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('customers')
      .select('id, customer_name')
      .eq('org_id', orgId);

    if (data) {
      const customerMap = new Map(data.map(c => [c.id, c]));
      setCustomers(customerMap);
    }
  };

  const loadCategories = async () => {
    if (!orgId) return;
    const data = await IssueService.getCategories(orgId);
    setCategories(data);
  };

  const loadStatuses = async () => {
    if (!orgId) return;
    const data = await IssueService.getCustomStatuses(orgId);
    setStatuses(data);
  };

  const loadBranches = async (regionId: string) => {
    if (!orgId) return;
    const { data } = await supabase
      .from('branches')
      .select('id, name, code')
      .eq('org_id', orgId)
      .eq('region_id', regionId)
      .eq('is_active', true)
      .order('name');
    setBranches(data || []);
  };

  const handleSearch = () => {
    setHasSearched(true);
    const appliedFilters = {
      ...filters,
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
    };
    loadIssuesWithFilters(appliedFilters);
  };

  const loadIssuesWithFilters = async (appliedFilters: IssueFilters) => {
    if (!orgId) return;
    setLoading(true);
    const data = await IssueService.listIssues(orgId, { ...appliedFilters, search: searchQuery });
    setIssues(data);
    setLoading(false);
  };

  const handleExportToExcel = async () => {
    try {
      const exportData = issues.map((issue) => {
        const reporter = users.get(issue.reported_by);
        const assignee = users.get(issue.assigned_to || '');
        const customer = issue.customer_id ? customers.get(issue.customer_id) : null;
        const category = categories.find(c => c.id === issue.category_id);
        const status = statuses.find(s => s.id === issue.status_id);

        return {
          'Issue Number': issue.issue_number,
          'Title': issue.title,
          'Customer': customer?.customer_name || '',
          'Description': issue.description || '',
          'Priority': issue.priority.toUpperCase(),
          'Status': status?.display_name || issue.status || '',
          'Category': category?.name || 'N/A',
          'Reported By': reporter?.full_name || 'Unknown',
          'Reported At': new Date(issue.reported_at).toLocaleString(),
          'Assigned To': assignee?.full_name || 'Unassigned',
          'Assigned At': issue.assigned_at ? new Date(issue.assigned_at).toLocaleString() : '',
          'Due Date': issue.due_date ? new Date(issue.due_date).toLocaleDateString() : '',
          'Action Taken': issue.action_taken || '',
          'Created At': new Date(issue.created_at).toLocaleString(),
          'Updated At': new Date(issue.updated_at).toLocaleString(),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);

      const columnWidths = [
        { wch: 15 }, // Issue Number
        { wch: 30 }, // Title
        { wch: 25 }, // Customer
        { wch: 40 }, // Description
        { wch: 10 }, // Priority
        { wch: 15 }, // Status
        { wch: 20 }, // Category
        { wch: 20 }, // Reported By
        { wch: 20 }, // Reported At
        { wch: 20 }, // Assigned To
        { wch: 20 }, // Assigned At
        { wch: 15 }, // Due Date
        { wch: 40 }, // Action Taken
        { wch: 20 }, // Created At
        { wch: 20 }, // Updated At
      ];
      worksheet['!cols'] = columnWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Issues');

      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `issues-export-${timestamp}.xlsx`);

      showSuccess('Export Successful', `Exported ${issues.length} issues to Excel`);
    } catch (error) {
      console.error('Error exporting issues:', error);
    }
  };

  const isAdmin = ['super_admin', 'client_admin', 'regional_admin', 'branch_admin'].includes(userRole);

  const handleDeleteIssue = async () => {
    if (!issueToDelete) return;
    setDeleting(true);
    try {
      const success = await IssueService.deleteIssue(issueToDelete.id);
      if (success) {
        showSuccess('Issue Deleted', `Issue ${issueToDelete.issue_number} has been deleted`);
        setIssueToDelete(null);
        if (hasSearched) handleSearch();
        loadStats();
      } else {
        showError('Delete Failed', 'Unable to delete this issue. Please try again.');
      }
    } catch {
      showError('Delete Failed', 'Unable to delete this issue. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high':
        return {
          bg: 'bg-gradient-to-r from-red-50 to-red-100',
          text: 'text-red-700',
          border: 'border-red-200',
          icon: <AlertCircle className="w-4 h-4" />,
          label: 'High'
        };
      case 'medium':
        return {
          bg: 'bg-gradient-to-r from-yellow-50 to-yellow-100',
          text: 'text-yellow-700',
          border: 'border-yellow-200',
          icon: <AlertCircle className="w-4 h-4" />,
          label: 'Medium'
        };
      case 'low':
        return {
          bg: 'bg-gradient-to-r from-green-50 to-green-100',
          text: 'text-green-700',
          border: 'border-green-200',
          icon: <CheckCircle className="w-4 h-4" />,
          label: 'Low'
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-slate-50 to-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-200',
          icon: <AlertCircle className="w-4 h-4" />,
          label: priority
        };
    }
  };

  const getStatusForIssue = (issue: Issue) => {
    return statuses.find(s => s.id === issue.status_id) || null;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 pt-20 lg:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              Issue Tracker
            </h1>
            <p className="text-slate-600 mt-2">Track and resolve issues across your organization</p>
          </div>
          <div className="flex items-center gap-3">
            {issues.length > 0 && (
              <button
                onClick={handleExportToExcel}
                className="bg-white text-slate-700 px-6 py-4 rounded-xl hover:bg-slate-50 transition-all duration-300 flex items-center gap-3 shadow-md border border-slate-200 hover:shadow-lg hover:-translate-y-0.5"
                title="Export issues to Excel"
              >
                <Download className="w-5 h-5" />
                <span className="font-semibold hidden sm:inline">Export</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="bg-white text-slate-700 px-6 py-4 rounded-xl hover:bg-slate-50 transition-all duration-300 flex items-center gap-3 shadow-md border border-slate-200 hover:shadow-lg hover:-translate-y-0.5"
                title="Manage issue settings"
              >
                <Settings className="w-5 h-5" />
                <span className="font-semibold hidden sm:inline">Settings</span>
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-8 py-4 rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all duration-300 flex items-center gap-3 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" />
              <span className="font-semibold">Create Issue</span>
            </button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group border border-slate-200">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-100 to-transparent rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <AlertCircle className="w-7 h-7 text-slate-600" />
                  </div>
                  <div className="px-3 py-1 bg-slate-100 rounded-full">
                    <span className="text-xs font-semibold text-slate-600">Total</span>
                  </div>
                </div>
                <div className="text-4xl font-bold text-slate-800 mb-1">{stats.total}</div>
                <div className="text-sm text-slate-500 font-medium">All Issues</div>
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group border border-yellow-200">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-200/30 to-transparent rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                  <div className="px-3 py-1 bg-yellow-100 rounded-full">
                    <span className="text-xs font-semibold text-yellow-700">Active</span>
                  </div>
                </div>
                <div className="text-4xl font-bold text-slate-800 mb-1">{stats.in_progress}</div>
                <div className="text-sm text-yellow-700 font-medium">In Progress</div>
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group border border-emerald-200">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-200/30 to-transparent rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <CheckCircle className="w-7 h-7 text-white" />
                  </div>
                  <div className="px-3 py-1 bg-emerald-100 rounded-full">
                    <span className="text-xs font-semibold text-emerald-700">Done</span>
                  </div>
                </div>
                <div className="text-4xl font-bold text-slate-800 mb-1">{stats.resolved}</div>
                <div className="text-sm text-emerald-700 font-medium">Resolved</div>
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group border border-red-200">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-200/30 to-transparent rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/30 animate-pulse">
                    <AlertCircle className="w-7 h-7 text-white" />
                  </div>
                  <div className="px-3 py-1 bg-red-100 rounded-full">
                    <span className="text-xs font-semibold text-red-700">Urgent</span>
                  </div>
                </div>
                <div className="text-4xl font-bold text-slate-800 mb-1">{stats.by_priority.high}</div>
                <div className="text-sm text-red-700 font-medium">High Priority</div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search issues by title, description, or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={handleSearch}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-8 py-4 rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-xl font-semibold"
            >
              Search
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-700">
              <Filter className="w-5 h-5" />
              <span className="text-sm font-semibold">Filters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</label>
                <select
                  value={filters.status_id || ''}
                  onChange={(e) => setFilters({ ...filters, status_id: e.target.value || undefined })}
                  className="px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-sm font-medium text-slate-700"
                >
                  <option value="">All Statuses</option>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Priority</label>
                <select
                  value={filters.priority?.[0] || ''}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value ? [e.target.value as any] : undefined })}
                  className="px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-sm font-medium text-slate-700"
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Territory</label>
                <select
                  value={filters.region_id || ''}
                  onChange={(e) => setFilters({ ...filters, region_id: e.target.value || undefined, branch_id: undefined })}
                  className="px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-sm font-medium text-slate-700"
                >
                  <option value="">All Territories</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>

              {filters.region_id && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Sub-Territory</label>
                  <select
                    value={filters.branch_id || ''}
                    onChange={(e) => setFilters({ ...filters, branch_id: e.target.value || undefined })}
                    className="px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all text-sm font-medium text-slate-700"
                  >
                    <option value="">All Sub-Territories</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Date Range</label>
                <DateRangeSelector
                  value={dateRange}
                  onChange={setDateRange}
                />
              </div>
            </div>

            {(filters.status_id || filters.priority || filters.region_id || filters.branch_id) && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setFilters({});
                    setDateRange(getInitialDateRange('today'));
                    setSearchQuery('');
                    setIssues([]);
                    setHasSearched(false);
                  }}
                  className="px-4 py-2.5 bg-red-50 text-red-600 border-2 border-red-200 rounded-lg hover:bg-red-100 transition-all text-sm font-semibold"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-emerald-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-slate-600 font-medium">Loading issues...</p>
          </div>
        ) : !hasSearched ? (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-16 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Select a Date Range to Get Started</h3>
            <p className="text-slate-600">Pick a date range and press Search to view issues</p>
          </div>
        ) : issues.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-16 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">No Issues Found</h3>
            <p className="text-slate-600 mb-6">No issues match the selected date range and filters</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-3 rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all duration-300 shadow-lg shadow-emerald-500/30 inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Issue
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Issue #
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issues.map((issue) => {
                    const isPastDue = issue.due_date && new Date(issue.due_date) < new Date();
                    const priorityConfig = getPriorityConfig(issue.priority);
                    const issueStatus = getStatusForIssue(issue);

                    return (
                      <tr
                        key={issue.id}
                        className="hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent transition-all duration-200 group"
                      >
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg">
                            <span className="text-sm font-bold text-slate-700 font-mono">
                              {issue.issue_number}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg group-hover:from-emerald-100 group-hover:to-emerald-200 transition-all duration-200">
                              <AlertCircle className="w-4 h-4 text-slate-600 group-hover:text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {issue.title}
                              </p>
                              {issue.description && (
                                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                  {issue.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {issue.customer_id ? (
                            <span className="text-sm font-medium text-slate-700">
                              {customers.get(issue.customer_id)?.customer_name || '-'}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${priorityConfig.bg} ${priorityConfig.text} ${priorityConfig.border}`}>
                            {priorityConfig.icon}
                            {priorityConfig.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {issueStatus ? (
                            <span
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border"
                              style={{
                                backgroundColor: issueStatus.color + '15',
                                color: issueStatus.color,
                                borderColor: issueStatus.color + '40',
                              }}
                            >
                              {issueStatus.display_name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border bg-slate-50 text-slate-600 border-slate-200">
                              {issue.status}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {issue.due_date ? (
                            <div className="flex items-center gap-2">
                              <Clock className={`w-4 h-4 ${isPastDue && !issueStatus?.is_closed ? 'text-red-500' : 'text-slate-400'}`} />
                              <div>
                                <p className={`text-sm font-medium ${isPastDue && !issueStatus?.is_closed ? 'text-red-600' : 'text-slate-800'}`}>
                                  {new Date(issue.due_date).toLocaleDateString()}
                                </p>
                                {isPastDue && !issueStatus?.is_closed && (
                                  <p className="text-xs text-red-500 font-semibold animate-pulse">
                                    OVERDUE
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <p className="text-sm font-medium text-slate-800">
                              {new Date(issue.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedIssue(issue)}
                              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-gradient-to-r hover:from-emerald-600 hover:to-emerald-700 hover:text-white rounded-lg transition-all duration-200 border-2 border-emerald-600 hover:border-transparent group"
                            >
                              <Eye className="w-4 h-4" />
                              View
                              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIssueToDelete(issue);
                                }}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                                title="Delete issue"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateIssueModal
          orgId={orgId!}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            if (hasSearched) handleSearch();
            loadStats();
          }}
        />
      )}

      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onUpdate={() => {
            setSelectedIssue(null);
            if (hasSearched) handleSearch();
            loadStats();
          }}
        />
      )}

      {showSettingsModal && orgId && (
        <IssueSettingsManager
          orgId={orgId}
          onClose={() => {
            setShowSettingsModal(false);
            if (hasSearched) handleSearch();
            loadStats();
          }}
        />
      )}

      <ConfirmationModal
        isOpen={!!issueToDelete}
        onClose={() => setIssueToDelete(null)}
        onConfirm={handleDeleteIssue}
        title="Delete Issue"
        message={`Are you sure you want to delete issue ${issueToDelete?.issue_number || ''}? This action cannot be undone and all related work notes and history will be permanently removed.`}
        confirmText="Delete Issue"
        cancelText="Cancel"
        type="danger"
        isLoading={deleting}
      />
    </div>
  );
}
