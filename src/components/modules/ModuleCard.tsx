import { Eye, AlertCircle, TrendingUp, BarChart, Settings, Map } from 'lucide-react';
import type { OrgModule } from '../../lib/supabase/types';

interface ModuleCardProps {
  orgModule: OrgModule;
  onToggle: (moduleId: string, enabled: boolean) => void;
  onConfigure: (moduleId: string) => void;
  isAdmin: boolean;
}

const iconMap = {
  eye: Eye,
  'alert-circle': AlertCircle,
  'trending-up': TrendingUp,
  'bar-chart': BarChart,
  map: Map,
};

export function ModuleCard({ orgModule, onToggle, onConfigure, isAdmin }: ModuleCardProps) {
  const Icon = orgModule.module?.icon ? iconMap[orgModule.module.icon as keyof typeof iconMap] || Settings : Settings;

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border-2 transition-all hover:shadow-md ${
        orgModule.is_enabled ? 'border-emerald-200' : 'border-slate-200'
      }`}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`p-3 rounded-lg ${
              orgModule.is_enabled ? 'bg-emerald-100' : 'bg-slate-100'
            }`}
          >
            <Icon
              className={`w-6 h-6 ${
                orgModule.is_enabled ? 'text-emerald-600' : 'text-slate-400'
              }`}
            />
          </div>

          {isAdmin && (
            <button
              onClick={() => onToggle(orgModule.id, !orgModule.is_enabled)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                orgModule.is_enabled
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {orgModule.is_enabled ? 'Enabled' : 'Disabled'}
            </button>
          )}
        </div>

        <h3 className="text-xl font-bold text-slate-800 mb-2">
          {orgModule.module?.display_name}
        </h3>

        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          {orgModule.module?.description}
        </p>

        {orgModule.is_enabled && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Active since {new Date(orgModule.enabled_at).toLocaleDateString()}
            </span>

            {isAdmin && (
              <button
                onClick={() => onConfigure(orgModule.id)}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
              >
                <Settings className="w-4 h-4" />
                Configure
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
