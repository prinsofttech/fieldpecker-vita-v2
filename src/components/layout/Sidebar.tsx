import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Building2,
  MapPin,
  Briefcase,
  Users,
  UserCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Settings,
  Bell,
  Plus,
  Edit2,
  Package,
  AlertCircle,
  TrendingUp,
  FileText,
  CreditCard,
  Folder,
  Truck,
  Calendar,
  BarChart,
  Clock,
  LucideIcon,
  Shield,
  Activity,
  Map,
  BarChart3
} from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import type { User } from '../../lib/supabase/types';

interface SidebarProps {
  user: User | null;
  currentView: string;
  onNavigate: (view: string) => void;
  mobileMenuOpen?: boolean;
  onCloseMobile?: () => void;
}

interface ActiveModule {
  name: string;
  display_name: string;
  icon: string;
}

export function Sidebar({ user, currentView, onNavigate, mobileMenuOpen = false, onCloseMobile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeModules, setActiveModules] = useState<ActiveModule[]>([]);
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 18 ? 'Good Afternoon' : 'Good Evening';

  useEffect(() => {
    if (user?.org_id) {
      loadActiveModules();
    }
  }, [user?.org_id]);

  const loadActiveModules = async () => {
    if (!user?.org_id) return;

    const { data } = await supabase
      .from('org_modules')
      .select('module_id, modules(name, display_name, icon)')
      .eq('org_id', user.org_id)
      .eq('is_enabled', true);

    if (data) {
      const modules = data.map((item: any) => ({
        name: item.modules.name,
        display_name: item.modules.display_name,
        icon: item.modules.icon,
      }));
      setActiveModules(modules);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const isClientAdmin = user?.role?.name === 'client_admin';

  const getIconForModule = (iconName: string): LucideIcon => {
    const iconMap: Record<string, LucideIcon> = {
      'users': Users,
      'user-check': UserCheck,
      'alert-circle': AlertCircle,
      'trending-up': TrendingUp,
      'file-text': FileText,
      'credit-card': CreditCard,
      'folder': Folder,
      'truck': Truck,
      'calendar': Calendar,
      'bar-chart': BarChart,
      'clock': Clock,
      'map': Map,
    };
    return iconMap[iconName] || FileText;
  };

  // Define the desired module order
  const moduleOrder = [
    'my_team',
    'check_in',
    'forms',
    'issue_tracker',
    'leads',
    'reports',
    'analytics',
    'heat_map',
    'last_mile_delivery',
  ];

  // Sort modules according to the defined order
  const sortedModules = [...activeModules].sort((a, b) => {
    const indexA = moduleOrder.indexOf(a.name);
    const indexB = moduleOrder.indexOf(b.name);
    const orderA = indexA === -1 ? 999 : indexA;
    const orderB = indexB === -1 ? 999 : indexB;
    return orderA - orderB;
  });

  // Build navigation items in the specified order
  const navigationItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    ...sortedModules.map(module => ({
      id: module.name,
      label: module.display_name,
      icon: getIconForModule(module.icon),
    })),
  ];

  // Add Settings item only for client_admin
  if (isClientAdmin) {
    navigationItems.push({
      id: 'admin_settings',
      label: 'Settings',
      icon: Settings,
    });
  }

  return (
    <div
      className={`bg-gradient-to-b from-slate-50 to-white border-r border-slate-200 flex flex-col transition-all duration-300 shadow-sm w-80 lg:w-auto ${
        collapsed ? 'lg:w-20' : 'lg:w-80'
      } fixed lg:relative inset-y-0 left-0 z-50 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Header Section with User Profile */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img
                src="/fieldpecker-logo-app-landing-page.png"
                alt="FieldPecker"
                className="h-20 w-auto object-contain"
                
                
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2 hover:bg-white rounded-lg transition-all shadow-sm border border-slate-200"
              title="Close menu"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            {/* Desktop collapse button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:block p-2 hover:bg-white rounded-lg transition-all shadow-sm border border-slate-200"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4 text-slate-600" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>
        </div>

        {/* User Greeting Card */}
        {!collapsed && user && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 bg-gradient-to-br from-[#015324] to-[#016428] rounded-full flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl">
                  {user.full_name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-1">{greeting} 👋</p>
                <p className="font-bold text-slate-900 truncate text-lg">
                  {user.full_name?.split(' ')[0]}
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-600 mb-1">Organization</p>
                  <p className="text-sm text-slate-900 truncate font-medium">
                    {user.organization?.name || 'Not assigned'}
                  </p>
                </div>
                {user.organization?.logo_url && (
                  <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                    <img
                      src={user.organization.logo_url}
                      alt={`${user.organization.name} logo`}
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {collapsed && user && (
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-[#015324] to-[#016428] rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">
                {user.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Navigation Section */}
      <div className="flex-1 px-4 overflow-y-auto">
        {!collapsed && (
          <div className="flex items-center justify-between px-3 mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Menu: {navigationItems.length}
            </p>
            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
          </div>
        )}

        <nav className="space-y-1.5">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#015324] to-[#016428] text-white shadow-lg shadow-green-900/20 scale-[1.02]'
                    : 'text-slate-700 hover:bg-white hover:shadow-sm hover:scale-[1.01]'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : ''}
              >
                <Icon className={`flex-shrink-0 ${collapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
                {!collapsed && (
                  <span className="font-semibold truncate text-[15px]">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

      </div>

      {/* Logout Section */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Logout' : ''}
        >
          <LogOut className={`flex-shrink-0 ${collapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
          {!collapsed && (
            <span className="font-medium truncate text-[15px]">Logout</span>
          )}
        </button>
      </div>
    </div>
  );
}
