import { supabase } from '../supabase/client';
import type {
  Lead,
  LeadWithDetails,
  CreateLeadData,
  UpdateLeadData,
  LeadFilters,
  LeadFormTemplate,
  LeadFormField,
  LeadStats,
  LeadStatusHistory,
  LeadAssignment,
  LeadStatus,
  LeadRank,
  LeadStatusRecord
} from './types';

export class LeadService {
  static async listLeads(
    orgId: string,
    filters?: LeadFilters,
    sortBy: string = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<LeadWithDetails[]> {
    let query = supabase
      .from('leads')
      .select(`
        *,
        template:lead_form_templates(*),
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email),
        created_by_user:users!leads_created_by_fkey(id, full_name),
        region:regions!leads_region_id_fkey(id, name),
        branch:branches(id, name),
        territory:regions!leads_territory_id_fkey(id, name, code),
        sub_territory:regions!leads_sub_territory_id_fkey(id, name, code),
        rank:lead_ranks(*)
      `)
      .eq('org_id', orgId);

    if (filters?.rank_id) {
      query = query.eq('rank_id', filters.rank_id);
    }

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters?.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }

    if (filters?.created_by) {
      query = query.eq('created_by', filters.created_by);
    }

    if (filters?.region_id) {
      query = query.eq('region_id', filters.region_id);
    }

    if (filters?.branch_id) {
      query = query.eq('branch_id', filters.branch_id);
    }

    if (filters?.source) {
      query = query.eq('source', filters.source);
    }

    if (filters?.score_min !== undefined) {
      query = query.gte('score', filters.score_min);
    }

    if (filters?.score_max !== undefined) {
      query = query.lte('score', filters.score_max);
    }

    if (filters?.start_date || filters?.end_date) {
      const tzOffset = new Date().getTimezoneOffset();
      const tzSign = tzOffset <= 0 ? '+' : '-';
      const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
      const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
      const tz = `${tzSign}${tzHours}:${tzMins}`;

      if (filters?.start_date) {
        query = query.gte('created_at', `${filters.start_date}T00:00:00${tz}`);
      }
      if (filters?.end_date) {
        query = query.lte('created_at', `${filters.end_date}T23:59:59${tz}`);
      }
    }

    if (filters?.search) {
      query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,company.ilike.%${filters.search}%`);
    }

    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  static async getLead(leadId: string): Promise<LeadWithDetails | null> {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        template:lead_form_templates(*),
        assigned_user:users!leads_assigned_to_fkey(id, full_name, email),
        created_by_user:users!leads_created_by_fkey(id, full_name),
        region:regions(id, name),
        branch:branches(id, name),
        rank:lead_ranks(*)
      `)
      .eq('id', leadId)
      .single();

    if (error) throw error;
    return data;
  }

  static async createLead(leadData: CreateLeadData): Promise<Lead> {
    const { field_values, ...leadInfo } = leadData;

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        ...leadInfo,
        created_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();

    if (leadError) throw leadError;

    if (field_values && field_values.length > 0) {
      const fieldValuesToInsert = field_values.map(fv => ({
        lead_id: lead.id,
        field_id: fv.field_id,
        field_value: fv.field_value
      }));

      const { error: fieldError } = await supabase
        .from('lead_field_values')
        .insert(fieldValuesToInsert);

      if (fieldError) throw fieldError;
    }

    return lead;
  }

  static async updateLead(leadId: string, leadData: UpdateLeadData): Promise<Lead> {
    const { field_values, ...leadInfo } = leadData;

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .update(leadInfo)
      .eq('id', leadId)
      .select()
      .single();

    if (leadError) throw leadError;

    if (field_values && field_values.length > 0) {
      for (const fv of field_values) {
        await supabase
          .from('lead_field_values')
          .upsert({
            lead_id: leadId,
            field_id: fv.field_id,
            field_value: fv.field_value
          }, {
            onConflict: 'lead_id,field_id'
          });
      }
    }

    return lead;
  }

  static async deleteLead(leadId: string): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (error) throw error;
  }

  static async updateLeadStatus(
    leadId: string,
    newStatus: LeadStatus,
    notes?: string
  ): Promise<Lead> {
    const { data: lead, error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw error;

    if (notes) {
      await supabase
        .from('lead_status_history')
        .update({ notes })
        .eq('lead_id', leadId)
        .eq('new_status', newStatus)
        .order('changed_at', { ascending: false })
        .limit(1);
    }

    return lead;
  }

  static async assignLead(
    leadId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    const currentUser = (await supabase.auth.getUser()).data.user;

    await supabase
      .from('lead_assignments')
      .update({ is_active: false, unassigned_at: new Date().toISOString() })
      .eq('lead_id', leadId)
      .eq('is_active', true);

    const { error: assignError } = await supabase
      .from('lead_assignments')
      .insert({
        lead_id: leadId,
        user_id: userId,
        assigned_by: currentUser?.id,
        notes
      });

    if (assignError) throw assignError;

    const { error: updateError } = await supabase
      .from('leads')
      .update({ assigned_to: userId })
      .eq('id', leadId);

    if (updateError) throw updateError;
  }

  static async getLeadStatusHistory(leadId: string): Promise<LeadStatusHistory[]> {
    const { data, error } = await supabase
      .from('lead_status_history')
      .select('*, changed_by_user:users(id, full_name)')
      .eq('lead_id', leadId)
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getLeadAssignments(leadId: string): Promise<LeadAssignment[]> {
    const { data, error } = await supabase
      .from('lead_assignments')
      .select('*, user:users(id, full_name, email), assigned_by_user:users(id, full_name)')
      .eq('lead_id', leadId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getLeadFieldValues(leadId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('lead_field_values')
      .select('*, field:lead_form_fields(*)')
      .eq('lead_id', leadId);

    if (error) throw error;
    return data || [];
  }

  static async getLeadStats(orgId: string, filters?: LeadFilters): Promise<LeadStats> {
    let query = supabase
      .from('leads')
      .select('status, score')
      .eq('org_id', orgId);

    if (filters?.start_date || filters?.end_date) {
      const tzOffset = new Date().getTimezoneOffset();
      const tzSign = tzOffset <= 0 ? '+' : '-';
      const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
      const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
      const tz = `${tzSign}${tzHours}:${tzMins}`;

      if (filters?.start_date) {
        query = query.gte('created_at', `${filters.start_date}T00:00:00${tz}`);
      }
      if (filters?.end_date) {
        query = query.lte('created_at', `${filters.end_date}T23:59:59${tz}`);
      }
    }

    if (filters?.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }

    if (filters?.region_id) {
      query = query.eq('region_id', filters.region_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    const stats: LeadStats = {
      total: data?.length || 0,
      new: 0,
      hot: 0,
      warm: 0,
      cold: 0,
      mild: 0,
      negotiation: 0,
      won: 0,
      lost: 0,
      conversion_rate: 0,
      avg_score: 0
    };

    if (data && data.length > 0) {
      data.forEach(lead => {
        if (lead.status === 'new') stats.new++;
        if (lead.status === 'hot') stats.hot++;
        if (lead.status === 'warm') stats.warm++;
        if (lead.status === 'cold') stats.cold++;
        if (lead.status === 'mild') stats.mild++;
        if (lead.status === 'negotiation') stats.negotiation++;
        if (lead.status === 'won') stats.won++;
        if (lead.status === 'lost') stats.lost++;
      });

      const totalScore = data.reduce((sum, lead) => sum + (lead.score || 0), 0);
      stats.avg_score = Math.round(totalScore / data.length);

      const closedLeads = stats.won + stats.lost;
      if (closedLeads > 0) {
        stats.conversion_rate = Math.round((stats.won / closedLeads) * 100);
      }
    }

    return stats;
  }

  static async listTemplates(orgId: string): Promise<LeadFormTemplate[]> {
    const { data, error } = await supabase
      .from('lead_form_templates')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name');

    if (error) throw error;
    return data || [];
  }

  static async getTemplate(templateId: string): Promise<LeadFormTemplate | null> {
    const { data, error } = await supabase
      .from('lead_form_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) throw error;
    return data;
  }

  static async getTemplateFields(templateId: string): Promise<LeadFormField[]> {
    const { data, error } = await supabase
      .from('lead_form_fields')
      .select('*')
      .eq('template_id', templateId)
      .order('display_order');

    if (error) throw error;
    return data || [];
  }

  static async createTemplate(
    orgId: string,
    name: string,
    description?: string,
    isDefault: boolean = false
  ): Promise<LeadFormTemplate> {
    const currentUser = (await supabase.auth.getUser()).data.user;

    const { data, error } = await supabase
      .from('lead_form_templates')
      .insert({
        org_id: orgId,
        name,
        description,
        is_default: isDefault,
        created_by: currentUser?.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateTemplate(
    templateId: string,
    updates: Partial<LeadFormTemplate>
  ): Promise<LeadFormTemplate> {
    const { data, error } = await supabase
      .from('lead_form_templates')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await supabase
      .from('lead_form_templates')
      .delete()
      .eq('id', templateId);

    if (error) throw error;
  }

  static async addFieldToTemplate(
    templateId: string,
    field: Omit<LeadFormField, 'id' | 'template_id' | 'created_at'>
  ): Promise<LeadFormField> {
    const { data, error } = await supabase
      .from('lead_form_fields')
      .insert({
        template_id: templateId,
        ...field
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateField(
    fieldId: string,
    updates: Partial<LeadFormField>
  ): Promise<LeadFormField> {
    const { data, error } = await supabase
      .from('lead_form_fields')
      .update(updates)
      .eq('id', fieldId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteField(fieldId: string): Promise<void> {
    const { error } = await supabase
      .from('lead_form_fields')
      .delete()
      .eq('id', fieldId);

    if (error) throw error;
  }

  static async listRanks(orgId: string, activeOnly: boolean = true): Promise<LeadRank[]> {
    let query = supabase
      .from('lead_ranks')
      .select('*')
      .eq('org_id', orgId)
      .order('display_order', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async listStatuses(orgId: string, activeOnly: boolean = true): Promise<LeadStatusRecord[]> {
    let query = supabase
      .from('lead_statuses')
      .select('*')
      .eq('org_id', orgId)
      .order('display_order', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async createDefaultTemplate(orgId: string): Promise<string> {
    const currentUser = (await supabase.auth.getUser()).data.user;

    const { data, error } = await supabase.rpc('create_default_lead_template', {
      p_org_id: orgId,
      p_created_by: currentUser?.id
    });

    if (error) throw error;
    return data;
  }
}
