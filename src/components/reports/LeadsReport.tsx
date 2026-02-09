import { useState, useEffect } from 'react';
import { Target, DollarSign, Users, CheckCircle, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import * as XLSX from 'xlsx';

interface LeadsReportProps {
  orgId: string;
  userId: string;
  userRole: string;
  dateRange: string;
}

export function LeadsReport({ orgId, dateRange }: LeadsReportProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [orgId, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter();

      const { data } = await supabase
        .from('leads')
        .select(`
          id,
          company_name,
          contact_person,
          status,
          score,
          estimated_value,
          created_at,
          converted_at,
          created_by:users(id, full_name)
        `)
        .eq('org_id', orgId)
        .gte('created_at', dateFilter)
        .order('created_at', { ascending: false });

      setLeads(data || []);
    } catch (error) {
      console.error('Error loading leads report:', error);
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

  const getStats = () => {
    const converted = leads.filter(l => l.status === 'converted' || l.status === 'won');
    const conversionRate = leads.length > 0 ? Math.round((converted.length / leads.length) * 100) : 0;
    const totalValue = converted.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
    const avgValue = converted.length > 0 ? Math.round(totalValue / converted.length) : 0;

    return {
      totalLeads: leads.length,
      convertedLeads: converted.length,
      conversionRate,
      totalValue,
      avgValue
    };
  };

  const getStatusDistribution = () => {
    return {
      new: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      qualified: leads.filter(l => l.status === 'qualified').length,
      proposal: leads.filter(l => l.status === 'proposal').length,
      negotiation: leads.filter(l => l.status === 'negotiation').length,
      won: leads.filter(l => l.status === 'won' || l.status === 'converted').length,
      lost: leads.filter(l => l.status === 'lost').length
    };
  };

  const exportLeadsPipeline = () => {
    const pipelineData = Object.entries(statusDist).map(([status, count]) => ({
      'Status': status.charAt(0).toUpperCase() + status.slice(1),
      'Count': count,
      'Percentage': leads.length > 0 ? `${Math.round((count / leads.length) * 100)}%` : '0%'
    }));

    const worksheet = XLSX.utils.json_to_sheet(pipelineData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lead Pipeline');

    const fileName = `Lead_Pipeline_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const exportKeyMetrics = () => {
    const metricsData = [
      { 'Metric': 'Total Leads', 'Value': stats.totalLeads },
      { 'Metric': 'Converted Leads', 'Value': stats.convertedLeads },
      { 'Metric': 'Conversion Rate', 'Value': `${stats.conversionRate}%` },
      { 'Metric': 'Total Value', 'Value': `$${stats.totalValue.toLocaleString()}` },
      { 'Metric': 'Average Value', 'Value': `$${stats.avgValue.toLocaleString()}` },
      { 'Metric': 'Active Opportunities', 'Value': statusDist.qualified + statusDist.proposal + statusDist.negotiation }
    ];

    const worksheet = XLSX.utils.json_to_sheet(metricsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Key Metrics');

    const fileName = `Lead_Key_Metrics_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const stats = getStats();
  const statusDist = getStatusDistribution();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-slate-800">{stats.totalLeads}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Total Leads</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
            <span className="text-2xl font-bold text-slate-800">{stats.convertedLeads}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Converted</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8 text-amber-600" />
            <span className="text-2xl font-bold text-slate-800">{stats.conversionRate}%</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Conversion Rate</h3>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-purple-600" />
            <span className="text-2xl font-bold text-slate-800">${stats.totalValue.toLocaleString()}</span>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Total Value</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Lead Status Pipeline</h3>
              <p className="text-sm text-slate-600 mt-1">Leads grouped by pipeline stage</p>
            </div>
            <button
              onClick={exportLeadsPipeline}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          <div className="space-y-3">
            {Object.entries(statusDist).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-slate-700 capitalize font-medium">{status}</span>
                <div className="flex items-center gap-3">
                  <div className="w-48 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        status === 'won'
                          ? 'bg-emerald-500'
                          : status === 'lost'
                          ? 'bg-red-500'
                          : status === 'negotiation'
                          ? 'bg-amber-500'
                          : 'bg-[#015324]'
                      }`}
                      style={{ width: `${leads.length > 0 ? (count / leads.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 w-12 text-right">
                    {count} ({leads.length > 0 ? Math.round((count / leads.length) * 100) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Key Metrics</h3>
              <p className="text-sm text-slate-600 mt-1">Performance indicators</p>
            </div>
            <button
              onClick={exportKeyMetrics}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600 font-medium">Average Lead Value</span>
              <span className="text-xl font-bold text-slate-800">${stats.avgValue.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600 font-medium">Active Opportunities</span>
              <span className="text-xl font-bold text-slate-800">
                {statusDist.qualified + statusDist.proposal + statusDist.negotiation}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600 font-medium">Win Rate</span>
              <span className="text-xl font-bold text-emerald-600">{stats.conversionRate}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
