import { supabase } from '../supabase/client';
import type { User, RoleName } from '../supabase/types';

export interface UserFilter {
  orgId: string;
  roleId?: string;
  roleName?: RoleName;
  status?: 'active' | 'inactive' | 'locked';
  parentUserId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class UserService {
  static async getUsers(filter: UserFilter): Promise<{ data: User[]; count: number; error?: string }> {
    try {
      let query = supabase
        .from('users')
        .select('*, role:roles(*), organization:organizations(*), parent_user:users!parent_user_id(id, full_name, email)', { count: 'exact' })
        .eq('org_id', filter.orgId)
        .order('created_at', { ascending: false });

      if (filter.roleId) {
        query = query.eq('role_id', filter.roleId);
      }

      if (filter.roleName) {
        query = query.eq('role.name', filter.roleName);
      }

      if (filter.status) {
        query = query.eq('status', filter.status);
      }

      if (filter.parentUserId) {
        query = query.eq('parent_user_id', filter.parentUserId);
      }

      if (filter.search) {
        query = query.or(`full_name.ilike.%${filter.search}%,email.ilike.%${filter.search}%`);
      }

      if (filter.limit) {
        query = query.limit(filter.limit);
      }

      if (filter.offset) {
        query = query.range(filter.offset, filter.offset + (filter.limit || 10) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        return { data: [], count: 0, error: error.message };
      }

      return { data: data || [], count: count || 0 };
    } catch (error) {
      return {
        data: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async getUserById(userId: string): Promise<{ data?: User; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, role:roles(*), organization:organizations(*), parent_user:users!parent_user_id(id, full_name, email)')
        .eq('id', userId)
        .single();

      if (error) {
        return { error: error.message };
      }

      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async getUsersByRole(orgId: string, roleName: RoleName): Promise<User[]> {
    const { data } = await this.getUsers({ orgId, roleName });
    return data;
  }

  static async getSubordinates(userId: string): Promise<User[]> {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', userId)
        .single();

      if (!user) return [];

      const { data } = await this.getUsers({
        orgId: user.org_id,
        parentUserId: userId,
      });

      return data;
    } catch {
      return [];
    }
  }

  static async getAllSubordinates(userId: string): Promise<User[]> {
    const directSubordinates = await this.getSubordinates(userId);
    const allSubordinates: User[] = [...directSubordinates];

    for (const subordinate of directSubordinates) {
      const nestedSubordinates = await this.getAllSubordinates(subordinate.id);
      allSubordinates.push(...nestedSubordinates);
    }

    return allSubordinates;
  }

  static async canManageUser(managerId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('user_can_manage', {
        p_manager_id: managerId,
        p_user_id: userId,
      });

      if (error) return false;

      return data || false;
    } catch {
      return false;
    }
  }

  static async updateUser(
    userId: string,
    updates: Partial<User>,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string; data?: User }> {
    try {
      const canManage = await this.canManageUser(updatedBy, userId);
      if (!canManage && updatedBy !== userId) {
        return { success: false, error: 'You do not have permission to update this user' };
      }

      const { data: currentUser } = await this.getUserById(userId);
      if (!currentUser) {
        return { success: false, error: 'User not found' };
      }

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select('*, role:roles(*), organization:organizations(*)')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      await supabase.from('audit_logs').insert({
        org_id: currentUser.org_id,
        user_id: updatedBy,
        action: 'user_updated',
        entity_type: 'users',
        entity_id: userId,
        changes: { updates },
      });

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async deactivateUser(
    userId: string,
    deactivatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateUser(userId, { status: 'inactive' }, deactivatedBy);
  }

  static async activateUser(
    userId: string,
    activatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateUser(userId, { status: 'active' }, activatedBy);
  }

  static async unlockUser(
    userId: string,
    unlockedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateUser(
      userId,
      { status: 'active', failed_login_attempts: 0, locked_until: null },
      unlockedBy
    );
  }

  static async updateUserRole(
    userId: string,
    roleId: string,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateUser(userId, { role_id: roleId }, updatedBy);
  }

  static async getUserHierarchy(userId: string): Promise<User[]> {
    const hierarchy: User[] = [];
    let currentUserId: string | null = userId;

    while (currentUserId) {
      const { data: user } = await this.getUserById(currentUserId);
      if (!user) break;

      hierarchy.unshift(user);
      currentUserId = user.parent_user_id;
    }

    return hierarchy;
  }

  static async getTeamStructure(userId: string): Promise<{ user: User; subordinates: any[] }> {
    const { data: user } = await this.getUserById(userId);
    if (!user) {
      return { user: {} as User, subordinates: [] };
    }

    const subordinates = await this.getSubordinates(userId);
    const subordinatesWithTeams = await Promise.all(
      subordinates.map(async (sub) => ({
        ...sub,
        team: await this.getTeamStructure(sub.id),
      }))
    );

    return { user, subordinates: subordinatesWithTeams };
  }

  static async deleteUser(
    userId: string,
    deletedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: currentUser } = await this.getUserById(userId);
      if (!currentUser) {
        return { success: false, error: 'User not found' };
      }

      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user) {
        return { success: false, error: 'Not authenticated' };
      }

      if (userId === authUser.user.id) {
        return { success: false, error: 'You cannot delete your own account' };
      }

      const subordinates = await this.getSubordinates(userId);
      if (subordinates.length > 0) {
        return {
          success: false,
          error: `Cannot delete user with ${subordinates.length} subordinate(s). Please reassign them first.`
        };
      }

      await supabase.from('audit_logs').insert({
        org_id: currentUser.org_id,
        user_id: deletedBy,
        action: 'user_deleted',
        entity_type: 'users',
        entity_id: userId,
        changes: { deleted_user: currentUser.email },
      });

      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteError) {
        console.error('Database delete error:', deleteError);
        return { success: false, error: `Failed to delete user: ${deleteError.message}` };
      }

      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (authError: any) {
        console.error('Failed to delete auth user:', authError);
      }

      return { success: true };
    } catch (error) {
      console.error('Delete user error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while deleting user',
      };
    }
  }
}
