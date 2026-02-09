import { useEffect, useState } from 'react';
import {
  Users,
  MapPin,
  Clock,
  TrendingUp,
  CheckCircle,
  FileText,
  UserCheck,
  Activity,
  Circle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Navigation,
  AlertCircle,
  Target
} from 'lucide-react';
import { teamService, type TeamMemberWithActivity } from '../../lib/team/team-service';

interface MyTeamDashboardProps {
  userId: string;
  orgId: string;
  isAdmin?: boolean;
}

export function MyTeamDashboard({ userId, orgId, isAdmin = false }: MyTeamDashboardProps) {
  const [teamHierarchy, setTeamHierarchy] = useState<TeamMemberWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTeamData();
  }, [userId, orgId, isAdmin]);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      const hierarchy = await teamService.getTeamHierarchyWithActivity(userId);
      setTeamHierarchy(hierarchy);
      setExpandedMembers(new Set(hierarchy.map(m => m.id)));
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setExpandedMembers(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const calculateTotalStats = (members: TeamMemberWithActivity[]): any => {
    let stats = {
      totalMembers: 0,
      activeNow: 0,
      totalForms: 0,
      totalIssues: 0,
      totalLeads: 0,
      todayForms: 0,
      todayIssues: 0,
      todayLeads: 0,
    };

    const countMember = (member: TeamMemberWithActivity) => {
      stats.totalMembers++;
      if (member.currentSession?.is_active) stats.activeNow++;
      if (member.activity) {
        stats.totalForms += member.activity.stats.totalForms;
        stats.totalIssues += member.activity.stats.totalIssues;
        stats.totalLeads += member.activity.stats.totalLeads;
        stats.todayForms += member.activity.stats.todayForms;
        stats.todayIssues += member.activity.stats.todayIssues;
        stats.todayLeads += member.activity.stats.todayLeads;
      }
      if (member.subordinates) {
        member.subordinates.forEach(countMember);
      }
    };

    members.forEach(countMember);
    return stats;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-[#015324] animate-spin" />
      </div>
    );
  }

  const stats = calculateTotalStats(teamHierarchy);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">My Team</h1>
            <p className="text-slate-600">
              Monitor your team hierarchy and track their activities across all modules
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Total Team"
          value={stats.totalMembers}
          color="bg-slate-600"
        />
        <StatCard
          icon={Activity}
          label="Active Now"
          value={stats.activeNow}
          color="bg-green-500"
        />
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-amber-500">
              <FileText className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-1">Forms</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-slate-900">{stats.todayForms}</p>
            <p className="text-xs text-slate-600">today</p>
          </div>
          <p className="text-xs text-slate-500 mt-1">{stats.totalForms} total</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-red-500">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-1">Issues</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-slate-900">{stats.todayIssues}</p>
            <p className="text-xs text-slate-600">today</p>
          </div>
          <p className="text-xs text-slate-500 mt-1">{stats.totalIssues} total</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-[#015324]">
              <Target className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-1">Leads</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-slate-900">{stats.todayLeads}</p>
            <p className="text-xs text-slate-600">today</p>
          </div>
          <p className="text-xs text-slate-500 mt-1">{stats.totalLeads} total</p>
        </div>
      </div>

      <div className="space-y-4">
        {teamHierarchy.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Team Members Yet</h3>
            <p className="text-slate-600">
              You don't have any direct reports at the moment.
            </p>
          </div>
        ) : (
          teamHierarchy.map((member) => (
            <TeamMemberWithActivityCard
              key={member.id}
              member={member}
              level={0}
              expanded={expandedMembers.has(member.id)}
              onToggle={() => toggleMember(member.id)}
              expandedMembers={expandedMembers}
              onToggleSubordinate={toggleMember}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <p className="text-sm text-slate-600 mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

interface TeamMemberWithActivityCardProps {
  member: TeamMemberWithActivity;
  level: number;
  expanded: boolean;
  onToggle: () => void;
  expandedMembers: Set<string>;
  onToggleSubordinate: (id: string) => void;
}

function TeamMemberWithActivityCard({
  member,
  level,
  expanded,
  onToggle,
  expandedMembers,
  onToggleSubordinate,
}: TeamMemberWithActivityCardProps) {
  const hasSubordinates = member.subordinates && member.subordinates.length > 0;
  const marginLeft = level * 32;

  return (
    <div style={{ marginLeft: `${marginLeft}px` }}>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4 flex-1">
              {hasSubordinates && (
                <button
                  onClick={onToggle}
                  className="p-1 hover:bg-slate-100 rounded transition-colors mt-1"
                >
                  {expanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  )}
                </button>
              )}
              <div className={hasSubordinates ? '' : 'ml-8'}>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-slate-900">{member.full_name}</h3>
                  {member.currentSession?.is_active && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      <Circle className="w-2 h-2 fill-current" />
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mb-1">{member.email}</p>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <span className="font-medium text-[#015324]">{member.role?.display_name}</span>
                  {member.department && (
                    <>
                      <span>•</span>
                      <span>{member.department.name}</span>
                    </>
                  )}
                  {member.branch && (
                    <>
                      <span>•</span>
                      <span>{member.branch.name}</span>
                    </>
                  )}
                </div>
                {hasSubordinates && (
                  <p className="text-sm text-slate-500 mt-1">
                    {member.subordinates.length} direct report{member.subordinates.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          {member.activity && (
            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <div>
                    <span className="font-semibold text-slate-900">{member.activity.stats.todayForms}</span>
                    <span className="text-slate-600"> forms today</span>
                    <span className="text-xs text-slate-500 ml-2">({member.activity.stats.totalForms} total)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <div>
                    <span className="font-semibold text-slate-900">{member.activity.stats.todayIssues}</span>
                    <span className="text-slate-600"> issues today</span>
                    <span className="text-xs text-slate-500 ml-2">({member.activity.stats.totalIssues} total)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#015324]" />
                  <div>
                    <span className="font-semibold text-slate-900">{member.activity.stats.todayLeads}</span>
                    <span className="text-slate-600"> leads today</span>
                    <span className="text-xs text-slate-500 ml-2">({member.activity.stats.totalLeads} total)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {expanded && hasSubordinates && (
        <div className="mt-4 space-y-4">
          {member.subordinates!.map((subordinate) => (
            <TeamMemberWithActivityCard
              key={subordinate.id}
              member={subordinate}
              level={level + 1}
              expanded={expandedMembers.has(subordinate.id)}
              onToggle={() => onToggleSubordinate(subordinate.id)}
              expandedMembers={expandedMembers}
              onToggleSubordinate={onToggleSubordinate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
