import React from 'react';
import {
  Building2,
  MapPin,
  Briefcase,
  Users,
  UserCheck,
  Package,
  Activity,
  Shield,
  Settings as SettingsIcon,
  FileText,
  ShieldCheck,
  Tag,
  Circle,
  AlertCircle,
  Flame,
  Timer,
} from 'lucide-react';

interface AdminSettingsProps {
  onNavigate: (view: string) => void;
  orgId?: string;
}

interface SettingsCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SettingsItem[];
}

interface SettingsItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
  color: string;
  bgColor: string;
}

export function AdminSettings({ onNavigate }: AdminSettingsProps) {
  const categories: SettingsCategory[] = [
    {
      id: 'organization',
      title: 'Organization Structure',
      description: 'Manage your organization hierarchy and locations',
      icon: Building2,
      items: [
        {
          id: 'regions',
          label: 'Territories',
          description: 'Manage regional territories and coverage areas',
          icon: MapPin,
          action: 'regions',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        },
        {
          id: 'branches',
          label: 'Sub-Territories',
          description: 'Configure branches and sub-territory locations',
          icon: Building2,
          action: 'branches',
          color: 'text-amber-600',
          bgColor: 'bg-amber-50'
        },
        {
          id: 'departments',
          label: 'Departments',
          description: 'Set up departments and organizational units',
          icon: Briefcase,
          action: 'departments',
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-50'
        }
      ]
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'Control access and manage team members',
      icon: Users,
      items: [
        {
          id: 'users',
          label: 'Users',
          description: 'Add, edit, and manage system users and their roles',
          icon: Users,
          action: 'users',
          color: 'text-slate-600',
          bgColor: 'bg-slate-50'
        },
        {
          id: 'customers',
          label: 'Customers',
          description: 'Manage field agents and customer profiles',
          icon: UserCheck,
          action: 'customers',
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        },
        {
          id: 'sessions',
          label: 'Session Monitor',
          description: 'Track active user sessions and activity',
          icon: Activity,
          action: 'sessions',
          color: 'text-rose-600',
          bgColor: 'bg-rose-50'
        },
        {
          id: 'session_config',
          label: 'Session & Security',
          description: 'Configure idle timeout, session limits, and lockout policies',
          icon: Timer,
          action: 'session_config',
          color: 'text-amber-600',
          bgColor: 'bg-amber-50'
        }
      ]
    },
    {
      id: 'system',
      title: 'System Configuration',
      description: 'Configure modules and system settings',
      icon: SettingsIcon,
      items: [
        {
          id: 'roles',
          label: 'Roles',
          description: 'Define and manage user roles and permissions',
          icon: ShieldCheck,
          action: 'roles',
          color: 'text-violet-600',
          bgColor: 'bg-violet-50'
        },
        {
          id: 'modules',
          label: 'Modules',
          description: 'Enable or disable feature modules for your organization',
          icon: Package,
          action: 'modules',
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50'
        },
        {
          id: 'forms_management',
          label: 'Forms Management',
          description: 'Create, edit, and manage forms for your organization',
          icon: FileText,
          action: 'forms_management',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        },
        {
          id: 'lead_statuses',
          label: 'Lead Statuses',
          description: 'Configure lead status workflow and lifecycle stages',
          icon: Tag,
          action: 'lead_statuses',
          color: 'text-cyan-600',
          bgColor: 'bg-cyan-50'
        },
        {
          id: 'lead_ranks',
          label: 'Lead Ranks',
          description: 'Configure lead temperature ranks (Hot, Mild, Cold) for prioritization',
          icon: Flame,
          action: 'lead_ranks',
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        },
        {
          id: 'issue_statuses',
          label: 'Issue Statuses',
          description: 'Configure issue status workflow and tracking stages',
          icon: Circle,
          action: 'issue_statuses',
          color: 'text-violet-600',
          bgColor: 'bg-violet-50'
        },
        {
          id: 'issue_categories',
          label: 'Issue Categories',
          description: 'Manage issue categories for organization and classification',
          icon: AlertCircle,
          action: 'issue_categories',
          color: 'text-teal-600',
          bgColor: 'bg-teal-50'
        }
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Settings</h1>
            <p className="text-slate-600 mt-1">Manage organization structure, users, and system configuration</p>
          </div>
        </div>
      </div>

      {/* Settings Categories */}
      <div className="space-y-8">
        {categories.map((category) => {
          const CategoryIcon = category.icon;

          return (
            <div key={category.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Category Header */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <CategoryIcon className="w-5 h-5 text-slate-700" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{category.title}</h2>
                    <p className="text-sm text-slate-600">{category.description}</p>
                  </div>
                </div>
              </div>

              {/* Category Items */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.items.map((item) => {
                    const ItemIcon = item.icon;

                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.action)}
                        className="group relative bg-white border-2 border-slate-200 rounded-xl p-6 hover:border-slate-300 hover:shadow-lg transition-all duration-200 text-left"
                      >
                        {/* Icon */}
                        <div className={`w-14 h-14 ${item.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                          <ItemIcon className={`w-7 h-7 ${item.color}`} />
                        </div>

                        {/* Content */}
                        <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-slate-700 transition-colors">
                          {item.label}
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {item.description}
                        </p>

                        {/* Arrow indicator */}
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className={`w-8 h-8 ${item.bgColor} rounded-lg flex items-center justify-center`}>
                            <svg className={`w-4 h-4 ${item.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="mt-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24" />

        <div className="relative">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2">Administrative Privileges</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                These settings are only accessible to administrators. Changes made here will affect your entire organization.
                Please exercise caution when modifying organization structure and user permissions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
