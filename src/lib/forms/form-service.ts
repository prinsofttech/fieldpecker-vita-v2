import { supabase } from '../supabase/client';
import type {
  Form,
  FormVisibility,
  CreateFormData,
  UpdateFormData,
  SubmitFormData,
  SubmitFormResponse,
  AttachFormData,
  FormCustomerAttachment,
  FormSubmission,
  TeamFormStats,
  FormSubmissionLog
} from './types';

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export class FormService {
  static async createForm(orgId: string, data: CreateFormData): Promise<Form | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const internalFormId = `FORM-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

      const { data: form, error } = await supabase
        .from('forms')
        .insert({
          org_id: orgId,
          internal_form_id: internalFormId,
          created_by: user.id,
          ...data
        })
        .select()
        .single();

      if (error) throw error;
      return form;
    } catch (error) {
      console.error('Error creating form:', error);
      throw error;
    }
  }

  static async updateForm(formId: string, data: UpdateFormData): Promise<Form | null> {
    try {
      const { data: form, error } = await supabase
        .from('forms')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', formId)
        .select()
        .single();

      if (error) throw error;
      return form;
    } catch (error) {
      console.error('Error updating form:', error);
      throw error;
    }
  }

  static async getForm(formId: string): Promise<Form | null> {
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching form:', error);
      return null;
    }
  }

  static async listForms(orgId: string, filters?: {
    department_id?: string;
    is_active?: boolean;
  }): Promise<Form[]> {
    try {
      let query = supabase
        .from('forms')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (filters?.department_id) {
        query = query.eq('department_id', filters.department_id);
      }

      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error listing forms:', error);
      return [];
    }
  }

  static async deleteForm(formId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', formId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting form:', error);
      return false;
    }
  }

  static async attachFormToCustomers(data: AttachFormData): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const attachments = data.customer_ids.map(customerId => ({
        form_id: data.form_id,
        customer_id: customerId,
        criteria: data.criteria,
        attached_by: user.id
      }));

      const { error } = await supabase
        .from('form_customer_attachments')
        .upsert(attachments, {
          onConflict: 'form_id,customer_id'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error attaching form to customers:', error);
      return false;
    }
  }

  static async removeFormAttachment(formId: string, customerId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('form_customer_attachments')
        .update({ is_active: false })
        .eq('form_id', formId)
        .eq('customer_id', customerId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing form attachment:', error);
      return false;
    }
  }

  static async getFormAttachments(formId: string): Promise<FormCustomerAttachment[]> {
    try {
      const { data, error } = await supabase
        .from('form_customer_attachments')
        .select('*')
        .eq('form_id', formId)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching form attachments:', error);
      return [];
    }
  }

  static async checkFormVisibility(formId: string, agentId: string): Promise<FormVisibility> {
    try {
      const { data, error } = await supabase.rpc('evaluate_form_visibility', {
        p_form_id: formId,
        p_agent_id: agentId,
        p_check_time: new Date().toISOString()
      });

      if (error) throw error;
      return data as FormVisibility;
    } catch (error) {
      console.error('Error checking form visibility:', error);
      return {
        visible: false,
        reason: 'error_checking_visibility'
      };
    }
  }

  static async getAvailableForms(agentId: string): Promise<{ form: Form; visibility: FormVisibility }[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!userData) throw new Error('User data not found');

      const forms = await this.listForms(userData.org_id, { is_active: true });

      const formsWithVisibility = await Promise.all(
        forms.map(async (form) => {
          const visibility = await this.checkFormVisibility(form.id, agentId);
          return { form, visibility };
        })
      );

      return formsWithVisibility.filter(item => item.visibility.visible);
    } catch (error) {
      console.error('Error fetching available forms:', error);
      return [];
    }
  }

  static async getCurrentUserData(): Promise<{ data: any; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('id', user.id)
        .single();

      // Get supervisor info if user has a manager
      let supervisorData = null;
      if (data && (data as any).reports_to_user_id) {
        const { data: supervisor } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('id', (data as any).reports_to_user_id)
          .single();

        supervisorData = supervisor;
      }

      return {
        data: {
          ...data,
          supervisor_name: supervisorData?.full_name,
          supervisor_code: supervisorData?.id
        },
        error
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return { data: null, error };
    }
  }

  static async submitForm(data: SubmitFormData): Promise<SubmitFormResponse> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: result, error } = await supabase.rpc('submit_form', {
        p_form_id: data.form_id,
        p_agent_id: data.agent_id,
        p_submission_data: data.submission_data,
        p_submitted_by: user.id,
        p_latitude: data.latitude,
        p_longitude: data.longitude,
        p_time_spent: data.time_spent,
        p_supervisor_name: data.supervisor_name,
        p_supervisor_code: data.supervisor_code,
        p_form_started_at: data.form_started_at
      });

      if (error) throw error;
      return result as SubmitFormResponse;
    } catch (error) {
      console.error('Error submitting form:', error);
      return {
        success: false,
        error: 'submission_failed',
        details: error
      };
    }
  }

  static async getSubmissions(filters: {
    form_id?: string;
    agent_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    region_id?: string;
    branch_id?: string;
    excludeRejected?: boolean;
  }): Promise<FormSubmission[]> {
    try {
      let query = supabase
        .from('form_submissions')
        .select('*, customers!form_submissions_agent_id_fkey(customer_name, customer_code, region_id, branch_id, regions!agents_region_id_fkey(name), branches!agents_branch_id_fkey(name)), users!form_submissions_submitted_by_fkey(full_name)')
        .order('submitted_at', { ascending: false });

      if (filters.form_id) {
        query = query.eq('form_id', filters.form_id);
      }

      if (filters.agent_id) {
        query = query.eq('agent_id', filters.agent_id);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      } else if (filters.excludeRejected) {
        query = query.neq('status', 'rejected');
      }

      if (filters.start_date || filters.end_date) {
        const tzOffset = new Date().getTimezoneOffset();
        const tzSign = tzOffset <= 0 ? '+' : '-';
        const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
        const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
        const tz = `${tzSign}${tzHours}:${tzMins}`;

        if (filters.start_date) {
          const startDate = filters.start_date.includes('T')
            ? filters.start_date
            : `${filters.start_date}T00:00:00${tz}`;
          query = query.gte('submitted_at', startDate);
        }

        if (filters.end_date) {
          const endDate = filters.end_date.includes('T')
            ? filters.end_date
            : `${filters.end_date}T23:59:59.999${tz}`;
          query = query.lte('submitted_at', endDate);
        }
      }

      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: page, error } = await query.range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!page || page.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(page);
          if (page.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            from += PAGE_SIZE;
          }
        }
      }

      let filteredData = allData;

      if (filters.region_id) {
        filteredData = filteredData.filter((submission: any) =>
          submission.customers?.region_id === filters.region_id
        );
      }

      if (filters.branch_id) {
        filteredData = filteredData.filter((submission: any) =>
          submission.customers?.branch_id === filters.branch_id
        );
      }

      return filteredData.map((submission: any) => {
        const { customers, users, ...rest } = submission;
        return {
          ...rest,
          customer_name: customers?.customer_name || null,
          customer_code: customers?.customer_code || null,
          territory_name: customers?.regions?.name || null,
          sub_territory_name: customers?.branches?.name || null,
          submitter_name: users?.full_name || null,
        };
      });
    } catch (error) {
      console.error('Error fetching submissions:', error);
      return [];
    }
  }

  static async approveSubmission(
    submissionId: string,
    reviewNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('approve_form_submission', {
        p_submission_id: submissionId,
        p_reviewer_id: user.id,
        p_review_notes: reviewNotes || null
      });

      if (error) throw error;
      return data as { success: boolean; error?: string };
    } catch (error) {
      console.error('Error approving submission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve submission'
      };
    }
  }

  static async rejectSubmission(
    submissionId: string,
    rejectionReason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('reject_form_submission', {
        p_submission_id: submissionId,
        p_reviewer_id: user.id,
        p_rejection_reason: rejectionReason
      });

      if (error) throw error;
      return data as { success: boolean; error?: string };
    } catch (error) {
      console.error('Error rejecting submission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject submission'
      };
    }
  }

  static async getAgentSubmissionLog(formId: string, agentId: string): Promise<FormSubmissionLog | null> {
    try {
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('form_submissions_log')
        .select('*')
        .eq('form_id', formId)
        .eq('agent_id', agentId)
        .eq('tracking_month', currentMonth.toISOString().split('T')[0])
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching submission log:', error);
      return null;
    }
  }

  static async getTeamFormStats(supervisorId: string): Promise<TeamFormStats[]> {
    try {
      const { data: teamMembers } = await supabase.rpc('get_team_hierarchy', {
        p_user_id: supervisorId
      });

      if (!teamMembers || teamMembers.length === 0) {
        return [];
      }

      const agentIds = teamMembers.map((m: any) => m.subordinate_id);

      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const { data: logs } = await supabase
        .from('form_submissions_log')
        .select(`
          *,
          form:forms(id, title),
          agent:customers(id, customer_name)
        `)
        .in('agent_id', agentIds)
        .eq('tracking_month', currentMonth.toISOString().split('T')[0]);

      const statsMap = new Map<string, TeamFormStats>();

      logs?.forEach((log: any) => {
        const agentId = log.agent_id;
        if (!statsMap.has(agentId)) {
          statsMap.set(agentId, {
            agent_id: agentId,
            agent_name: log.agent?.customer_name || 'Unknown',
            forms: []
          });
        }

        const agentStats = statsMap.get(agentId)!;
        agentStats.forms.push({
          form_id: log.form_id,
          form_title: log.form?.title || 'Unknown Form',
          submissions_count: log.submissions_count,
          current_cycle: log.current_cycle,
          max_cycles: log.max_cycles_allowed,
          completion_rate: (log.current_cycle / log.max_cycles_allowed) * 100,
          last_submission_at: log.last_submission_at
        });
      });

      return Array.from(statsMap.values());
    } catch (error) {
      console.error('Error fetching team form stats:', error);
      return [];
    }
  }

  static async exportSubmissionsCSV(
    formId: string,
    filters?: {
      start_date?: string;
      end_date?: string;
      agent_ids?: string[];
      includeRejected?: boolean;
    }
  ): Promise<string> {
    try {
      const submissions = await this.getSubmissions({
        form_id: formId,
        start_date: filters?.start_date,
        end_date: filters?.end_date,
        excludeRejected: !filters?.includeRejected
      });

      const form = await this.getForm(formId);
      if (!form) throw new Error('Form not found');

      // Get customer names
      const customerIds = [...new Set(submissions.map(s => s.agent_id))];
      const { data: customers } = await supabase
        .from('customers')
        .select('id, customer_name, customer_code')
        .in('id', customerIds);

      const customerMap = new Map(customers?.map(c => [c.id, c.customer_name]) || []);
      const customerCodeMap = new Map(customers?.map(c => [c.id, c.customer_code || '']) || []);

      const supervisorCodes = [...new Set(submissions.map(s => s.supervisor_code).filter(Boolean))];
      let supervisorMap = new Map<string, string>();
      if (supervisorCodes.length > 0) {
        const { data: supervisors } = await supabase
          .from('users')
          .select('supervisor_code, full_name')
          .in('supervisor_code', supervisorCodes);
        supervisorMap = new Map(supervisors?.map(s => [s.supervisor_code, s.full_name]) || []);
      }

      const headers = [
        'Submission ID',
        'Customer Name',
        'Customer Code',
        'Cycle',
        'Status',
        'Submitted At',
        'Latitude',
        'Longitude',
        'Time Spent',
        'Supervisor Name',
        'Supervisor Code',
        'Form Started At',
        'Form Ended At',
        'Reviewed By',
        'Reviewed At',
        'Review Notes',
        'Rejection Reason'
      ];

      form.form_schema.forEach(field => {
        headers.push(field.label);
      });

      const rows = submissions.map(sub => {
        const row = [
          sub.id,
          customerMap.get(sub.agent_id) || 'Unknown',
          customerCodeMap.get(sub.agent_id) || '',
          sub.cycle_number.toString(),
          sub.status,
          new Date(sub.submitted_at).toLocaleString(),
          sub.latitude?.toString() || '',
          sub.longitude?.toString() || '',
          sub.time_spent || '',
          sub.supervisor_name || (sub.supervisor_code ? supervisorMap.get(sub.supervisor_code) || '' : ''),
          sub.supervisor_code || '',
          sub.form_started_at ? formatTimestamp(sub.form_started_at) : '',
          sub.form_end_time ? formatTimestamp(sub.form_end_time) : '',
          sub.reviewed_by || '',
          sub.reviewed_at ? new Date(sub.reviewed_at).toLocaleString() : '',
          sub.review_notes || '',
          sub.rejection_reason || ''
        ];

        form.form_schema.forEach(field => {
          const value = sub.submission_data[field.id];
          if (value === undefined || value === null) {
            row.push('');
          } else if (Array.isArray(value) && value.length > 0 && value[0]?.url) {
            row.push(value.map((img: any) => img.url).join(' | '));
          } else if (typeof value === 'object' && !Array.isArray(value) && (value.url || value.data)) {
            row.push(value.url || value.data || '');
          } else if (typeof value === 'object') {
            row.push(JSON.stringify(value));
          } else {
            row.push(String(value));
          }
        });

        return row;
      });

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

      return csv;
    } catch (error) {
      console.error('Error exporting submissions to CSV:', error);
      throw error;
    }
  }
}
