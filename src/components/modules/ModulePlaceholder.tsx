import { Package } from 'lucide-react';

interface ModulePlaceholderProps {
  moduleName: string;
  displayName: string;
}

export function ModulePlaceholder({ moduleName, displayName }: ModulePlaceholderProps) {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{displayName}</h1>
        <p className="text-slate-600">This module is currently in development</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#015324] to-[#016428] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Package className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">{displayName} Module</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            The {displayName} module is enabled for your organization.
            This feature is currently under development and will be available soon.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
            <span className="text-sm font-medium">Status: Coming Soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
