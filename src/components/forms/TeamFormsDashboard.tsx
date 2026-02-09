import { useState, useEffect } from 'react';
import { Users, TrendingUp, Download, Calendar } from 'lucide-react';
import type { TeamFormStats } from '../../lib/forms/types';
import { FormService } from '../../lib/forms/form-service';
import { useToast } from '../../contexts/ToastContext';

interface TeamFormsDashboardProps {
  supervisorId: string;
}

export function TeamFormsDashboard({ supervisorId }: TeamFormsDashboardProps) {
  const { showSuccess, showError, showWarning } = useToast();
  const [teamStats, setTeamStats] = useState<TeamFormStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFormId, setSelectedFormId] = useState<string>('all');
  const [exportingCsv, setExportingCsv] = useState(false);

  useEffect(() => {
    loadTeamStats();
  }, [supervisorId]);

  const loadTeamStats = async () => {
    setLoading(true);
    try {
      const stats = await FormService.getTeamFormStats(supervisorId);
      setTeamStats(stats);
    } catch (error) {
      console.error('Error loading team stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    if (selectedFormId === 'all') {
      showWarning('Select Form', 'Please select a specific form to export');
      return;
    }

    setExportingCsv(true);
    try {
      const csv = await FormService.exportSubmissionsCSV(selectedFormId);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `form_submissions_${selectedFormId}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showSuccess('Export Successful', 'Form submissions have been exported to CSV');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      showError('Export Failed', 'Unable to export CSV file. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };

  const uniqueForms = Array.from(
    new Set(
      teamStats.flatMap(agent => agent.forms.map(f => JSON.stringify({ id: f.form_id, title: f.form_title })))
    )
  ).map(str => JSON.parse(str));

  const filteredStats = selectedFormId === 'all'
    ? teamStats
    : teamStats.map(agent => ({
        ...agent,
        forms: agent.forms.filter(f => f.form_id === selectedFormId)
      })).filter(agent => agent.forms.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-[#015324] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Team Forms Dashboard</h2>
          <p className="text-slate-600 mt-1">Monitor form completion across your team</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Team Members</p>
              <p className="text-2xl font-bold text-slate-800">{teamStats.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Submissions</p>
              <p className="text-2xl font-bold text-slate-800">
                {teamStats.reduce((sum, agent) =>
                  sum + agent.forms.reduce((s, f) => s + f.submissions_count, 0), 0
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Avg Completion</p>
              <p className="text-2xl font-bold text-slate-800">
                {teamStats.length > 0
                  ? Math.round(
                      teamStats.reduce((sum, agent) =>
                        sum + agent.forms.reduce((s, f) => s + f.completion_rate, 0) / Math.max(agent.forms.length, 1), 0
                      ) / teamStats.length
                    )
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-800">Filter & Export</h3>
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv || selectedFormId === 'all'}
            className="flex items-center gap-2 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingCsv ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export CSV
              </>
            )}
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Filter by Form
          </label>
          <select
            value={selectedFormId}
            onChange={(e) => setSelectedFormId(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
          >
            <option value="all">All Forms</option>
            {uniqueForms.map(form => (
              <option key={form.id} value={form.id}>
                {form.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredStats.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
          <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No team data</h3>
          <p className="text-slate-600">Your team members haven't started any forms yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStats.map((agent) => (
            <div key={agent.agent_id} className="bg-white rounded-xl shadow-lg border-2 border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h4 className="font-bold text-slate-800">{agent.agent_name}</h4>
                <p className="text-sm text-slate-600">{agent.forms.length} active forms</p>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  {agent.forms.map((form) => (
                    <div key={form.form_id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h5 className="font-semibold text-slate-800">{form.form_title}</h5>
                          <p className="text-xs text-slate-600 mt-1">
                            {form.last_submission_at
                              ? `Last submitted: ${new Date(form.last_submission_at).toLocaleString()}`
                              : 'No submissions yet'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-[#015324]">
                            {Math.round(form.completion_rate)}%
                          </p>
                          <p className="text-xs text-slate-600">
                            {form.current_cycle} / {form.max_cycles}
                          </p>
                        </div>
                      </div>

                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            form.completion_rate === 100
                              ? 'bg-green-500'
                              : form.completion_rate >= 50
                              ? 'bg-[#015324]'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${form.completion_rate}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between mt-3 text-sm">
                        <span className="text-slate-600">
                          {form.submissions_count} submissions this month
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          form.completion_rate === 100
                            ? 'bg-green-100 text-green-700'
                            : form.completion_rate >= 50
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {form.completion_rate === 100
                            ? 'Complete'
                            : form.completion_rate >= 50
                            ? 'On Track'
                            : 'Needs Attention'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
