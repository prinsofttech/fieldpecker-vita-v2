import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import {
  Package,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  TrendingUp,
  BarChart,
  Eye,
  Check,
  X,
  Loader2,
  Users,
  UserCheck,
  FileText,
  CreditCard,
  Truck,
  Folder,
  Calendar,
  Clock
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface Module {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  is_core: boolean;
}

interface OrgModule {
  id: string;
  org_id: string;
  module_id: string;
  is_enabled: boolean;
  settings: Record<string, any>;
  module?: Module;
}

interface ModulesManagerProps {
  orgId: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'alert-circle': AlertCircle,
  'trending-up': TrendingUp,
  'bar-chart': BarChart,
  'eye': Eye,
  'package': Package,
  'users': Users,
  'user-check': UserCheck,
  'file-text': FileText,
  'credit-card': CreditCard,
  'truck': Truck,
  'folder': Folder,
  'calendar': Calendar,
  'clock': Clock,
};

export function ModulesManager({ orgId }: ModulesManagerProps) {
  const { showSuccess, showError } = useToast();
  const [modules, setModules] = useState<Module[]>([]);
  const [orgModules, setOrgModules] = useState<OrgModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    setLoading(true);

    const [modulesRes, orgModulesRes] = await Promise.all([
      supabase
        .from('modules')
        .select('*')
        .order('display_name'),
      supabase
        .from('org_modules')
        .select('*, module:modules(*)')
        .eq('org_id', orgId),
    ]);

    if (modulesRes.data) {
      setModules(modulesRes.data);
    }

    if (orgModulesRes.data) {
      setOrgModules(orgModulesRes.data);
    }

    setLoading(false);
  };

  const isModuleEnabled = (moduleId: string): boolean => {
    const orgModule = orgModules.find(om => om.module_id === moduleId);
    return orgModule?.is_enabled || false;
  };

  const handleToggleModule = async (moduleId: string) => {
    setToggleLoading(moduleId);

    const existingOrgModule = orgModules.find(om => om.module_id === moduleId);
    const module = modules.find(m => m.id === moduleId);
    const isEnabling = !existingOrgModule?.is_enabled;

    try {
      if (existingOrgModule) {
        const { error } = await supabase
          .from('org_modules')
          .update({ is_enabled: !existingOrgModule.is_enabled })
          .eq('id', existingOrgModule.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('org_modules')
          .insert({
            org_id: orgId,
            module_id: moduleId,
            is_enabled: true,
            settings: {},
          });

        if (error) throw error;
      }

      await loadData();
      showSuccess(
        isEnabling ? 'Module Enabled' : 'Module Disabled',
        `${module?.display_name || 'Module'} has been ${isEnabling ? 'enabled' : 'disabled'} successfully`
      );
    } catch (error) {
      console.error('Error toggling module:', error);
      showError('Update Failed', 'Unable to update module. Please try again.');
    } finally {
      setToggleLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-[#015324] animate-spin" />
      </div>
    );
  }

  const enabledCount = modules.filter(m => isModuleEnabled(m.id)).length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Modules</h1>
            <p className="text-slate-600">
              Manage and configure modules for your organization
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600 mb-1">Enabled Modules</p>
            <p className="text-3xl font-bold text-[#015324]">
              {enabledCount} / {modules.length}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((module) => {
          const enabled = isModuleEnabled(module.id);
          const Icon = iconMap[module.icon] || Package;
          const isLoading = toggleLoading === module.id;

          return (
            <div
              key={module.id}
              className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                enabled
                  ? 'border-[#015324] shadow-lg'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-xl ${
                        enabled
                          ? 'bg-[#015324] text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">
                        {module.display_name}
                      </h3>
                      <p className="text-sm text-slate-600">{module.description}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {enabled ? (
                      <>
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">
                          Active
                        </span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-400">
                          Inactive
                        </span>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleModule(module.id)}
                    disabled={isLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      enabled
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-[#015324] text-white hover:bg-[#014a20]'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Processing...</span>
                      </>
                    ) : enabled ? (
                      <>
                        <ToggleRight className="w-4 h-4" />
                        <span className="text-sm">Disable</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-4 h-4" />
                        <span className="text-sm">Enable</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {enabled && (
                <div className="px-6 pb-6">
                  <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      This module is currently active and available to all users in your organization.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modules.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 text-lg">No modules available</p>
        </div>
      )}
    </div>
  );
}
