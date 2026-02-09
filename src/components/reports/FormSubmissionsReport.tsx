import { useState, useEffect } from 'react';
import { FileText, Clock, Download, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import * as XLSX from 'xlsx';
import { useToast } from '../../contexts/ToastContext';

interface FormSubmissionsReportProps {
  orgId: string;
  userId: string;
  userRole: string;
  dateRange: string;
}

export function FormSubmissionsReport({ orgId, dateRange }: FormSubmissionsReportProps) {
  const { showSuccess, showWarning } = useToast();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeRejected, setIncludeRejected] = useState(false);

  useEffect(() => {
    loadData();
  }, [orgId, dateRange, includeRejected]);

  const loadData = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter();

      let submissionsQuery = supabase
        .from('form_submissions')
        .select(`
          id,
          submitted_at,
          time_spent,
          status,
          form:forms!inner(id, title, org_id),
          submitted_by:users!form_submissions_submitted_by_fkey(id, full_name)
        `)
        .eq('form.org_id', orgId)
        .gte('submitted_at', dateFilter)
        .order('submitted_at', { ascending: false });

      if (!includeRejected) {
        submissionsQuery = submissionsQuery.neq('status', 'rejected');
      }

      const [formsData, submissionsData] = await Promise.all([
        supabase
          .from('forms')
          .select('id, title, created_at')
          .eq('org_id', orgId)
          .eq('is_active', true),
        submissionsQuery
      ]);

      setForms(formsData.data || []);
      setSubmissions(submissionsData.data || []);
    } catch (error) {
      console.error('Error loading form submissions report:', error);
    } finally {
      setLoading(false);
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

  const getFormStats = (formId: string) => {
    const formSubmissions = submissions.filter(s => s.form?.id === formId);

    return {
      count: formSubmissions.length,
      avgTime: 0
    };
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const exportFormData = async (formId: string, formTitle: string) => {
    const formSubmissions = submissions.filter(s => s.form?.id === formId);

    if (formSubmissions.length === 0) {
      showWarning('No Data', 'No submissions to export for this form');
      return;
    }

    const exportData = formSubmissions.map(sub => ({
      'Form': sub.form?.title || '',
      'Submitted By': sub.submitted_by?.full_name || 'Unknown',
      'Submitted At': new Date(sub.submitted_at).toLocaleString(),
      'Time Spent': sub.time_spent || 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions');

    const fileName = `${formTitle.replace(/[^a-z0-9]/gi, '_')}_Submissions_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    showSuccess('Export Successful', `${formTitle} submissions have been exported`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setIncludeRejected(!includeRejected)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
            includeRejected
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          {includeRejected ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          <span>{includeRejected ? 'Rejected Included' : 'Rejected Excluded'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-slate-800">{submissions.length}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Total Submissions</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 text-emerald-600" />
            <span className="text-2xl font-bold text-slate-800">{forms.length}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Active Forms</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-amber-600" />
            <span className="text-2xl font-bold text-slate-800">
              N/A
            </span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Avg Completion Time</h3>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Form Performance</h3>
          <p className="text-sm text-slate-600 mt-1">Individual form submission analytics</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Form Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Submissions</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Avg Time</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {forms.map((form) => {
                const stats = getFormStats(form.id);
                return (
                  <tr key={form.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{form.title}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Created {new Date(form.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                        <FileText className="w-4 h-4" />
                        {stats.count}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-700 font-medium">-</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => exportFormData(form.id, form.title)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
