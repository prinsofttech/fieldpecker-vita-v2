import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Map, Filter, Search, Users, AlertCircle, MapPin, Clock, XCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { DateRangeSelector, getInitialDateRange } from '../common/DateRangeSelector';
import type { DateRangeValue } from '../common/DateRangeSelector';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface AgentLocation {
  id: string;
  customer_name: string;
  customer_code: string;
  customer_picture?: string;
  latitude: number;
  longitude: number;
  location_of_outlet: string;
  country: string;
  customer_telephone: string;
  region_id: string;
  branch_id: string;
  is_active: boolean;
  updated_at: string;
  has_submissions?: boolean;
  region?: {
    name: string;
  };
  branch?: {
    name: string;
  };
}

interface IssueInfo {
  id: string;
  issue_number: string;
  title: string;
  priority: string;
  status: string;
  reported_at: string;
}

interface Filters {
  region_id: string;
  branch_id: string;
  status: string;
  search: string;
}

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
}

export function HeatMapDashboard() {
  const [agents, setAgents] = useState<AgentLocation[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<AgentLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [regions, setRegions] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentLocation | null>(null);
  const [agentIssues, setAgentIssues] = useState<IssueInfo[]>([]);
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 20]);
  const [mapZoom, setMapZoom] = useState(2);
  const [dateRange, setDateRange] = useState<DateRangeValue>(getInitialDateRange('today'));
  const [customersWithSubmissions, setCustomersWithSubmissions] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<Filters>({
    region_id: '',
    branch_id: '',
    status: '',
    search: ''
  });

  useEffect(() => {
    fetchUserOrg();
  }, []);

  useEffect(() => {
    if (orgId) {
      loadData();
      loadRegions();
    }
  }, [orgId, dateRange]);

  useEffect(() => {
    if (filters.region_id) {
      loadBranches(filters.region_id);
    } else {
      setBranches([]);
    }
  }, [filters.region_id]);

  useEffect(() => {
    applyFilters();
  }, [agents, filters]);

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);

    try {
      const fromDate = new Date(dateRange.startDate);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(dateRange.endDate);
      toDate.setHours(23, 59, 59, 999);

      console.log('Loading submissions from:', fromDate.toISOString(), 'to:', toDate.toISOString());

      const pageSize = 1000;

      // Fetch ALL submissions with pagination
      let allSubmissionsData: any[] = [];
      let submissionPage = 0;
      let hasMoreSubmissions = true;

      while (hasMoreSubmissions) {
        const { data, error } = await supabase
          .from('form_submissions')
          .select('agent_id')
          .gte('submitted_at', fromDate.toISOString())
          .lte('submitted_at', toDate.toISOString())
          .range(submissionPage * pageSize, (submissionPage + 1) * pageSize - 1);

        if (error) {
          console.error('Error loading submissions:', error);
          break;
        }

        if (data && data.length > 0) {
          allSubmissionsData = [...allSubmissionsData, ...data];
          submissionPage++;
          hasMoreSubmissions = data.length === pageSize;
        } else {
          hasMoreSubmissions = false;
        }
      }

      const submissionsData = allSubmissionsData;
      const customerIdsWithSubmissions = new Set(submissionsData.map(s => s.agent_id) || []);
      console.log('Customers with submissions:', customerIdsWithSubmissions.size);
      setCustomersWithSubmissions(customerIdsWithSubmissions);

      console.log('Loading customers for org:', orgId);

      // Fetch ALL customers with pagination
      let allCustomersData: any[] = [];
      let customerPage = 0;
      let hasMoreCustomers = true;

      while (hasMoreCustomers) {
        const { data, error } = await supabase
          .from('customers')
          .select(`
            *,
            region:regions!agents_region_id_fkey(name),
            branch:branches!agents_branch_id_fkey(name)
          `)
          .eq('org_id', orgId)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .order('customer_name')
          .range(customerPage * pageSize, (customerPage + 1) * pageSize - 1);

        if (error) {
          console.error('Error loading customers:', error);
          break;
        }

        if (data && data.length > 0) {
          allCustomersData = [...allCustomersData, ...data];
          customerPage++;
          hasMoreCustomers = data.length === pageSize;
        } else {
          hasMoreCustomers = false;
        }
      }

      const customersData = allCustomersData;
      const customersError = allCustomersData.length === 0 ? new Error('No customers found') : null;

      if (customersError) {
        console.error('Query error:', customersError);
        throw customersError;
      }

      console.log('Customers with location data:', customersData?.length || 0);

      const agentsWithSubmissionFlag = (customersData || []).map(agent => ({
        ...agent,
        has_submissions: customerIdsWithSubmissions.has(agent.id)
      }));

      setAgents(agentsWithSubmissionFlag);

      if (customersData && customersData.length > 0) {
        const avgLat = customersData.reduce((sum, agent) => sum + Number(agent.latitude), 0) / customersData.length;
        const avgLng = customersData.reduce((sum, agent) => sum + Number(agent.longitude), 0) / customersData.length;
        console.log('Map center:', avgLat, avgLng);
        setMapCenter([avgLat, avgLng]);
        setMapZoom(6);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserOrg = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (data) {
        setOrgId(data.org_id);
      }
    }
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

  const applyFilters = () => {
    let filtered = [...agents];

    if (filters.region_id) {
      filtered = filtered.filter(agent => agent.region_id === filters.region_id);
    }

    if (filters.branch_id) {
      filtered = filtered.filter(agent => agent.branch_id === filters.branch_id);
    }

    if (filters.status === 'active') {
      filtered = filtered.filter(agent => agent.is_active);
    } else if (filters.status === 'inactive') {
      filtered = filtered.filter(agent => !agent.is_active);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(agent =>
        agent.customer_name.toLowerCase().includes(searchLower) ||
        agent.customer_code.toLowerCase().includes(searchLower) ||
        agent.location_of_outlet?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredAgents(filtered);
  };

  const loadAgentDetails = async (agent: AgentLocation) => {
    setSelectedAgent(agent);

    const { data: issues } = await supabase
      .from('issues')
      .select('id, issue_number, title, priority, status, reported_at')
      .eq('customer_id', agent.id)
      .in('status', ['new', 'assigned', 'in_progress', 'on_hold'])
      .order('reported_at', { ascending: false })
      .limit(5);

    setAgentIssues(issues || []);

    const { data: lastFormSubmission } = await supabase
      .from('form_submissions')
      .select('submitted_at')
      .eq('agent_id', agent.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setLastVisit(lastFormSubmission?.submitted_at || null);
  };

  const createMarkerIcon = (agent: AgentLocation) => {
    const hasIssues = agentIssues.length > 0 && selectedAgent?.id === agent.id;
    let color = '#10B981';

    if (!agent.is_active) {
      color = '#6B7280';
    } else if (hasIssues) {
      color = '#EF4444';
    } else if (agent.has_submissions) {
      color = '#F97316';
    }

    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background-color: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const clearFilters = () => {
    setFilters({
      region_id: '',
      branch_id: '',
      status: '',
      search: ''
    });
  };

  const activeFilterCount = [
    filters.region_id,
    filters.branch_id,
    filters.status,
    filters.search
  ].filter(Boolean).length;

  return (
    <>
      <style>{`
        .custom-popup .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }
        .custom-popup .leaflet-popup-content {
          margin: 0;
          width: auto !important;
        }
        .custom-popup .leaflet-popup-tip-container {
          display: none;
        }
      `}</style>
      <div className="min-h-screen bg-slate-50">
        <div className="h-screen flex flex-col">
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-5 pt-20 lg:pt-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Map className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Customer Heat Map</h1>
                <p className="text-sm text-slate-500 mt-0.5">{filteredAgents.length} locations</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-xs font-semibold text-emerald-700">Active</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-200">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="text-xs font-semibold text-orange-700">Has Forms</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-lg border border-red-200">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-xs font-semibold text-red-700">Issues</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
                <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                <span className="text-xs font-semibold text-slate-600">Inactive</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 min-w-0 sm:min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by customer name, code, or location..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-sm"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-slate-600 mb-1 px-1">Territory</label>
              <select
                value={filters.region_id}
                onChange={(e) => setFilters({ ...filters, region_id: e.target.value, branch_id: '' })}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-sm font-medium text-slate-700"
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
              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-600 mb-1 px-1">Sub-Territory</label>
                <select
                  value={filters.branch_id}
                  onChange={(e) => setFilters({ ...filters, branch_id: e.target.value })}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-sm font-medium text-slate-700"
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

            <div className="flex flex-col">
              <label className="text-xs font-medium text-slate-600 mb-1 px-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-sm font-medium text-slate-700"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <DateRangeSelector
              value={dateRange}
              onChange={setDateRange}
              label="Date Range"
            />

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 transition-all text-sm font-semibold flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 relative z-0">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-0">
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <p className="text-slate-600 font-medium">Loading map...</p>
              </div>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-0">
              <div className="text-center">
                <MapPin className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">No Customers Found</h3>
                <p className="text-slate-600">No customers with location data match your filters</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full z-0">
              <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapUpdater center={mapCenter} zoom={mapZoom} />

              {filteredAgents.map((agent) => (
                <Marker
                  key={agent.id}
                  position={[Number(agent.latitude), Number(agent.longitude)]}
                  icon={createMarkerIcon(agent)}
                  eventHandlers={{
                    click: () => loadAgentDetails(agent)
                  }}
                >
                  <Popup className="custom-popup" maxWidth={340}>
                    <div className="min-w-[320px] -m-3">
                      {/* Header with gradient background and profile picture */}
                      <div className="relative bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-6 pb-16 rounded-t-xl">
                        <div className="absolute top-4 right-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${agent.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}`}>
                            {agent.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        {/* Profile Picture */}
                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-14">
                          {agent.customer_picture ? (
                            <div className="w-28 h-28 rounded-full border-4 border-white shadow-xl bg-white overflow-hidden">
                              <img
                                src={agent.customer_picture}
                                alt={agent.customer_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback to initials on image error
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.parentElement!.innerHTML = `
                                    <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-3xl font-bold">
                                      ${agent.customer_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                  `;
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-28 h-28 rounded-full border-4 border-white shadow-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-3xl font-bold">
                              {agent.customer_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 pt-16 bg-white rounded-b-xl">
                        {/* Name and Code */}
                        <div className="text-center mb-5">
                          <h3 className="text-xl font-bold text-slate-800 mb-1">{agent.customer_name}</h3>
                          <p className="text-sm font-medium text-slate-500">Code: {agent.customer_code}</p>
                        </div>

                        {/* Details */}
                        <div className="space-y-3 mb-4">
                          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                            <MapPin className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-slate-700 font-medium">{agent.location_of_outlet || 'No location'}</span>
                          </div>

                          {agent.region && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                              <Map className="w-5 h-5 text-slate-600 flex-shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-sm text-slate-700 font-medium">{agent.region.name}</span>
                                {agent.branch && (
                                  <span className="text-xs text-slate-500 mt-0.5">{agent.branch.name}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {lastVisit && selectedAgent?.id === agent.id && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                              <Clock className="w-5 h-5 text-slate-600 flex-shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-500">Last visit</span>
                                <span className="text-sm text-slate-700 font-medium">{formatDate(lastVisit)}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Issues Section */}
                        {selectedAgent?.id === agent.id && agentIssues.length > 0 && (
                          <div className="border-t border-slate-200 pt-4 mt-4">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertCircle className="w-5 h-5 text-orange-500" />
                              <span className="text-sm font-bold text-slate-800">
                                {agentIssues.length} Unresolved Issue{agentIssues.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {agentIssues.map((issue) => (
                                <div key={issue.id} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 border border-slate-200">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-bold text-slate-700">{issue.issue_number}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getPriorityColor(issue.priority)}`}>
                                      {issue.priority}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-700 font-medium line-clamp-2">{issue.title}</p>
                                  <p className="text-xs text-slate-500 mt-1.5">{formatDate(issue.reported_at)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedAgent?.id === agent.id && agentIssues.length === 0 && (
                          <div className="flex items-center gap-2 text-emerald-700 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg px-4 py-3 border border-emerald-200">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm font-bold">No unresolved issues</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
