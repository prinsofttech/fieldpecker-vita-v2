import { supabase } from '../supabase/client';
import type { AuditLog } from '../supabase/types';

export interface AuditLogFilter {
  orgId: string;
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class AuditService {
  static async log(
    orgId: string,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    changes?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string; logId?: string }> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          org_id: orgId,
          user_id: userId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          changes: changes || {},
          ip_address: ipAddress || null,
          user_agent: userAgent || null,
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, logId: data.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async getLogs(filter: AuditLogFilter): Promise<{ data: AuditLog[]; count: number; error?: string }> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*, user:users(id, full_name, email)', { count: 'exact' })
        .eq('org_id', filter.orgId)
        .order('created_at', { ascending: false });

      if (filter.userId) {
        query = query.eq('user_id', filter.userId);
      }

      if (filter.action) {
        query = query.eq('action', filter.action);
      }

      if (filter.entityType) {
        query = query.eq('entity_type', filter.entityType);
      }

      if (filter.entityId) {
        query = query.eq('entity_id', filter.entityId);
      }

      if (filter.startDate) {
        query = query.gte('created_at', filter.startDate);
      }

      if (filter.endDate) {
        query = query.lte('created_at', filter.endDate);
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

  static async getRecentActivity(orgId: string, userId?: string, limit: number = 20): Promise<AuditLog[]> {
    const { data } = await this.getLogs({
      orgId,
      userId,
      limit,
    });

    return data;
  }

  static async getUserActions(orgId: string, userId: string, limit: number = 50): Promise<AuditLog[]> {
    const { data } = await this.getLogs({
      orgId,
      userId,
      limit,
    });

    return data;
  }

  static async getEntityHistory(
    orgId: string,
    entityType: string,
    entityId: string
  ): Promise<AuditLog[]> {
    const { data } = await this.getLogs({
      orgId,
      entityType,
      entityId,
      limit: 100,
    });

    return data;
  }

  static async getActionsByType(
    orgId: string,
    action: string,
    startDate?: string,
    endDate?: string
  ): Promise<AuditLog[]> {
    const { data } = await this.getLogs({
      orgId,
      action,
      startDate,
      endDate,
      limit: 1000,
    });

    return data;
  }

  static async exportAuditLogs(filter: AuditLogFilter): Promise<{ data: AuditLog[]; error?: string }> {
    const { data, error } = await this.getLogs({
      ...filter,
      limit: 10000,
    });

    if (error) {
      return { data: [], error };
    }

    return { data };
  }

  static formatAuditLogForDisplay(log: AuditLog): string {
    const timestamp = new Date(log.created_at).toLocaleString();
    const userName = log.user?.full_name || 'System';
    return `[${timestamp}] ${userName} - ${log.action} on ${log.entity_type}`;
  }
}
