import {
  User,
  Mail,
  Briefcase,
  MapPin,
  Clock,
  Circle,
  CheckCircle,
  FileText,
  UserCheck,
  TrendingUp,
  Navigation
} from 'lucide-react';
import type { TeamMember } from '../../lib/team/team-service';

interface TeamMemberCardProps {
  member: TeamMember;
  onRefresh?: () => void;
}

export function TeamMemberCard({ member }: TeamMemberCardProps) {
  const isActive = member.currentSession?.is_active;
  const lastLogin = member.last_login_at
    ? new Date(member.last_login_at).toLocaleString()
    : 'Never';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-[#015324] to-[#016428] rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-xl">
                {member.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">{member.full_name}</h3>
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                <Mail className="w-4 h-4" />
                <span>{member.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  <Circle className={`w-2 h-2 ${isActive ? 'fill-green-600' : 'fill-slate-400'}`} />
                  {isActive ? 'Active Now' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">{member.role?.display_name}</span>
          </div>
          {member.department && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">{member.department.name}</span>
            </div>
          )}
          {member.branch && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">{member.branch.name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">Last login: {lastLogin}</span>
          </div>
        </div>

        {member.todayMetrics && (
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Today's Activity</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">Tasks</span>
                </div>
                <p className="text-lg font-bold text-blue-900">{member.todayMetrics.tasks_completed}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">Forms</span>
                </div>
                <p className="text-lg font-bold text-green-900">{member.todayMetrics.forms_submitted}</p>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs text-amber-600 font-medium">Visits</span>
                </div>
                <p className="text-lg font-bold text-amber-900">{member.todayMetrics.customers_visited}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs text-purple-600 font-medium">Score</span>
                </div>
                <p className="text-lg font-bold text-purple-900">{member.todayMetrics.performance_score}%</p>
              </div>
            </div>
          </div>
        )}

        {member.latestLocation && (
          <div className="border-t border-slate-100 pt-4 mt-4">
            <div className="flex items-start gap-2">
              <Navigation className="w-4 h-4 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-slate-600 mb-1">Latest Location</p>
                <p className="text-sm font-medium text-slate-900">
                  {member.latestLocation.address || 'Location tracked'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(member.latestLocation.recorded_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
