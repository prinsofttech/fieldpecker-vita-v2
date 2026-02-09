import { supabase } from '../supabase/client';
import type { Module, OrgModule, ModuleName } from '../supabase/types';

export interface ModuleAccessCheck {
  hasAccess: boolean;
  module?: OrgModule;
  error?: string;
}

export class ModuleService {
  static async getAvailableModules(): Promise<{ data: Module[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .order('name');

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: data || [] };
    } catch (error) {
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async getOrgModules(orgId: string): Promise<{ data: OrgModule[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('org_modules')
        .select('*, module:modules(*)')
        .eq('org_id', orgId)
        .order('module(name)');

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: data || [] };
    } catch (error) {
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async getEnabledModules(orgId: string): Promise<{ data: OrgModule[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('org_modules')
        .select('*, module:modules(*)')
        .eq('org_id', orgId)
        .eq('is_enabled', true)
        .order('module(name)');

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: data || [] };
    } catch (error) {
      return {
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async checkModuleAccess(userId: string, moduleName: ModuleName): Promise<ModuleAccessCheck> {
    try {
      const { data: hasAccess, error } = await supabase
        .rpc('user_has_module_access', {
          p_user_id: userId,
          p_module_name: moduleName,
        });

      if (error) {
        return { hasAccess: false, error: error.message };
      }

      if (!hasAccess) {
        return { hasAccess: false };
      }

      const { data: user } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', userId)
        .single();

      if (!user) {
        return { hasAccess: false, error: 'User not found' };
      }

      const { data: orgModule } = await supabase
        .from('org_modules')
        .select('*, module:modules(*)')
        .eq('org_id', user.org_id)
        .eq('module.name', moduleName)
        .eq('is_enabled', true)
        .single();

      return { hasAccess: true, module: orgModule || undefined };
    } catch (error) {
      return {
        hasAccess: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async enableModule(
    orgId: string,
    moduleName: ModuleName,
    enabledBy: string,
    settings?: Record<string, any>
  ): Promise<{ success: boolean; error?: string; module?: OrgModule }> {
    try {
      const { data: module } = await supabase
        .from('modules')
        .select('id')
        .eq('name', moduleName)
        .single();

      if (!module) {
        return { success: false, error: 'Module not found' };
      }

      const { data, error } = await supabase
        .from('org_modules')
        .upsert(
          {
            org_id: orgId,
            module_id: module.id,
            is_enabled: true,
            settings: settings || {},
            enabled_by: enabledBy,
            enabled_at: new Date().toISOString(),
          },
          { onConflict: 'org_id,module_id' }
        )
        .select('*, module:modules(*)')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      await supabase.from('audit_logs').insert({
        org_id: orgId,
        user_id: enabledBy,
        action: 'module_enabled',
        entity_type: 'org_modules',
        entity_id: data.id,
        changes: { module_name: moduleName, settings },
      });

      return { success: true, module: data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async disableModule(
    orgId: string,
    moduleName: ModuleName,
    disabledBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: module } = await supabase
        .from('modules')
        .select('id, is_core')
        .eq('name', moduleName)
        .single();

      if (!module) {
        return { success: false, error: 'Module not found' };
      }

      if (module.is_core) {
        return { success: false, error: 'Cannot disable core module' };
      }

      const { error } = await supabase
        .from('org_modules')
        .update({ is_enabled: false })
        .eq('org_id', orgId)
        .eq('module_id', module.id);

      if (error) {
        return { success: false, error: error.message };
      }

      await supabase.from('audit_logs').insert({
        org_id: orgId,
        user_id: disabledBy,
        action: 'module_disabled',
        entity_type: 'org_modules',
        entity_id: module.id,
        changes: { module_name: moduleName },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async updateModuleSettings(
    orgId: string,
    moduleName: ModuleName,
    settings: Record<string, any>,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: module } = await supabase
        .from('modules')
        .select('id')
        .eq('name', moduleName)
        .single();

      if (!module) {
        return { success: false, error: 'Module not found' };
      }

      const { error } = await supabase
        .from('org_modules')
        .update({ settings })
        .eq('org_id', orgId)
        .eq('module_id', module.id);

      if (error) {
        return { success: false, error: error.message };
      }

      await supabase.from('audit_logs').insert({
        org_id: orgId,
        user_id: updatedBy,
        action: 'module_settings_updated',
        entity_type: 'org_modules',
        entity_id: module.id,
        changes: { module_name: moduleName, new_settings: settings },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async getModuleSettings(
    orgId: string,
    moduleName: ModuleName
  ): Promise<{ settings?: Record<string, any>; error?: string }> {
    try {
      const { data } = await supabase
        .from('org_modules')
        .select('settings, module:modules(name)')
        .eq('org_id', orgId)
        .eq('module.name', moduleName)
        .eq('is_enabled', true)
        .single();

      if (!data) {
        return { error: 'Module not found or not enabled' };
      }

      return { settings: data.settings };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
