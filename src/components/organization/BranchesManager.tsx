import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Building2, Upload, Download } from 'lucide-react';
import { OrgStructureService } from '../../lib/organization/org-structure-service';
import type { Branch, Region } from '../../lib/supabase/types';
import { useToast } from '../../contexts/ToastContext';

interface BranchesManagerProps {
  orgId: string;
}

export function BranchesManager({ orgId }: BranchesManagerProps) {
  const { showSuccess, showError, confirm } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    region_id: '',
  });

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    setLoading(true);
    const [branchesRes, regionsRes] = await Promise.all([
      OrgStructureService.getBranches(orgId),
      OrgStructureService.getRegions(orgId),
    ]);
    setBranches(branchesRes.data);
    setRegions(regionsRes.data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = formData.name.toUpperCase().replace(/\s+/g, '_');

    const payload = {
      ...formData,
      code,
      region_id: formData.region_id || undefined,
    };

    if (editingBranch) {
      await OrgStructureService.updateBranch(editingBranch.id, payload);
    } else {
      await OrgStructureService.createBranch({
        org_id: orgId,
        ...payload,
      });
    }

    setShowModal(false);
    setEditingBranch(null);
    setFormData({ name: '', address: '', region_id: '' });
    loadData();
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address || '',
      region_id: branch.region_id || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('Delete Sub-Territory', 'Are you sure you want to delete this sub-territory?');
    if (confirmed) {
      try {
        await OrgStructureService.deleteBranch(id);
        loadData();
        showSuccess('Sub-Territory Deleted', 'The sub-territory has been deleted successfully');
      } catch (error) {
        showError('Delete Failed', 'Failed to delete sub-territory. Please try again.');
      }
    }
  };

  const handleAdd = () => {
    setEditingBranch(null);
    setFormData({ name: '', address: '', region_id: '' });
    setShowModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));

        const headers = rows[0].map(h => h.toLowerCase().replace(/['"]/g, ''));
        const dataRows = rows.slice(1).filter(row => row.some(cell => cell));

        const branchesToImport = dataRows.map(row => {
          const rowData: any = {};
          headers.forEach((header, index) => {
            rowData[header] = row[index]?.replace(/['"]/g, '') || null;
          });

          const regionMatch = regions.find(r =>
            r.name.toLowerCase() === rowData.territory?.toLowerCase() ||
            r.code.toLowerCase() === rowData.territory?.toLowerCase() ||
            r.name.toLowerCase() === rowData.region?.toLowerCase() ||
            r.code.toLowerCase() === rowData.region?.toLowerCase()
          );

          const name = rowData.name || rowData['sub-territory'] || rowData.branch || '';
          const code = name.toUpperCase().replace(/\s+/g, '_');

          return {
            org_id: orgId,
            name,
            code,
            address: rowData.address || null,
            region_id: regionMatch?.id || null,
          };
        }).filter(b => b.name);

        if (branchesToImport.length === 0) {
          setImportError('No valid sub-territories found in file. Please check the format.');
          return;
        }

        const { data, error } = await OrgStructureService.createBranches(branchesToImport);

        if (error) {
          setImportError('Error importing sub-territories: ' + error.message);
          return;
        }

        showSuccess('Import Successful', `Successfully imported ${branchesToImport.length} sub-territories!`);
        loadData();
      } catch (error: any) {
        setImportError('Error parsing file: ' + error.message);
      }
    };

    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const headers = ['name', 'territory', 'address'];
    const template = headers.join(',') + '\n' +
      'Main Branch,Central Region,123 Main Street\n' +
      'East Branch,Eastern Region,456 East Avenue';

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sub_territories_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
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
          <h2 className="text-2xl font-bold text-slate-800">Sub-Territories</h2>
          <p className="text-slate-600">Manage organizational sub-territories</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
            title="Download CSV template"
          >
            <Download className="w-5 h-5" />
            Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Import CSV
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Sub-Territory
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      {importError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
          <p className="text-sm text-red-700 font-medium">{importError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((branch) => (
          <div
            key={branch.id}
            className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#B1D003]/10 rounded-lg">
                  <Building2 className="w-6 h-6 text-[#015324]" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{branch.name}</h3>
                  <p className="text-sm text-slate-500">{branch.code}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(branch)}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(branch.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {branch.region && (
              <p className="text-xs text-slate-500 mb-2">
                Territory: {branch.region.name}
              </p>
            )}
            {branch.address && (
              <p className="text-sm text-slate-600">{branch.address}</p>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">
                {editingBranch ? 'Edit Sub-Territory' : 'Add Sub-Territory'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sub-Territory Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Territory
                </label>
                <select
                  value={formData.region_id}
                  onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                >
                  <option value="">None</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors"
                >
                  {editingBranch ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
