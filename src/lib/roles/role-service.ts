import { supabase } from '../supabase/client';

export interface Role {
  id: string;
  name: string;
  display_name: string;
  level: number;
  permissions: Record<string, any>;
  description: string | null;
  created_at: string;
}

export interface CreateRoleData {
  name: string;
  display_name: string;
  level: number;
  description?: string;
  permissions?: Record<string, any>;
}

export interface UpdateRoleData {
  display_name?: string;
  level?: number;
  description?: string;
  permissions?: Record<string, any>;
}

export class RoleService {
  static async getAllRoles(): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('level', { ascending: true });

    if (error) {
      throw new Error('Failed to fetch roles: ' + error.message);
    }

    return data || [];
  }

  static async createRole(roleData: CreateRoleData): Promise<Role> {
    const { data, error } = await supabase
      .from('roles')
      .insert([{
        name: roleData.name.toLowerCase().replace(/\s+/g, '_'),
        display_name: roleData.display_name,
        level: roleData.level,
        description: roleData.description || null,
        permissions: roleData.permissions || {}
      }])
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create role: ' + error.message);
    }

    return data;
  }

  static async updateRole(roleId: string, updates: UpdateRoleData): Promise<Role> {
    const { data, error } = await supabase
      .from('roles')
      .update(updates)
      .eq('id', roleId)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update role: ' + error.message);
    }

    return data;
  }

  static async deleteRole(roleId: string): Promise<void> {
    const usersCount = await this.getRoleUsersCount(roleId);

    if (usersCount > 0) {
      throw new Error(`Cannot delete role: ${usersCount} user(s) are assigned to this role`);
    }

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId);

    if (error) {
      throw new Error('Failed to delete role: ' + error.message);
    }
  }

  static async getRoleUsersCount(roleId: string): Promise<number> {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', roleId);

    if (error) {
      throw new Error('Failed to count role users: ' + error.message);
    }

    return count || 0;
  }

  static async checkRoleNameExists(name: string, excludeId?: string): Promise<boolean> {
    let query = supabase
      .from('roles')
      .select('id')
      .eq('name', name.toLowerCase().replace(/\s+/g, '_'));

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error('Failed to check role name: ' + error.message);
    }

    return (data?.length || 0) > 0;
  }
}
