import { useState, useEffect, useRef } from 'react';
import {
  FileText, ChevronRight, Search, Share2, Download,
  Filter, ArrowUpDown, RefreshCw, X, Check, Calendar, EyeOff, Eye
} from 'lucide-react';
import { FormSubmissionsView } from './FormSubmissionsView';
import { FormService } from '../../lib/forms/form-service';
import { supabase } from '../../lib/supabase/client';
import type { Form } from '../../lib/forms/types';
import { useToast } from '../../contexts/ToastContext';

interface FormsModuleDashboardProps {
  userId: string;
  orgId: string;
}

export function FormsModuleDashboard({ userId, orgId }: FormsModuleDashboardProps) {
  const { showSuccess, showError, showWarning } = useToast();
  const [selectedCount, setSelectedCount] = useState(0);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [forms, setForms] = useState<Form[]>([]);
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [regions, setRegions] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const [filters, setFilters] = useState({
    form_id: '',
    status: '',
    start_date: '',
    end_date: '',
    region_id: '',
    branch_id: ''
  });

  const [includeRejected, setIncludeRejected] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportIncludeRejected, setExportIncludeRejected] = useState(false);

  const [sortBy, setSortBy] = useState('submitted_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadForms();
    loadRegions();
  }, [orgId]);

  useEffect(() => {
    if (filters.region_id) {
      loadBranches(filters.region_id);
    } else {
      setBranches([]);
    }
  }, [filters.region_id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterModal(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setShowSortModal(false);
      }
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setShowExportOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadForms = async () => {
    try {
      const data = await FormService.listForms(orgId);
      setForms(data.filter(f => f.is_active));
    } catch (error) {
      console.error('Error loading forms:', error);
    }
  };

  const loadRegions = async () => {
    try {
      const { data } = await supabase
        .from('regions')
        .select('id, name, code')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('name');
      setRegions(data || []);
    } catch (error) {
      console.error('Error loading regions:', error);
    }
  };

  const loadBranches = async (regionId: string) => {
    try {
      const { data } = await supabase
        .from('branches')
        .select('id, name, code')
        .eq('org_id', orgId)
        .eq('region_id', regionId)
        .eq('is_active', true)
        .order('name');
      setBranches(data || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const handleSearch = () => {
    if (!filters.start_date || !filters.end_date) {
      showWarning('Date Range Required', 'Please select both start and end dates to search');
      return;
    }
    setSearchTrigger(prev => prev + 1);
  };

  const handleRefresh = () => {
    if (!filters.start_date || !filters.end_date) {
      showWarning('Date Range Required', 'Please select both start and end dates to update');
      return;
    }
    setSearchTrigger(prev => prev + 1);
  };

  const handleExport = async () => {
    if (!filters.form_id) {
      showWarning('Select Form', 'Please select a form to export');
      return;
    }

    try {
      const csv = await FormService.exportSubmissionsCSV(filters.form_id, {
        start_date: filters.start_date,
        end_date: filters.end_date,
        includeRejected: exportIncludeRejected
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `form-submissions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showSuccess('Export Successful', 'Form submissions have been exported to CSV');
    } catch (error) {
      console.error('Error exporting submissions:', error);
      showError('Export Failed', 'Unable to export submissions. Please try again.');
    }
  };

  const handleClearFilters = () => {
    setFilters({
      form_id: '',
      status: '',
      start_date: '',
      end_date: '',
      region_id: '',
      branch_id: ''
    });
    setShowFilterModal(false);
  };

  const activeFilterCount = [
    filters.form_id,
    filters.status,
    filters.start_date,
    filters.end_date,
    filters.region_id,
    filters.branch_id
  ].filter(Boolean).length;

  const getFilterLabel = (key: string, value: string) => {
    switch (key) {
      case 'form_id':
        return forms.find(f => f.id === value)?.title || 'Form';
      case 'status':
        return value.charAt(0).toUpperCase() + value.slice(1);
      case 'region_id':
        return regions.find(r => r.id === value)?.name || 'Territory';
      case 'branch_id':
        return branches.find(b => b.id === value)?.name || 'Sub-Territory';
      case 'start_date':
        return `From: ${new Date(value).toLocaleDateString()}`;
      case 'end_date':
        return `To: ${new Date(value).toLocaleDateString()}`;
      default:
        return value;
    }
  };

  const removeFilter = (key: string) => {
    setFilters({ ...filters, [key]: '' });
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0 pt-16 lg:pt-0 relative">
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/20 z-[9998] animate-in fade-in duration-200" onClick={() => setShowFilterModal(false)} />
      )}
      {showSortModal && (
        <div className="fixed inset-0 bg-black/20 z-[9998] animate-in fade-in duration-200" onClick={() => setShowSortModal(false)} />
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6 overflow-x-auto">
            <span className="hover:text-slate-700 cursor-pointer transition-colors">Home</span>
            <ChevronRight className="w-4 h-4" />
            <span className="hover:text-slate-700 cursor-pointer transition-colors">Data</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-800 font-medium">Form Submissions</span>
          </div>

          {activeFilterCount > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(filters).map(([key, value]) =>
                value ? (
                  <span
                    key={key}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#015324]/10 text-[#015324] rounded-lg text-sm font-medium border border-[#015324]/20"
                  >
                    {getFilterLabel(key, value)}
                    <button
                      onClick={() => removeFilter(key)}
                      className="hover:bg-[#015324]/20 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ) : null
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 relative">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={handleSearch}
                className="flex items-center gap-2 px-4 py-2 bg-[#015324] hover:bg-[#014a20] text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>

              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-sm text-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Update</span>
              </button>

              {selectedCount > 0 && (
                <div className="px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-700 font-medium">
                  {selectedCount} Selected
                </div>
              )}

              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilterModal(!showFilterModal)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-sm text-slate-700"
                >
                  <Filter className="w-4 h-4" />
                  <span>Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-slate-700 text-white rounded text-xs font-medium min-w-[20px] text-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {showFilterModal && (
                  <div
                    className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] sm:w-96 max-w-full bg-white rounded-xl shadow-2xl border border-slate-200 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800">Filter Submissions</h3>
                      <button
                        onClick={() => setShowFilterModal(false)}
                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>

                    <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Form
                        </label>
                        <select
                          value={filters.form_id}
                          onChange={(e) => setFilters({ ...filters, form_id: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324] text-sm"
                        >
                          <option value="">All Forms</option>
                          {forms.map((form) => (
                            <option key={form.id} value={form.id}>
                              {form.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Status
                        </label>
                        <select
                          value={filters.status}
                          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324] text-sm"
                        >
                          <option value="">All Statuses</option>
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Territory
                        </label>
                        <select
                          value={filters.region_id}
                          onChange={(e) => setFilters({ ...filters, region_id: e.target.value, branch_id: '' })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324] text-sm"
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
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Sub-Territory
                          </label>
                          <select
                            value={filters.branch_id}
                            onChange={(e) => setFilters({ ...filters, branch_id: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324] text-sm"
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

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={filters.start_date}
                          onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324] text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={filters.end_date}
                          onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324] text-sm"
                        />
                      </div>
                    </div>

                    <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-2">
                      <button
                        onClick={handleClearFilters}
                        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Clear All
                      </button>
                      <button
                        onClick={() => {
                          setShowFilterModal(false);
                        }}
                        className="px-4 py-2 text-sm bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={sortRef}>
                <button
                  onClick={() => setShowSortModal(!showSortModal)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-sm text-slate-700"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  <span>Sort</span>
                  {sortBy && (
                    <span className="text-[#015324] font-semibold">
                      ({sortOrder === 'asc' ? '↑' : '↓'})
                    </span>
                  )}
                </button>

                {showSortModal && (
                  <div
                    className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] sm:w-80 max-w-full bg-white rounded-xl shadow-2xl border border-slate-200 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800">Sort By</h3>
                      <button
                        onClick={() => setShowSortModal(false)}
                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>

                    <div className="p-2">
                      {[
                        { value: 'submitted_at', label: 'Submission Date' },
                        { value: 'status', label: 'Status' },
                        { value: 'cycle_number', label: 'Cycle Number' }
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSortBy(option.value);
                            setShowSortModal(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                            sortBy === option.value
                              ? 'bg-[#015324]/10 text-[#015324] font-medium'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {option.label}
                          {sortBy === option.value && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>

                    <div className="p-4 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSortOrder('asc')}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            sortOrder === 'asc'
                              ? 'bg-[#015324] text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Ascending
                        </button>
                        <button
                          onClick={() => setSortOrder('desc')}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            sortOrder === 'desc'
                              ? 'bg-[#015324] text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Descending
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIncludeRejected(!includeRejected)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                  includeRejected
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {includeRejected ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span>{includeRejected ? 'Rejected Shown' : 'Rejected Hidden'}</span>
              </button>

              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setShowExportOptions(!showExportOptions)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-sm text-slate-700"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>

                {showExportOptions && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-[9999] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-slate-200">
                      <h3 className="font-semibold text-slate-800 text-sm">Export Options</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            exportIncludeRejected
                              ? 'bg-rose-500 border-rose-500'
                              : 'border-slate-300 group-hover:border-slate-400'
                          }`}
                        >
                          {exportIncludeRejected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={exportIncludeRejected}
                          onChange={(e) => setExportIncludeRejected(e.target.checked)}
                          className="sr-only"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-800">Include Rejected Forms</p>
                          <p className="text-xs text-slate-500">Export will include rejected submissions</p>
                        </div>
                      </label>
                    </div>
                    <div className="p-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
                      <button
                        onClick={() => {
                          setShowExportOptions(false);
                          handleExport();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#015324] hover:bg-[#014a20] text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        <Download className="w-4 h-4" />
                        Export CSV
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <FormSubmissionsView
        orgId={orgId}
        filters={filters}
        sortBy={sortBy}
        sortOrder={sortOrder}
        searchTrigger={searchTrigger}
        includeRejected={includeRejected}
      />
    </div>
  );
}
