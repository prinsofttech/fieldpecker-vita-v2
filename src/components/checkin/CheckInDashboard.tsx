import { useState, useEffect } from 'react';
import {
  UserCheck,
  LogIn,
  LogOut,
  Clock,
  MapPin,
  Search,
  RefreshCw,
  Filter,
  Users,
  Timer,
  ChevronDown,
  X,
  CalendarDays
} from 'lucide-react';
import { CheckinService } from '../../lib/checkin/checkin-service';
import { CheckinLocationMap } from './CheckinLocationMap';
import type { CheckinWithUser, CheckinFilters, CheckinStats } from '../../lib/checkin/types';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase/client';

interface CheckInDashboardProps {
  orgId: string;
  userId: string;
  userRole?: string;
}

export function CheckInDashboard({ orgId, userId, userRole }: CheckInDashboardProps) {
  const { showSuccess, showError } = useToast();
  const [checkins, setCheckins] = useState<CheckinWithUser[]>([]);
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'checked_in' | 'checked_out'>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCheckin, setSelectedCheckin] = useState<CheckinWithUser | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [orgUsers, setOrgUsers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [reCheckingIn, setReCheckingIn] = useState<string | null>(null);

  const isAdmin = userRole === 'client_admin' || userRole === 'super_admin';

  useEffect(() => {
    loadData();
    if (isAdmin) {
      loadOrgUsers();
    }
  }, [orgId, statusFilter, dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      const filters: CheckinFilters = {
        status: statusFilter === 'all' ? undefined : statusFilter,
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined,
        search: searchTerm || undefined,
      };

      const [checkinData, statsData] = await Promise.all([
        CheckinService.listCheckins(orgId, filters),
        CheckinService.getStats(orgId, filters),
      ]);

      setCheckins(checkinData);
      setStats(statsData);
    } catch (error: any) {
      console.error('Error loading checkins:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .order('full_name');

    if (data) setOrgUsers(data);
  };

  const handleCheckOut = async (checkinId: string) => {
    try {
      setCheckingOut(checkinId);
      await CheckinService.checkOut(checkinId);
      showSuccess('Checked out successfully');
      await loadData();
    } catch (error: any) {
      showError('Failed to check out: ' + error.message);
    } finally {
      setCheckingOut(null);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedUserId) return;
    try {
      setCheckingIn(true);
      await CheckinService.checkIn(selectedUserId, orgId);
      showSuccess('User checked in successfully');
      setShowCheckInModal(false);
      setSelectedUserId('');
      await loadData();
    } catch (error: any) {
      showError('Failed to check in: ' + error.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleReCheckIn = async (targetUserId: string) => {
    try {
      setReCheckingIn(targetUserId);
      await CheckinService.checkIn(targetUserId, orgId);
      showSuccess('User checked in again successfully');
      await loadData();
    } catch (error: any) {
      showError('Failed to check in: ' + error.message);
    } finally {
      setReCheckingIn(null);
    }
  };

  const handleSearch = () => {
    loadData();
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (checkInAt: string, checkOutAt: string | null) => {
    const start = new Date(checkInAt).getTime();
    const end = checkOutAt ? new Date(checkOutAt).getTime() : Date.now();
    const diff = end - start;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setDateRange({ start: '', end: '' });
    setSearchTerm('');
  };

  const currentlyCheckedIn = checkins.filter(c => !c.check_out_at);
  const activeUserIds = new Set(currentlyCheckedIn.map(c => c.user_id));

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const checkedOutToday = checkins.filter(c => {
    if (!c.check_out_at) return false;
    const checkInDate = new Date(c.check_in_at);
    const dateStr = `${checkInDate.getFullYear()}-${String(checkInDate.getMonth() + 1).padStart(2, '0')}-${String(checkInDate.getDate()).padStart(2, '0')}`;
    return dateStr === todayStr;
  });
  const eligibleForReCheckin = new Set(
    checkedOutToday
      .filter(c => !activeUserIds.has(c.user_id))
      .map(c => c.user_id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/25">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            Check-In Management
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-[52px]">
            Track and manage field agent check-ins and check-outs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-slate-600" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowCheckInModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl hover:from-teal-600 hover:to-emerald-700 transition-all shadow-lg shadow-teal-500/25 font-medium text-sm"
            >
              <LogIn className="w-4 h-4" />
              Check In User
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-1">Total Check-ins</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
                <LogIn className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-700">{stats.checked_in}</div>
            <div className="text-xs text-slate-500 mt-1">Currently Checked In</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-slate-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-700">{stats.checked_out}</div>
            <div className="text-xs text-slate-500 mt-1">Checked Out</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center">
                <Timer className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-700">
              {stats.avg_duration_minutes > 60
                ? `${Math.floor(stats.avg_duration_minutes / 60)}h ${stats.avg_duration_minutes % 60}m`
                : `${stats.avg_duration_minutes}m`}
            </div>
            <div className="text-xs text-slate-500 mt-1">Avg Duration</div>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
            >
              <option value="all">All Status</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
            </select>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 border rounded-xl transition-all ${
                showFilters ? 'bg-teal-50 border-teal-200 text-teal-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>

            {(statusFilter !== 'all' || dateRange.start || dateRange.end) && (
              <button
                onClick={clearFilters}
                className="p-2.5 border border-red-200 rounded-xl text-red-500 hover:bg-red-50 transition-all"
                title="Clear filters"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
              <span className="text-sm text-slate-400">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Currently Checked In Section */}
      {currentlyCheckedIn.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            Currently Checked In ({currentlyCheckedIn.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {currentlyCheckedIn.map((checkin) => (
              <CheckinCard
                key={checkin.id}
                checkin={checkin}
                onCheckOut={handleCheckOut}
                checkingOut={checkingOut}
                isAdmin={isAdmin}
                formatDateTime={formatDateTime}
                formatDuration={formatDuration}
                onSelect={setSelectedCheckin}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Checkins Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Check-in History</h2>
          <p className="text-xs text-slate-500 mt-0.5">{checkins.length} records found</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : checkins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <UserCheck className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">No check-ins found</p>
            <p className="text-xs mt-1">Check-in records will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Check-in</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Check-out</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                  {isAdmin && (
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checkins.map((checkin) => (
                  <tr
                    key={checkin.id}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCheckin(checkin)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                          {checkin.user?.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{checkin.user?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-slate-500">{checkin.user?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{formatDateTime(checkin.check_in_at)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {checkin.check_out_at ? formatDateTime(checkin.check_out_at) : '--'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700">
                        {formatDuration(checkin.check_in_at, checkin.check_out_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {checkin.check_out_at ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          <LogOut className="w-3 h-3" /> Checked Out
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                          Checked In
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {checkin.check_in_latitude && checkin.check_in_longitude ? (
                        <span className="inline-flex items-center gap-1 text-xs text-teal-600">
                          <MapPin className="w-3 h-3" />
                          {checkin.check_in_latitude.toFixed(4)}, {checkin.check_in_longitude.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No location</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!checkin.check_out_at && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCheckOut(checkin.id);
                              }}
                              disabled={checkingOut === checkin.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-all disabled:opacity-50"
                            >
                              {checkingOut === checkin.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <LogOut className="w-3 h-3" />
                              )}
                              Check Out
                            </button>
                          )}
                          {checkin.check_out_at && eligibleForReCheckin.has(checkin.user_id) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReCheckIn(checkin.user_id);
                              }}
                              disabled={reCheckingIn === checkin.user_id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 transition-all disabled:opacity-50"
                            >
                              {reCheckingIn === checkin.user_id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <LogIn className="w-3 h-3" />
                              )}
                              Check In Again
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedCheckin && (
        <CheckinDetailModal
          checkin={selectedCheckin}
          onClose={() => setSelectedCheckin(null)}
          onCheckOut={handleCheckOut}
          onReCheckIn={handleReCheckIn}
          checkingOut={checkingOut}
          reCheckingIn={reCheckingIn}
          canReCheckIn={!!selectedCheckin.check_out_at && eligibleForReCheckin.has(selectedCheckin.user_id)}
          isAdmin={isAdmin}
          formatDateTime={formatDateTime}
          formatDuration={formatDuration}
        />
      )}

      {/* Check-in User Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Check In User</h3>
              <button
                onClick={() => { setShowCheckInModal(false); setSelectedUserId(''); }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select User</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="">-- Select a user --</option>
                  {orgUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500">
                This will create a new check-in record for the selected user at the current time.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100">
              <button
                onClick={() => { setShowCheckInModal(false); setSelectedUserId(''); }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckIn}
                disabled={!selectedUserId || checkingIn}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-emerald-600 rounded-xl hover:from-teal-600 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-teal-500/25"
              >
                {checkingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Check In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckinCard({
  checkin,
  onCheckOut,
  checkingOut,
  isAdmin,
  formatDateTime,
  formatDuration,
  onSelect,
}: {
  checkin: CheckinWithUser;
  onCheckOut: (id: string) => void;
  checkingOut: string | null;
  isAdmin: boolean;
  formatDateTime: (d: string) => string;
  formatDuration: (s: string, e: string | null) => string;
  onSelect: (c: CheckinWithUser) => void;
}) {
  return (
    <div
      onClick={() => onSelect(checkin)}
      className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold shadow-lg shadow-teal-500/20">
            {checkin.user?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{checkin.user?.full_name || 'Unknown'}</div>
            <div className="text-xs text-slate-500">{checkin.user?.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs font-semibold">Active</span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Checked in: {formatDateTime(checkin.check_in_at)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Timer className="w-3.5 h-3.5 text-slate-400" />
          <span>Duration: {formatDuration(checkin.check_in_at, null)}</span>
        </div>
        {checkin.check_in_latitude && checkin.check_in_longitude && (
          <div className="flex items-center gap-2 text-xs text-teal-600">
            <MapPin className="w-3.5 h-3.5" />
            <span>{checkin.check_in_latitude.toFixed(4)}, {checkin.check_in_longitude.toFixed(4)}</span>
          </div>
        )}
      </div>

      {isAdmin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCheckOut(checkin.id);
          }}
          disabled={checkingOut === checkin.id}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 border border-red-100 transition-all disabled:opacity-50"
        >
          {checkingOut === checkin.id ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          Check Out
        </button>
      )}
    </div>
  );
}

function CheckinDetailModal({
  checkin,
  onClose,
  onCheckOut,
  onReCheckIn,
  checkingOut,
  reCheckingIn,
  canReCheckIn,
  isAdmin,
  formatDateTime,
  formatDuration,
}: {
  checkin: CheckinWithUser;
  onClose: () => void;
  onCheckOut: (id: string) => void;
  onReCheckIn: (userId: string) => void;
  checkingOut: string | null;
  reCheckingIn: string | null;
  canReCheckIn: boolean;
  isAdmin: boolean;
  formatDateTime: (d: string) => string;
  formatDuration: (s: string, e: string | null) => string;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-900">Check-in Details</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-teal-500/20">
              {checkin.user?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">{checkin.user?.full_name || 'Unknown'}</div>
              <div className="text-sm text-slate-500">{checkin.user?.email}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                <LogIn className="w-3.5 h-3.5" /> Check-in
              </div>
              <div className="text-sm font-semibold text-slate-800">{formatDateTime(checkin.check_in_at)}</div>
              {checkin.check_in_latitude && checkin.check_in_longitude && (
                <div className="text-xs text-teal-600 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {checkin.check_in_latitude.toFixed(5)}, {checkin.check_in_longitude.toFixed(5)}
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5" /> Check-out
              </div>
              {checkin.check_out_at ? (
                <>
                  <div className="text-sm font-semibold text-slate-800">{formatDateTime(checkin.check_out_at)}</div>
                  {checkin.check_out_latitude && checkin.check_out_longitude && (
                    <div className="text-xs text-teal-600 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {checkin.check_out_latitude.toFixed(5)}, {checkin.check_out_longitude.toFixed(5)}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  Still Checked In
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl p-4 border border-teal-100">
            <div className="text-xs text-teal-600 mb-1 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" /> Duration
            </div>
            <div className="text-lg font-bold text-teal-800">
              {formatDuration(checkin.check_in_at, checkin.check_out_at)}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Location Map
            </div>
            <CheckinLocationMap
              checkInLat={checkin.check_in_latitude}
              checkInLng={checkin.check_in_longitude}
              checkOutLat={checkin.check_out_latitude}
              checkOutLng={checkin.check_out_longitude}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 flex-shrink-0">
          {isAdmin && !checkin.check_out_at && (
            <button
              onClick={() => onCheckOut(checkin.id)}
              disabled={checkingOut === checkin.id}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 border border-red-100 transition-all disabled:opacity-50"
            >
              {checkingOut === checkin.id ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              Check Out
            </button>
          )}
          {isAdmin && canReCheckIn && (
            <button
              onClick={() => onReCheckIn(checkin.user_id)}
              disabled={reCheckingIn === checkin.user_id}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-xl hover:bg-teal-100 border border-teal-100 transition-all disabled:opacity-50"
            >
              {reCheckingIn === checkin.user_id ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              Check In Again
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
