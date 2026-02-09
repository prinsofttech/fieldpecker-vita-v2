import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';

interface CreateOrganizationModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateOrganizationModal({ onClose, onSuccess }: CreateOrganizationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    subscription_tier: 'basic',
    status: 'active',
    max_users: 10,
    max_customers: 5,
    max_modules: 5,
  });

  const handleTierChange = (tier: string) => {
    let maxUsers = 10;
    let maxCustomers = 5;
    let maxModules = 5;

    if (tier === 'professional') {
      maxUsers = 50;
      maxCustomers = 25;
      maxModules = 15;
    } else if (tier === 'enterprise') {
      maxUsers = 999;
      maxCustomers = 999;
      maxModules = 999;
    }

    setFormData({
      ...formData,
      subscription_tier: tier,
      max_users: maxUsers,
      max_customers: maxCustomers,
      max_modules: maxModules,
    });
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const { error: createError } = await supabase
        .from('organizations')
        .insert({
          name: formData.name,
          slug,
          subscription_tier: formData.subscription_tier,
          status: formData.status,
          max_users: formData.max_users,
          max_customers: formData.max_customers,
          max_modules: formData.max_modules,
          total_users: 0,
          total_customers: 0,
          enabled_modules_count: 0,
          settings: {},
        });

      if (createError) throw createError;

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Create New Organization</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
              placeholder="Enter organization name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Subscription Tier
            </label>
            <select
              value={formData.subscription_tier}
              onChange={(e) => handleTierChange(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
            >
              <option value="basic">Basic (10 users, 5 customers, 5 modules)</option>
              <option value="professional">Professional (50 users, 25 customers, 15 modules)</option>
              <option value="enterprise">Enterprise (Unlimited)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Organization Limits</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Max Users
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.max_users}
                  onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Max Customers
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.max_customers}
                  onChange={(e) => setFormData({ ...formData, max_customers: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Max Modules
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.max_modules}
                  onChange={(e) => setFormData({ ...formData, max_modules: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#015324] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[#015324] text-white rounded-lg hover:bg-[#014a20] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
