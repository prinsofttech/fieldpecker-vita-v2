import { supabase } from '../supabase/client';
import type {
  Issue,
  IssueCategory,
  IssueComment,
  IssueHistory,
  IssueCustomStatus,
  StatusChangeComment,
  CreateIssueData,
  UpdateIssueData,
  StatusChangeData,
  IssueFilters,
  IssueStats,
  IssueWithDetails
} from './types';

export class IssueService {
  static async createIssue(orgId: string, data: CreateIssueData): Promise<Issue | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!data.action_taken || data.action_taken.trim() === '') {
        throw new Error('Action Taken is required');
      }

      const { data: defaultStatus } = await supabase
        .from('issue_statuses')
        .select('id')
        .eq('org_id', orgId)
        .eq('is_default', true)
        .maybeSingle();

      const issueData: any = {
        org_id: orgId,
        reported_by: user.id,
        title: data.title,
        description: data.description || null,
        category_id: data.category_id || null,
        priority: data.priority || 'medium',
        customer_id: data.customer_id || null,
        due_date: data.due_date || null,
        tags: data.tags || null,
        action_taken: data.action_taken,
        status_id: defaultStatus?.id || null,
        last_modified_by: user.id,
        last_modified_at: new Date().toISOString()
      };

      if (data.assigned_to) {
        issueData.assigned_to = data.assigned_to;
        issueData.assigned_by = user.id;
        issueData.assigned_at = new Date().toISOString();
        issueData.status = 'assigned';

        const { data: assignedStatus } = await supabase
          .from('issue_statuses')
          .select('id')
          .eq('org_id', orgId)
          .eq('name', 'assigned')
          .maybeSingle();

        if (assignedStatus) {
          issueData.status_id = assignedStatus.id;
        }
      }

      const { data: issue, error } = await supabase
        .from('issues')
        .insert(issueData)
        .select()
        .single();

      if (error) throw error;
      return issue;
    } catch (error) {
      console.error('Error creating issue:', error);
      throw error;
    }
  }

  static async updateIssue(issueId: string, data: UpdateIssueData): Promise<Issue | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updateData: any = {
        ...data,
        last_modified_by: user.id,
        last_modified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (data.assigned_to) {
        updateData.assigned_by = user.id;
        updateData.assigned_at = new Date().toISOString();
      }

      if (data.status === 'resolved') {
        updateData.resolved_by = user.id;
        updateData.resolved_at = new Date().toISOString();
      }

      if (data.status === 'closed') {
        updateData.closed_by = user.id;
        updateData.closed_at = new Date().toISOString();
      }

      const { data: issue, error } = await supabase
        .from('issues')
        .update(updateData)
        .eq('id', issueId)
        .select()
        .single();

      if (error) throw error;
      return issue;
    } catch (error) {
      console.error('Error updating issue:', error);
      throw error;
    }
  }

  static async changeStatus(issueId: string, statusData: StatusChangeData): Promise<Issue | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!statusData.comment || statusData.comment.trim() === '') {
        throw new Error('Comment is required when changing status');
      }

      const { data: currentIssue } = await supabase
        .from('issues')
        .select('status')
        .eq('id', issueId)
        .single();

      if (!currentIssue) throw new Error('Issue not found');

      const { error: commentError } = await supabase
        .from('status_change_comments')
        .insert({
          issue_id: issueId,
          old_status: currentIssue.status,
          new_status: statusData.newStatus,
          comment: statusData.comment,
          changed_by: user.id
        });

      if (commentError) throw commentError;

      const updateData: any = {
        status: statusData.newStatus,
        last_modified_by: user.id,
        last_modified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (statusData.statusId) {
        updateData.status_id = statusData.statusId;
      }

      if (statusData.newStatus === 'resolved') {
        updateData.resolved_by = user.id;
        updateData.resolved_at = new Date().toISOString();
      }

      if (statusData.newStatus === 'closed') {
        updateData.closed_by = user.id;
        updateData.closed_at = new Date().toISOString();
      }

      const { data: issue, error } = await supabase
        .from('issues')
        .update(updateData)
        .eq('id', issueId)
        .select()
        .single();

      if (error) throw error;
      return issue;
    } catch (error) {
      console.error('Error changing status:', error);
      throw error;
    }
  }

  static async getIssue(issueId: string): Promise<Issue | null> {
    try {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .eq('id', issueId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching issue:', error);
      return null;
    }
  }

  static async getIssueWithDetails(issueId: string): Promise<IssueWithDetails | null> {
    try {
      const { data, error } = await supabase
        .from('issues')
        .select(`
          *,
          category:issue_categories(*),
          custom_status:issue_statuses!issues_status_id_fkey(*),
          assignee:users!issues_assigned_to_fkey(id, full_name, email),
          reporter:users!issues_reported_by_fkey(id, full_name, email),
          last_modifier:users!issues_last_modified_by_fkey(id, full_name, email),
          customer:customers(id, customer_name)
        `)
        .eq('id', issueId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching issue with details:', error);
      return null;
    }
  }

  static async listIssues(orgId: string, filters?: IssueFilters): Promise<Issue[]> {
    try {
      let query = supabase
        .from('issues')
        .select('*, customers!issues_customer_id_fkey(region_id, branch_id)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.priority && filters.priority.length > 0) {
        query = query.in('priority', filters.priority);
      }

      if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }

      if (filters?.reported_by) {
        query = query.eq('reported_by', filters.reported_by);
      }

      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id);
      }

      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }

      if (filters?.status_id) {
        query = query.eq('status_id', filters.status_id);
      }

      if (filters?.start_date) {
        const tzOffset = new Date().getTimezoneOffset();
        const tzSign = tzOffset <= 0 ? '+' : '-';
        const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
        const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
        const tz = `${tzSign}${tzHours}:${tzMins}`;
        query = query.gte('created_at', `${filters.start_date}T00:00:00${tz}`);
        if (filters?.end_date) {
          query = query.lte('created_at', `${filters.end_date}T23:59:59${tz}`);
        }
      } else if (filters?.end_date) {
        const tzOffset = new Date().getTimezoneOffset();
        const tzSign = tzOffset <= 0 ? '+' : '-';
        const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
        const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
        const tz = `${tzSign}${tzHours}:${tzMins}`;
        query = query.lte('created_at', `${filters.end_date}T23:59:59${tz}`);
      }

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,issue_number.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];

      if (filters?.region_id) {
        filteredData = filteredData.filter((issue: any) =>
          issue.customers?.region_id === filters.region_id
        );
      }

      if (filters?.branch_id) {
        filteredData = filteredData.filter((issue: any) =>
          issue.customers?.branch_id === filters.branch_id
        );
      }

      return filteredData.map((issue: any) => {
        const { customers, ...rest } = issue;
        return rest;
      });
    } catch (error) {
      console.error('Error listing issues:', error);
      return [];
    }
  }

  static async listIssuesWithDetails(orgId: string, filters?: IssueFilters): Promise<IssueWithDetails[]> {
    try {
      let query = supabase
        .from('issues')
        .select(`
          *,
          category:issue_categories(*),
          custom_status:issue_statuses!issues_status_id_fkey(*),
          assignee:users!issues_assigned_to_fkey(id, full_name, email),
          reporter:users!issues_reported_by_fkey(id, full_name, email),
          last_modifier:users!issues_last_modified_by_fkey(id, full_name, email),
          customer:customers(id, customer_name)
        `)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.priority && filters.priority.length > 0) {
        query = query.in('priority', filters.priority);
      }

      if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }

      if (filters?.reported_by) {
        query = query.eq('reported_by', filters.reported_by);
      }

      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id);
      }

      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,issue_number.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error listing issues:', error);
      return [];
    }
  }

  static async deleteIssue(issueId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('issues')
        .delete()
        .eq('id', issueId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting issue:', error);
      return false;
    }
  }

  static async getIssueStats(orgId: string): Promise<IssueStats> {
    try {
      const issues = await this.listIssues(orgId);

      const stats: IssueStats = {
        total: issues.length,
        new: 0,
        assigned: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
        on_hold: 0,
        by_priority: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        }
      };

      issues.forEach(issue => {
        stats[issue.status]++;
        stats.by_priority[issue.priority]++;
      });

      return stats;
    } catch (error) {
      console.error('Error fetching issue stats:', error);
      return {
        total: 0,
        new: 0,
        assigned: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
        on_hold: 0,
        by_priority: { low: 0, medium: 0, high: 0, critical: 0 }
      };
    }
  }

  static async addComment(issueId: string, commentText: string, isInternal: boolean = false, isWorkNote: boolean = true): Promise<IssueComment | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('issue_comments')
        .insert({
          issue_id: issueId,
          user_id: user.id,
          comment_text: commentText,
          is_internal: isInternal,
          is_work_note: isWorkNote
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  static async getComments(issueId: string): Promise<IssueComment[]> {
    try {
      const { data, error } = await supabase
        .from('issue_comments')
        .select(`
          *,
          user:users(full_name, email)
        `)
        .eq('issue_id', issueId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }

  static async getHistory(issueId: string): Promise<IssueHistory[]> {
    try {
      const { data, error } = await supabase
        .from('issue_history')
        .select(`
          *,
          user:users!issue_history_changed_by_fkey(full_name, email)
        `)
        .eq('issue_id', issueId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching history:', error);
      return [];
    }
  }

  static async getStatusChangeComments(issueId: string): Promise<StatusChangeComment[]> {
    try {
      const { data, error } = await supabase
        .from('status_change_comments')
        .select(`
          *,
          user:users!status_change_comments_changed_by_fkey(full_name, email)
        `)
        .eq('issue_id', issueId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching status change comments:', error);
      return [];
    }
  }

  static async getCategories(orgId: string): Promise<IssueCategory[]> {
    try {
      const { data, error } = await supabase
        .from('issue_categories')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  static async createCategory(orgId: string, name: string, description: string, color: string, icon: string): Promise<IssueCategory | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('issue_categories')
        .insert({
          org_id: orgId,
          name,
          description,
          color,
          icon,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  static async updateCategory(
    categoryId: string,
    data: { name?: string; description?: string; color?: string; icon?: string; is_active?: boolean }
  ): Promise<IssueCategory | null> {
    try {
      const { data: category, error } = await supabase
        .from('issue_categories')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', categoryId)
        .select()
        .single();

      if (error) throw error;
      return category;
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  static async deleteCategory(categoryId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('issue_categories')
        .update({ is_active: false })
        .eq('id', categoryId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      return false;
    }
  }

  static async getCustomStatuses(orgId: string): Promise<IssueCustomStatus[]> {
    try {
      const { data, error } = await supabase
        .from('issue_statuses')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching custom statuses:', error);
      return [];
    }
  }

  static async createCustomStatus(
    orgId: string,
    data: { name: string; display_name: string; color: string; icon: string; sort_order: number; description?: string; is_closed?: boolean }
  ): Promise<IssueCustomStatus | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: status, error } = await supabase
        .from('issue_statuses')
        .insert({
          org_id: orgId,
          name: data.name.toLowerCase().replace(/\s+/g, '_'),
          display_name: data.display_name,
          color: data.color,
          icon: data.icon,
          sort_order: data.sort_order,
          description: data.description || null,
          is_closed: data.is_closed || false,
          is_system: false,
          is_default: false,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return status;
    } catch (error) {
      console.error('Error creating custom status:', error);
      throw error;
    }
  }

  static async updateCustomStatus(
    statusId: string,
    data: { display_name?: string; color?: string; icon?: string; sort_order?: number; description?: string; is_active?: boolean; is_closed?: boolean }
  ): Promise<IssueCustomStatus | null> {
    try {
      const { data: status, error } = await supabase
        .from('issue_statuses')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', statusId)
        .eq('is_system', false)
        .select()
        .single();

      if (error) throw error;
      return status;
    } catch (error) {
      console.error('Error updating custom status:', error);
      throw error;
    }
  }

  static async deleteCustomStatus(statusId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('issue_statuses')
        .update({ is_active: false })
        .eq('id', statusId)
        .eq('is_system', false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting custom status:', error);
      return false;
    }
  }
}
