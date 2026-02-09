import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Edit2, Trash2, Users, Search, Upload, Download, FileSpreadsheet, FileDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, CheckCircle, XCircle, MoreVertical, X, Filter, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { OrgStructureService } from '../../lib/organization/org-structure-service';
import { CustomerImportService, type ImportProgress } from '../../lib/organization/customer-import-service';
import type { Region, Branch, User } from '../../lib/supabase/types';
import { useToast } from '../../contexts/ToastContext';

interface Customer {
  id: string;
  org_id: string;
  region_id: string | null;
  branch_id: string | null;
  supervising_region_id: string | null;
  supervising_branch_id: string | null;
  customer_name: string;
  customer_code: string;
  supervisor_code: string | null;
  latitude: number | null;
  longitude: number | null;
  previous_latitude: number | null;
  previous_longitude: number | null;
  location_of_outlet: string | null;
  country: string;
  customer_telephone: string | null;
  operator: string | null;
  operator_telephone: string | null;
  customer_type: 'permanent' | 'temporary' | 'contract' | 'freelance';
  active_type: 'active' | 'inactive' | 'suspended' | 'terminated';
  customer_picture: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  region?: Region;
  branch?: Branch;
  supervising_region?: Region;
  supervising_branch?: Branch;
}

interface CustomersManagerProps {
  orgId: string;
}

interface Filters {
  territory: string;
  subTerritory: string;
  supervisorTerritory: string;
  status: string;
}

const EMPTY_FILTERS: Filters = {
  territory: '',
  subTerritory: '',
  supervisorTerritory: '',
  status: '',
};

export function CustomersManager({ orgId }: CustomersManagerProps) {
  const { showSuccess, showError, confirm } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [regions, setRegions] = useState<Region[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_code: '',
    supervisor_code: '',
    customer_telephone: '',
    operator: '',
    operator_telephone: '',
    location_of_outlet: '',
    country: 'Kenya',
    latitude: '',
    longitude: '',
    region_id: '',
    branch_id: '',
    supervising_region_id: '',
    supervising_branch_id: '',
    customer_type: 'permanent' as const,
    active_type: 'active' as const,
  });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  useEffect(() => {
    loadReferenceData();
  }, [orgId]);

  useEffect(() => {
    loadCustomers();
  }, [orgId, currentPage, itemsPerPage, debouncedSearch, filters]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadReferenceData = async () => {
    const [regionsRes, branchesRes, supervisorsRes] = await Promise.all([
      OrgStructureService.getRegions(orgId),
      OrgStructureService.getBranches(orgId),
      supabase
        .from('users')
        .select('id, full_name, email, supervisor_code, role:roles(name, display_name)')
        .eq('org_id', orgId)
        .in('role_id', (await supabase.from('roles').select('id').in('name', ['field_supervisor', 'branch_manager', 'regional_manager', 'bsm'])).data?.map(r => r.id) || [])
        .order('full_name'),
    ]);

    setRegions(regionsRes.data);
    setBranches(branchesRes.data);
    setSupervisors(supervisorsRes.data || []);
  };

  const loadCustomers = useCallback(async () => {
    setLoading(true);

    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    let query = supabase
      .from('customers')
      .select(`
        *,
        region:regions!agents_region_id_fkey(id, name, code),
        branch:branches!agents_branch_id_fkey(id, name, code),
        supervising_region:regions!agents_supervising_region_id_fkey(id, name, code),
        supervising_branch:branches!agents_supervising_branch_id_fkey(id, name, code)
      `, { count: 'exact' })
      .eq('org_id', orgId)
      .order('customer_name');

    if (debouncedSearch) {
      query = query.or(`customer_name.ilike.%${debouncedSearch}%,customer_code.ilike.%${debouncedSearch}%`);
    }

    if (filters.territory) {
      query = query.eq('region_id', filters.territory);
    }
    if (filters.subTerritory) {
      query = query.eq('branch_id', filters.subTerritory);
    }
    if (filters.supervisorTerritory) {
      query = query.eq('supervising_region_id', filters.supervisorTerritory);
    }
    if (filters.status) {
      query = query.eq('active_type', filters.status);
    }

    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      showError('Load Failed', 'Error loading customers: ' + error.message);
    } else {
      setCustomers(data || []);
      setTotalCount(count || 0);
    }

    setLoading(false);
  }, [orgId, currentPage, itemsPerPage, debouncedSearch, filters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const customerData = {
      customer_name: formData.customer_name,
      customer_code: formData.customer_code,
      supervisor_code: formData.supervisor_code || null,
      customer_telephone: formData.customer_telephone || null,
      operator: formData.operator || null,
      operator_telephone: formData.operator_telephone || null,
      location_of_outlet: formData.location_of_outlet || null,
      country: formData.country,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      region_id: formData.region_id || null,
      branch_id: formData.branch_id || null,
      supervising_region_id: formData.supervising_region_id || null,
      supervising_branch_id: formData.supervising_branch_id || null,
      customer_type: formData.customer_type,
      active_type: formData.active_type,
    };

    if (editingCustomer) {
      const { error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', editingCustomer.id);

      if (error) {
        showError('Update Failed', 'Error updating customer: ' + error.message);
        return;
      }
      showSuccess('Customer Updated', 'The customer has been updated successfully');
    } else {
      const { error } = await supabase
        .from('customers')
        .insert({ ...customerData, org_id: orgId });

      if (error) {
        showError('Create Failed', 'Error creating customer: ' + error.message);
        return;
      }
      showSuccess('Customer Created', 'The customer has been created successfully');
    }

    closeModal();
    loadCustomers();
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      customer_name: customer.customer_name,
      customer_code: customer.customer_code,
      supervisor_code: customer.supervisor_code || '',
      customer_telephone: customer.customer_telephone || '',
      operator: customer.operator || '',
      operator_telephone: customer.operator_telephone || '',
      location_of_outlet: customer.location_of_outlet || '',
      country: customer.country,
      latitude: customer.latitude?.toString() || '',
      longitude: customer.longitude?.toString() || '',
      region_id: customer.region_id || '',
      branch_id: customer.branch_id || '',
      supervising_region_id: customer.supervising_region_id || '',
      supervising_branch_id: customer.supervising_branch_id || '',
      customer_type: customer.customer_type,
      active_type: customer.active_type,
    });
    setShowModal(true);
  };

  const handleDelete = async (customer: Customer) => {
    const confirmed = await confirm('Delete Customer', `Are you sure you want to delete customer ${customer.customer_name}?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customer.id);

    if (error) {
      let errorMessage = 'Error deleting customer: ';
      if (error.message.includes('foreign key constraint') || error.message.includes('violates')) {
        if (error.message.includes('issues')) {
          errorMessage = 'Cannot delete customer because they have associated issues. Please resolve or reassign all issues first.';
        } else if (error.message.includes('form_submissions') || error.message.includes('submissions')) {
          errorMessage = 'Cannot delete customer because they have form submissions. Historical data cannot be removed.';
        } else if (error.message.includes('form_customer_attachments')) {
          errorMessage = 'Cannot delete customer because they have form attachments. Please remove form associations first.';
        } else {
          errorMessage = 'Cannot delete customer because they have associated records in the system. Please remove or reassign related data first.';
        }
      } else {
        errorMessage += error.message;
      }
      showError('Delete Failed', errorMessage);
      return;
    }

    showSuccess('Customer Deleted', 'The customer has been deleted successfully');
    loadCustomers();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImporting(true);
    setShowImportModal(true);
    setShowActionsMenu(false);
    setImportProgress({
      total: 0, processed: 0, successful: 0, skipped: 0, failed: 0,
      currentBatch: 0, totalBatches: 0, errors: [], isComplete: false
    });

    try {
      const result = await CustomerImportService.importCustomers(
        file, orgId, regions, branches, (progress) => setImportProgress(progress)
      );

      const inFileDupes = result.duplicatesInFile || 0;

      if (result.successful === 0 && result.skipped > 0) {
        let message = `All ${result.skipped} customers were skipped because their codes already exist in your organization.`;
        if (inFileDupes > 0) {
          message += ` Also removed ${inFileDupes} duplicate${inFileDupes !== 1 ? 's' : ''} from CSV file.`;
        }
        message += ` Duplicate codes: ${result.duplicateCodes.slice(0, 5).join(', ')}${result.duplicateCodes.length > 5 ? '...' : ''}`;
        setImportError(message);
      } else {
        let message = `Successfully imported ${result.successful} customer${result.successful !== 1 ? 's' : ''}!`;
        if (inFileDupes > 0) {
          message += ` Removed ${inFileDupes} duplicate${inFileDupes !== 1 ? 's' : ''} from CSV.`;
        }
        if (result.skipped > 0) {
          message += ` Skipped ${result.skipped} existing code${result.skipped !== 1 ? 's' : ''}.`;
        }
        showSuccess('Import Completed', message);
      }

      await loadCustomers();
    } catch (error: any) {
      setImportError('Error importing customers: ' + error.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const headers = ['customer_name', 'customer_code', 'customer_telephone', 'supervisor_code', 'location', 'country', 'latitude', 'longitude', 'region', 'branch', 'operator', 'operator_telephone', 'type', 'status'];
    const template = headers.join(',') + '\n' +
      'John Doe,CUST001,+254712345678,SUP001,Nairobi CBD,Kenya,-1.286389,36.817223,Central,Main Branch,Safaricom,+254700000000,permanent,active';

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    setShowActionsMenu(false);
  };

  const exportCustomers = async () => {
    setExporting(true);
    setShowActionsMenu(false);
    try {
      let allCustomers: Customer[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('customers')
          .select(`
            *,
            region:regions!agents_region_id_fkey(id, name, code),
            branch:branches!agents_branch_id_fkey(id, name, code),
            supervising_region:regions!agents_supervising_region_id_fkey(id, name, code),
            supervising_branch:branches!agents_supervising_branch_id_fkey(id, name, code)
          `)
          .eq('org_id', orgId)
          .order('customer_name')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (filters.territory) query = query.eq('region_id', filters.territory);
        if (filters.subTerritory) query = query.eq('branch_id', filters.subTerritory);
        if (filters.supervisorTerritory) query = query.eq('supervising_region_id', filters.supervisorTerritory);
        if (filters.status) query = query.eq('active_type', filters.status);
        if (debouncedSearch) query = query.or(`customer_name.ilike.%${debouncedSearch}%,customer_code.ilike.%${debouncedSearch}%`);

        const { data, error } = await query;

        if (error) {
          showError('Export Failed', 'Error fetching customers: ' + error.message);
          return;
        }

        if (data && data.length > 0) {
          allCustomers = [...allCustomers, ...data];
          page++;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      if (allCustomers.length === 0) {
        showError('Export Failed', 'No customers found to export');
        return;
      }

      const headers = [
        'Customer Name', 'Customer Code', 'Supervisor', 'Telephone', 'Location',
        'Country', 'Latitude', 'Longitude', 'Territory', 'Sub-Territory',
        'Operator', 'Operator Telephone', 'Type', 'Status', 'Created At'
      ];

      const rows = allCustomers.map(c => [
        c.customer_name, c.customer_code, c.supervisor_code || '',
        c.customer_telephone || '', c.location_of_outlet || '', c.country,
        c.latitude?.toString() || '', c.longitude?.toString() || '',
        c.region?.name || '', c.branch?.name || '', c.operator || '',
        c.operator_telephone || '', c.customer_type, c.active_type,
        new Date(c.created_at).toLocaleDateString()
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      showSuccess('Export Complete', `Successfully exported ${allCustomers.length} customer${allCustomers.length !== 1 ? 's' : ''}`);
    } catch (error: any) {
      showError('Export Failed', 'Error exporting customers: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData({
      customer_name: '', customer_code: '', supervisor_code: '',
      customer_telephone: '', operator: '', operator_telephone: '',
      location_of_outlet: '', country: 'Kenya', latitude: '', longitude: '',
      region_id: '', branch_id: '', supervising_region_id: '', supervising_branch_id: '',
      customer_type: 'permanent', active_type: 'active',
    });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setCurrentPage(1);
  };

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'territory' && !value) next.subTerritory = '';
      return next;
    });
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const filteredBranches = formData.region_id
    ? branches.filter(b => b.region_id === formData.region_id)
    : branches;

  const filteredSupervisingBranches = formData.supervising_region_id
    ? branches.filter(b => b.region_id === formData.supervising_region_id)
    : branches;

  const filterSubTerritoryOptions = filters.territory
    ? branches.filter(b => b.region_id === filters.territory)
    : branches;

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-[#015324] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Customers</h2>
          <p className="text-slate-600">
            {totalCount.toLocaleString()} total customer{totalCount !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="relative" ref={actionsRef}>
          <button
            onClick={() => setShowActionsMenu(!showActionsMenu)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors font-medium"
          >
            Actions
            <ChevronDown className={`w-4 h-4 transition-transform ${showActionsMenu ? 'rotate-180' : ''}`} />
          </button>

          {showActionsMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 z-30 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="py-1">
                <button
                  onClick={() => { setShowModal(true); setShowActionsMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Plus className="w-4 h-4 text-[#015324]" />
                  Add Customer
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4 text-blue-600" />
                  {importing ? 'Importing...' : 'Import CSV'}
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={exportCustomers}
                  disabled={exporting}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <FileDown className="w-4 h-4 text-emerald-600" />
                  {exporting ? 'Exporting...' : 'Export All'}
                </button>
                <button
                  onClick={downloadTemplate}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  Download Template
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
      />

      {importError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700 font-medium">{importError}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customers by name or code..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-[#015324] bg-[#015324]/5 text-[#015324]'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 w-5 h-5 flex items-center justify-center text-xs font-bold bg-[#015324] text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Territory</label>
                <select
                  value={filters.territory}
                  onChange={(e) => updateFilter('territory', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                >
                  <option value="">All Territories</option>
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Sub-Territory</label>
                <select
                  value={filters.subTerritory}
                  onChange={(e) => updateFilter('subTerritory', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                >
                  <option value="">All Sub-Territories</option>
                  {filterSubTerritoryOptions.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Supervisor Territory</label>
                <select
                  value={filters.supervisorTerritory}
                  onChange={(e) => updateFilter('supervisorTerritory', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                >
                  <option value="">All Supervisor Territories</option>
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => updateFilter('status', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
                </p>
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  <X className="w-3 h-3" />
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Territory</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sub-Territory</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-[#015324] border-t-transparent rounded-full animate-spin" />
                      <span className="text-slate-500 text-sm">Loading customers...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium mb-2">No customers found</p>
                    <p className="text-sm text-slate-500">
                      {debouncedSearch || activeFilterCount > 0
                        ? 'Try adjusting your search or filters'
                        : 'Use the Actions menu to add customers or import from CSV'}
                    </p>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#015324] rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{customer.customer_name}</p>
                          {customer.location_of_outlet && (
                            <p className="text-sm text-slate-500">{customer.location_of_outlet}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-[#015324]/10 text-[#015324] rounded">
                        {customer.customer_code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {customer.customer_telephone ? (
                        <div>
                          <p className="text-sm text-slate-800">{customer.customer_telephone}</p>
                          {customer.operator && (
                            <p className="text-xs text-slate-500">{customer.operator}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {customer.region?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {customer.branch?.name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                        customer.active_type === 'active' ? 'bg-green-100 text-green-700' :
                        customer.active_type === 'inactive' ? 'bg-gray-100 text-gray-700' :
                        customer.active_type === 'suspended' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {customer.active_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(customer)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalCount > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#015324] focus:border-transparent"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-slate-600">
                of {totalCount.toLocaleString()} customer{totalCount !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 text-slate-600 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 text-slate-600 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600 px-4">
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 text-slate-600 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 text-slate-600 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Last page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showImportModal && importProgress && (
        <ImportProgressModal
          importing={importing}
          importProgress={importProgress}
          onClose={() => { setShowImportModal(false); setImportProgress(null); }}
        />
      )}

      {showModal && (
        <CustomerFormModal
          editingCustomer={editingCustomer}
          formData={formData}
          setFormData={setFormData}
          regions={regions}
          filteredBranches={filteredBranches}
          filteredSupervisingBranches={filteredSupervisingBranches}
          supervisors={supervisors}
          onSubmit={handleSubmit}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

function ImportProgressModal({ importing, importProgress, onClose }: {
  importing: boolean;
  importProgress: ImportProgress;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">
            {importing ? 'Importing Customers...' : 'Import Complete'}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            {importing ? 'Please wait while we process your data' : 'Customer import has finished'}
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Progress</span>
              <span className="font-medium text-slate-800">
                {importProgress.processed} / {importProgress.total}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-[#015324] h-full transition-all duration-300 ease-out"
                style={{
                  width: `${importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0}%`
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Batch {importProgress.currentBatch} of {importProgress.totalBatches}</span>
              <span>{importProgress.total > 0 ? Math.round((importProgress.processed / importProgress.total) * 100) : 0}%</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">Successful</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{importProgress.successful}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-xs font-medium text-yellow-700">Skipped</span>
              </div>
              <p className="text-2xl font-bold text-yellow-700">{importProgress.skipped}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-medium text-red-700">Failed</span>
              </div>
              <p className="text-2xl font-bold text-red-700">{importProgress.failed}</p>
            </div>
          </div>

          {importProgress.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
              <h4 className="text-sm font-semibold text-red-800 mb-2">Errors</h4>
              <div className="space-y-1">
                {importProgress.errors.map((err, idx) => (
                  <div key={idx} className="text-xs text-red-700">
                    <span className="font-medium">{err.code}:</span> {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!importing && (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerFormModal({ editingCustomer, formData, setFormData, regions, filteredBranches, filteredSupervisingBranches, supervisors, onSubmit, onClose }: {
  editingCustomer: Customer | null;
  formData: any;
  setFormData: (data: any) => void;
  regions: Region[];
  filteredBranches: Branch[];
  filteredSupervisingBranches: Branch[];
  supervisors: User[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">
            {editingCustomer ? 'Edit Customer' : 'Add Customer'}
          </h3>
          <p className="text-sm text-slate-600 mt-1">Customer information and details</p>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Customer Name *</label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Customer Code *</label>
              <input
                type="text"
                value={formData.customer_code}
                onChange={(e) => setFormData({ ...formData, customer_code: e.target.value })}
                required
                disabled={!!editingCustomer}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent disabled:bg-slate-100"
                placeholder="CUST001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Supervisor</label>
              <select
                value={formData.supervisor_code}
                onChange={(e) => setFormData({ ...formData, supervisor_code: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
              >
                <option value="">Select Supervisor</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={(supervisor as any).supervisor_code || supervisor.id}>
                    {supervisor.full_name} - {(supervisor.role as any)?.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Customer Telephone</label>
              <input
                type="tel"
                value={formData.customer_telephone}
                onChange={(e) => setFormData({ ...formData, customer_telephone: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                placeholder="+254712345678"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Operator</label>
              <input
                type="text"
                value={formData.operator}
                onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                placeholder="Safaricom"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Operator Telephone</label>
              <input
                type="tel"
                value={formData.operator_telephone}
                onChange={(e) => setFormData({ ...formData, operator_telephone: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                placeholder="+254700000000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Location of Outlet</label>
            <input
              type="text"
              value={formData.location_of_outlet}
              onChange={(e) => setFormData({ ...formData, location_of_outlet: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
              placeholder="Nairobi CBD, Tom Mboya Street"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Latitude</label>
              <input
                type="text"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                placeholder="-1.286389"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Longitude</label>
              <input
                type="text"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                placeholder="36.817223"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Customer Type</label>
              <select
                value={formData.customer_type}
                onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
              >
                <option value="permanent">Permanent</option>
                <option value="temporary">Temporary</option>
                <option value="contract">Contract</option>
                <option value="freelance">Freelance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Active Type</label>
              <select
                value={formData.active_type}
                onChange={(e) => setFormData({ ...formData, active_type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold text-slate-800 mb-3">Assignment</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Territory</label>
                <select
                  value={formData.region_id}
                  onChange={(e) => setFormData({ ...formData, region_id: e.target.value, branch_id: '' })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                >
                  <option value="">Select Territory</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>{region.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sub-Territory</label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  disabled={!formData.region_id}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent disabled:bg-slate-100"
                >
                  <option value="">Select Sub-Territory</option>
                  {filteredBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold text-slate-800 mb-3">Supervising Structure</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Supervising Territory</label>
                <select
                  value={formData.supervising_region_id}
                  onChange={(e) => setFormData({ ...formData, supervising_region_id: e.target.value, supervising_branch_id: '' })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                >
                  <option value="">Select Territory</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>{region.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Supervising Sub-Territory</label>
                <select
                  value={formData.supervising_branch_id}
                  onChange={(e) => setFormData({ ...formData, supervising_branch_id: e.target.value })}
                  disabled={!formData.supervising_region_id}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent disabled:bg-slate-100"
                >
                  <option value="">Select Sub-Territory</option>
                  {filteredSupervisingBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors"
            >
              {editingCustomer ? 'Update Customer' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
