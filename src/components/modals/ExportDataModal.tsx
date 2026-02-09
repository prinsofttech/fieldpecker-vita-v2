import { useState } from 'react';
import { Download, X, FileText, AlertCircle, Target, Clock, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase/client';
import { useToast } from '../../contexts/ToastContext';

interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  dateRange: string;
}

interface ModuleOption {
  id: string;
  name: string;
  icon: any;
  enabled: boolean;
}

export function ExportDataModal({ isOpen, onClose, orgId, dateRange }: ExportDataModalProps) {
  const { showSuccess, showError } = useToast();
  const [modules, setModules] = useState<ModuleOption[]>([
    { id: 'forms', name: 'Form Submissions', icon: FileText, enabled: true },
    { id: 'issues', name: 'Issue Tracker', icon: AlertCircle, enabled: true },
    { id: 'leads', name: 'Leads & CRM', icon: Target, enabled: true },
    { id: 'sessions', name: 'Session Activity', icon: Clock, enabled: true }
  ]);
  const [exporting, setExporting] = useState(false);
  const [includeRejectedForms, setIncludeRejectedForms] = useState(false);

  if (!isOpen) return null;

  const toggleModule = (id: string) => {
    setModules(prev =>
      prev.map(m => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const workbook = XLSX.utils.book_new();
      const selectedModules = modules.filter(m => m.enabled);

      for (const module of selectedModules) {
        const data = await fetchModuleData(module.id);
        if (data.length > 0) {
          const worksheet = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(workbook, worksheet, module.name);
        }
      }

      const fileName = `FieldPecker_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      showSuccess('Export Complete', 'Data has been successfully exported to Excel');
      onClose();
    } catch (error) {
      console.error('Error exporting data:', error);
      showError('Export Failed', 'Unable to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case '7d':
        return new Date(now.setDate(now.getDate() - 7)).toISOString();
      case '30d':
        return new Date(now.setDate(now.getDate() - 30)).toISOString();
      case '90d':
        return new Date(now.setDate(now.getDate() - 90)).toISOString();
      default:
        return '2020-01-01';
    }
  };

  const fetchModuleData = async (moduleId: string) => {
    if (!orgId) return [];
    const dateFilter = getDateFilter();

    try {
      switch (moduleId) {
        case 'forms': {
          let query = supabase
            .from('form_submissions')
            .select(`
              id,
              submitted_at,
              time_spent,
              status,
              form:forms!inner(id, title, org_id),
              submitted_by:users!form_submissions_submitted_by_fkey(full_name)
            `)
            .eq('form.org_id', orgId)
            .gte('submitted_at', dateFilter);

          if (!includeRejectedForms) {
            query = query.neq('status', 'rejected');
          }

          const { data } = await query;

          return (data || []).map(sub => ({
            'Form': sub.form?.title || 'Unknown',
            'Submitted By': sub.submitted_by?.full_name || 'Unknown',
            'Status': sub.status || 'Unknown',
            'Submitted At': new Date(sub.submitted_at).toLocaleString(),
            'Time Spent': sub.time_spent || 'N/A'
          }));
        }

        case 'issues': {
          const { data } = await supabase
            .from('issues')
            .select(`
              issue_number,
              title,
              status,
              priority,
              reported_at,
              resolved_at,
              reported_by:users!issues_reported_by_fkey(full_name),
              assigned_to:users!issues_assigned_to_fkey(full_name)
            `)
            .eq('org_id', orgId)
            .gte('reported_at', dateFilter);

          return (data || []).map(issue => ({
            'Issue #': issue.issue_number,
            'Title': issue.title,
            'Status': issue.status,
            'Priority': issue.priority,
            'Reported At': new Date(issue.reported_at).toLocaleString(),
            'Resolved At': issue.resolved_at ? new Date(issue.resolved_at).toLocaleString() : 'N/A',
            'Reported By': issue.reported_by?.full_name || 'Unknown',
            'Assigned To': issue.assigned_to?.full_name || 'Unassigned'
          }));
        }

        case 'leads': {
          const { data } = await supabase
            .from('leads')
            .select(`
              full_name,
              company,
              email,
              phone,
              status,
              score,
              source,
              created_at,
              last_contact_date,
              next_followup_date,
              assigned_to:users!leads_assigned_to_fkey(full_name),
              created_by:users!leads_created_by_fkey(full_name)
            `)
            .eq('org_id', orgId)
            .gte('created_at', dateFilter);

          return (data || []).map(lead => ({
            'Full Name': lead.full_name,
            'Company': lead.company || 'N/A',
            'Email': lead.email || 'N/A',
            'Phone': lead.phone || 'N/A',
            'Status': lead.status,
            'Score': lead.score || 0,
            'Source': lead.source || 'N/A',
            'Created At': new Date(lead.created_at).toLocaleString(),
            'Last Contact': lead.last_contact_date ? new Date(lead.last_contact_date).toLocaleString() : 'N/A',
            'Next Followup': lead.next_followup_date ? new Date(lead.next_followup_date).toLocaleString() : 'N/A',
            'Assigned To': lead.assigned_to?.full_name || 'Unassigned',
            'Created By': lead.created_by?.full_name || 'Unknown'
          }));
        }

        case 'sessions': {
          const { data } = await supabase
            .from('user_sessions')
            .select(`
              user:users(full_name),
              login_at,
              logout_at,
              is_active,
              ip_address
            `)
            .eq('org_id', orgId)
            .gte('login_at', dateFilter);

          return (data || []).map(session => {
            const loginTime = new Date(session.login_at);
            const logoutTime = session.logout_at ? new Date(session.logout_at) : null;
            const duration = logoutTime
              ? Math.round((logoutTime.getTime() - loginTime.getTime()) / 1000 / 60)
              : 'Still Active';

            return {
              'User': session.user?.full_name || 'Unknown',
              'Login': loginTime.toLocaleString(),
              'Logout': logoutTime ? logoutTime.toLocaleString() : 'N/A',
              'Duration (minutes)': duration,
              'IP Address': session.ip_address || 'N/A',
              'Status': session.is_active ? 'Active' : 'Ended'
            };
          });
        }

        default:
          return [];
      }
    } catch (error) {
      console.error(`Error fetching ${moduleId} data:`, error);
      return [];
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#015324] to-[#016428] flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Export Data</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4">
            Select the modules you want to include in your export:
          </p>

          <div className="space-y-3">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <button
                  key={module.id}
                  onClick={() => toggleModule(module.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    module.enabled
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      module.enabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`flex-1 text-left font-medium ${
                      module.enabled ? 'text-emerald-900' : 'text-slate-700'
                    }`}
                  >
                    {module.name}
                  </span>
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      module.enabled
                        ? 'bg-emerald-600 border-emerald-600'
                        : 'border-slate-300'
                    }`}
                  >
                    {module.enabled && <CheckCircle className="w-4 h-4 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          {modules.find(m => m.id === 'forms')?.enabled && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Form Options</p>
              <label
                className="flex items-center gap-3 cursor-pointer group p-3 rounded-lg hover:bg-slate-50 transition-colors"
                onClick={() => setIncludeRejectedForms(!includeRejectedForms)}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    includeRejectedForms
                      ? 'bg-rose-500 border-rose-500'
                      : 'border-slate-300 group-hover:border-slate-400'
                  }`}
                >
                  {includeRejectedForms && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Include Rejected Forms</p>
                  <p className="text-xs text-slate-500">Rejected submissions are excluded by default</p>
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || modules.every(m => !m.enabled)}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-[#015324] to-[#016428] text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export Selected
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
