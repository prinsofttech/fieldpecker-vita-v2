import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, Search, Building, Users as UsersIcon, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { OrgStructureService } from '../../lib/organization/org-structure-service';
import type { Department, Branch, User } from '../../lib/supabase/types';
import { useToast } from '../../contexts/ToastContext';

interface DepartmentsManagerProps {
  orgId: string;
}

interface DepartmentWithCount extends Department {
  employee_count: number;
}

export function DepartmentsManager({ orgId }: DepartmentsManagerProps) {
  const { showSuccess, showError, confirm } = useToast();
  const [departments, setDepartments] = useState<DepartmentWithCount[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    operating: 'in_office' as 'on_field' | 'in_office',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    setLoading(true);
    const [departmentsRes, branchesRes, usersRes] = await Promise.all([
      OrgStructureService.getDepartments(orgId),
      OrgStructureService.getBranches(orgId),
      supabase
        .from('users')
        .select('*')
        .eq('org_id', orgId)
        .order('full_name'),
    ]);

    const depts = departmentsRes.data || [];

    // Get employee counts for each department
    const deptsWithCounts = await Promise.all(
      depts.map(async (dept) => {
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('department_id', dept.id);

        return {
          ...dept,
          employee_count: count || 0,
        };
      })
    );

    setDepartments(deptsWithCounts);
    setBranches(branchesRes.data || []);
    setUsers(usersRes.data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingDepartment) {
        // Update department
        await OrgStructureService.updateDepartment(editingDepartment.id, {
          name: formData.name,
          code: formData.name.toUpperCase().replace(/\s+/g, '_'),
          operating: formData.operating,
          branch_id: selectedBranches.size === 1 ? Array.from(selectedBranches)[0] : null,
        });

        // Update employees - set department_id for selected employees
        if (selectedEmployees.size > 0) {
          await supabase
            .from('users')
            .update({ department_id: editingDepartment.id })
            .in('id', Array.from(selectedEmployees));
        }

        // Clear department_id for unselected employees
        const currentEmployees = users.filter(u => u.department_id === editingDepartment.id);
        const unselectedEmployees = currentEmployees
          .filter(u => !selectedEmployees.has(u.id))
          .map(u => u.id);

        if (unselectedEmployees.length > 0) {
          await supabase
            .from('users')
            .update({ department_id: null })
            .in('id', unselectedEmployees);
        }
      } else {
        // Create department
        const result = await OrgStructureService.createDepartment({
          org_id: orgId,
          name: formData.name,
          code: formData.name.toUpperCase().replace(/\s+/g, '_'),
          operating: formData.operating,
          branch_id: selectedBranches.size === 1 ? Array.from(selectedBranches)[0] : null,
        });

        // Assign employees to the new department
        if (result.data && selectedEmployees.size > 0) {
          await supabase
            .from('users')
            .update({ department_id: result.data.id })
            .in('id', Array.from(selectedEmployees));
        }
      }

      setShowModal(false);
      setEditingDepartment(null);
      setFormData({ name: '', operating: 'in_office' });
      setSelectedBranches(new Set());
      setSelectedEmployees(new Set());
      setLocationSearch('');
      setEmployeeSearch('');
      loadData();
    } catch (error) {
      console.error('Error saving department:', error);
    }
  };

  const handleEdit = async (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      operating: department.operating || 'in_office',
    });

    // Load department's branches
    if (department.branch_id) {
      setSelectedBranches(new Set([department.branch_id]));
    } else {
      setSelectedBranches(new Set());
    }

    // Load department's employees
    const { data: deptEmployees } = await supabase
      .from('users')
      .select('id')
      .eq('department_id', department.id);

    if (deptEmployees) {
      setSelectedEmployees(new Set(deptEmployees.map(e => e.id)));
    }

    setLocationSearch('');
    setEmployeeSearch('');
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('Delete Department', 'Are you sure you want to delete this department?');
    if (confirmed) {
      try {
        await OrgStructureService.deleteDepartment(id);
        loadData();
        showSuccess('Department Deleted', 'The department has been deleted successfully');
      } catch (error) {
        showError('Delete Failed', 'Failed to delete department. Please try again.');
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDepartment(null);
    setFormData({ name: '', operating: 'in_office' });
    setSelectedBranches(new Set());
    setSelectedEmployees(new Set());
    setLocationSearch('');
    setEmployeeSearch('');
  };

  const handleAdd = () => {
    setEditingDepartment(null);
    setFormData({ name: '', operating: 'in_office' });
    setSelectedBranches(new Set());
    setSelectedEmployees(new Set());
    setLocationSearch('');
    setEmployeeSearch('');
    setShowModal(true);
  };

  const toggleBranch = (branchId: string) => {
    const newSet = new Set(selectedBranches);
    if (newSet.has(branchId)) {
      newSet.delete(branchId);
    } else {
      newSet.clear();
      newSet.add(branchId);
    }
    setSelectedBranches(newSet);
  };

  const toggleEmployee = (userId: string) => {
    const newSet = new Set(selectedEmployees);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedEmployees(newSet);
  };

  const getLocationDisplay = (dept: Department) => {
    if (!dept.branch_id) return 'All';
    const branch = branches.find(b => b.id === dept.branch_id);
    return branch ? branch.name : 'All';
  };

  const getOperatingDisplay = (operating: string) => {
    return operating === 'on_field' ? 'On Field' : 'In Office';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Filtered lists for search
  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(locationSearch.toLowerCase())
  );

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h2 className="text-2xl font-bold text-slate-800">Departments</h2>
          <p className="text-slate-600">Manage organizational departments</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Department
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search departments by name..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredDepartments.map((dept) => (
          <div
            key={dept.id}
            className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 bg-[#015324] rounded-full flex items-center justify-center flex-shrink-0">
                  <Building className="w-6 h-6 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="font-semibold text-slate-800 text-lg">
                      {dept.name}
                    </h3>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                      dept.operating === 'on_field'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {getOperatingDisplay(dept.operating)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <UsersIcon className="w-4 h-4" />
                      <span>{dept.employee_count} {dept.employee_count === 1 ? 'Employee' : 'Employees'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="w-4 h-4" />
                      <span>Location: {getLocationDisplay(dept)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <span>Created: {formatDate(dept.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleEdit(dept)}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Edit department"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(dept.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete department"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredDepartments.length === 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <Building className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">No departments found</p>
            <p className="text-sm text-slate-500 mt-1">
              {searchTerm ? 'Try adjusting your search' : 'Click "Add Department" to create one'}
            </p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-[#015324]">
                {editingDepartment ? 'Edit Department' : 'Add Department'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-sm text-slate-600">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="col-span-2 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-3 gap-4 items-start">
                <label className="text-sm text-slate-600 pt-2">Locations</label>
                <div className="col-span-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search locations..."
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent text-sm"
                    />
                  </div>
                  <div className="border border-slate-300 rounded-lg max-h-48 overflow-y-auto">
                    <label
                      className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer border-b"
                    >
                      <input
                        type="radio"
                        name="location"
                        checked={selectedBranches.size === 0}
                        onChange={() => setSelectedBranches(new Set())}
                        className="w-4 h-4 text-[#015324] border-slate-300 focus:ring-[#015324]"
                      />
                      <span className="text-sm text-slate-700 font-medium">All Selected</span>
                    </label>
                    {filteredBranches.length > 0 ? (
                      filteredBranches.map((branch) => (
                        <label
                          key={branch.id}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                        >
                          <input
                            type="radio"
                            name="location"
                            checked={selectedBranches.has(branch.id)}
                            onChange={() => toggleBranch(branch.id)}
                            className="w-4 h-4 text-[#015324] border-slate-300 focus:ring-[#015324]"
                          />
                          <span className="text-sm text-slate-700">{branch.name}</span>
                        </label>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500">No locations found</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 items-start">
                <label className="text-sm text-slate-600 pt-2">Employees</label>
                <div className="col-span-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search employees..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent text-sm"
                    />
                  </div>
                  <div className="border border-slate-300 rounded-lg max-h-48 overflow-y-auto">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmployees.has(user.id)}
                            onChange={() => toggleEmployee(user.id)}
                            className="w-4 h-4 text-[#015324] border-slate-300 rounded focus:ring-[#015324]"
                          />
                          <span className="text-sm text-slate-700">{user.full_name}</span>
                        </label>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500">No employees found</div>
                    )}
                  </div>
                  {selectedEmployees.size > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      {selectedEmployees.size} employee{selectedEmployees.size !== 1 ? 's' : ''} selected
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-sm text-slate-600">Operating</label>
                <div className="col-span-2 flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="operating"
                      value="on_field"
                      checked={formData.operating === 'on_field'}
                      onChange={(e) => setFormData({ ...formData, operating: e.target.value as 'on_field' | 'in_office' })}
                      className="w-4 h-4 text-[#015324] border-slate-300 focus:ring-[#015324]"
                    />
                    <span className="text-sm text-slate-700">On Field</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="operating"
                      value="in_office"
                      checked={formData.operating === 'in_office'}
                      onChange={(e) => setFormData({ ...formData, operating: e.target.value as 'on_field' | 'in_office' })}
                      className="w-4 h-4 text-[#015324] border-slate-300 focus:ring-[#015324]"
                    />
                    <span className="text-sm text-slate-700">In Office</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-2 border-2 border-[#015324] text-[#015324] rounded-full hover:bg-[#015324]/10 transition-colors font-medium"
                >
                  RESET
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-2 bg-[#015324] text-white rounded-full hover:bg-[#014a20] transition-colors font-medium"
                >
                  SAVE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
