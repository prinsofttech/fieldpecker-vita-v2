import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, MapPin, Upload, Download, ChevronRight } from 'lucide-react';
import { OrgStructureService } from '../../lib/organization/org-structure-service';
import type { Region } from '../../lib/supabase/types';
import { useToast } from '../../contexts/ToastContext';

interface RegionsManagerProps {
  orgId: string;
}

interface RegionWithParent extends Region {
  parent?: {
    id: string;
    name: string;
  } | null;
}

export function RegionsManager({ orgId }: RegionsManagerProps) {
  const { showSuccess, showError, confirm } = useToast();
  const [territories, setTerritories] = useState<RegionWithParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTerritory, setEditingTerritory] = useState<RegionWithParent | null>(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    parent_id: '',
  });

  useEffect(() => {
    loadTerritories();
  }, [orgId]);

  const loadTerritories = async () => {
    setLoading(true);
    const { data } = await OrgStructureService.getRegions(orgId);
    setTerritories(data as RegionWithParent[]);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = formData.name.toUpperCase().replace(/\s+/g, '_');

    const payload = {
      ...formData,
      code,
      parent_id: formData.parent_id || null,
    };

    try {
      if (editingTerritory) {
        await OrgStructureService.updateRegion(editingTerritory.id, payload);
        showSuccess('Territory Updated', 'The territory has been updated successfully');
      } else {
        await OrgStructureService.createRegion({
          org_id: orgId,
          ...payload,
        });
        showSuccess('Territory Created', 'The territory has been created successfully');
      }

      setShowModal(false);
      setEditingTerritory(null);
      setFormData({ name: '', description: '', address: '', parent_id: '' });
      loadTerritories();
    } catch (error) {
      console.error('Error saving territory:', error);
      showError('Save Failed', 'Failed to save territory. Please try again.');
    }
  };

  const handleEdit = (territory: RegionWithParent) => {
    setEditingTerritory(territory);
    setFormData({
      name: territory.name,
      description: territory.description || '',
      address: territory.address || '',
      parent_id: territory.parent_id || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('Delete Territory', 'Are you sure you want to delete this territory? All sub-territories will also be deleted.');
    if (confirmed) {
      try {
        await OrgStructureService.deleteRegion(id);
        loadTerritories();
        showSuccess('Territory Deleted', 'The territory has been deleted successfully');
      } catch (error) {
        showError('Delete Failed', 'Failed to delete territory. Please try again.');
      }
    }
  };

  const handleAdd = () => {
    setEditingTerritory(null);
    setFormData({ name: '', description: '', address: '', parent_id: '' });
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

        const territoriesToImport = dataRows.map(row => {
          const rowData: any = {};
          headers.forEach((header, index) => {
            rowData[header] = row[index]?.replace(/['"]/g, '') || '';
          });

          const name = rowData.name || rowData.territory_name;
          const code = (rowData.code || name).toUpperCase().replace(/\s+/g, '_');
          const parentName = rowData.parent_territory || rowData.parent;

          let parent_id = null;
          if (parentName) {
            const parent = territories.find(t =>
              t.name.toLowerCase() === parentName.toLowerCase() ||
              t.code.toLowerCase() === parentName.toLowerCase()
            );
            parent_id = parent?.id || null;
          }

          return {
            org_id: orgId,
            name,
            code,
            description: rowData.description || '',
            address: rowData.address || '',
            parent_id,
          };
        });

        if (territoriesToImport.length === 0) {
          setImportError('No valid territories found in file. Please check the format.');
          return;
        }

        const { error } = await OrgStructureService.createRegions(territoriesToImport);

        if (error) {
          setImportError('Error importing territories: ' + error.message);
          return;
        }

        loadTerritories();
        showSuccess('Import Successful', `Successfully imported ${territoriesToImport.length} territories`);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Import error:', error);
        setImportError('Failed to import CSV. Please check the format.');
        showError('Import Failed', 'Failed to import territories. Please check the CSV format.');
      }
    };

    reader.readAsText(file);
  };

  const handleExportTemplate = () => {
    const csv = 'name,description,address,parent_territory\n"North Region","Northern territory","123 North St",""\n"Sub Territory 1","Sub territory under North","456 Sub St","North Region"';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'territories_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const topLevelTerritories = territories.filter(t => !t.parent_id);
  const subTerritories = territories.filter(t => t.parent_id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Territories</h2>
          <p className="text-slate-600 mt-1">Manage organizational territories and sub-territories</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportTemplate}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#013d1a] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Territory
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {importError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 border-4 border-[#015324] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top-Level Territories */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Main Territories</h3>
              <p className="text-sm text-slate-600">Top-level territories without parent</p>
            </div>
            <div className="divide-y divide-slate-200">
              {topLevelTerritories.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No main territories yet</p>
                  <p className="text-sm mt-1">Create a territory to get started</p>
                </div>
              ) : (
                topLevelTerritories.map((territory) => {
                  const childCount = subTerritories.filter(st => st.parent_id === territory.id).length;

                  return (
                    <div key={territory.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-[#015324]/10 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-[#015324]" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-slate-800">{territory.name}</h4>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                                {territory.code}
                              </span>
                            </div>
                            {territory.description && (
                              <p className="text-sm text-slate-600 mt-1">{territory.description}</p>
                            )}
                            {territory.address && (
                              <p className="text-sm text-slate-500 mt-1">{territory.address}</p>
                            )}
                            {childCount > 0 && (
                              <p className="text-sm text-[#015324] mt-1 font-medium">
                                {childCount} sub-{childCount === 1 ? 'territory' : 'territories'}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(territory)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(territory.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Sub-Territories */}
          {subTerritories.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">Sub-Territories</h3>
                <p className="text-sm text-slate-600">Territories with parent territories</p>
              </div>
              <div className="divide-y divide-slate-200">
                {subTerritories.map((territory) => (
                  <div key={territory.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-800">{territory.name}</h4>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                              {territory.code}
                            </span>
                          </div>
                          {territory.parent && (
                            <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                              <span className="text-slate-400">Under:</span>
                              <span className="font-medium">{territory.parent.name}</span>
                            </div>
                          )}
                          {territory.description && (
                            <p className="text-sm text-slate-600 mt-1">{territory.description}</p>
                          )}
                          {territory.address && (
                            <p className="text-sm text-slate-500 mt-1">{territory.address}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(territory)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(territory.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-800">
                {editingTerritory ? 'Edit Territory' : 'Create Territory'}
              </h3>
              <p className="text-slate-600 mt-1">
                {editingTerritory
                  ? 'Update territory information'
                  : 'Select a parent territory to create a sub-territory, or leave empty for a main territory'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Parent Territory (Optional)
                </label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                >
                  <option value="">None (Main Territory)</option>
                  {topLevelTerritories
                    .filter(t => !editingTerritory || t.id !== editingTerritory.id)
                    .map(territory => (
                      <option key={territory.id} value={territory.id}>
                        {territory.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty to create a main territory, or select a parent to create a sub-territory
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Territory Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  placeholder="Enter territory name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  placeholder="Enter description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-[#015324]"
                  placeholder="Enter address (optional)"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingTerritory(null);
                    setFormData({ name: '', description: '', address: '', parent_id: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#013d1a] transition-colors"
                >
                  {editingTerritory ? 'Update' : 'Create'} Territory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
