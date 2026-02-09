import { supabase } from '../supabase/client';

export interface FormInteraction {
  id: string;
  org_id: string;
  user_id: string;
  form_id: string | null;
  form_submission_id: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  status: 'in_progress' | 'completed' | 'abandoned' | 'saved_draft';
  field_interactions: Record<string, any>;
  created_at: string;
}

export interface FormTrackingStats {
  totalInteractions: number;
  averageDurationSeconds: number;
  completionRate: number;
  abandonmentRate: number;
  byForm: Array<{
    formId: string;
    formName: string;
    interactions: number;
    avgDuration: number;
    completionRate: number;
  }>;
}

export class FormTrackingService {
  private static activeTrackingId: string | null = null;
  private static startTime: Date | null = null;
  private static durationInterval: number | null = null;
  private static onDurationUpdate: ((seconds: number) => void) | null = null;

  static async startTracking(
    orgId: string,
    userId: string,
    formId: string,
    onDurationUpdate?: (seconds: number) => void
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('form_interaction_tracking')
        .insert({
          org_id: orgId,
          user_id: userId,
          form_id: formId,
          started_at: new Date().toISOString(),
          status: 'in_progress',
          device_info: {
            userAgent: navigator.userAgent,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
          },
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error starting form tracking:', error);
        return null;
      }

      this.activeTrackingId = data.id;
      this.startTime = new Date();
      this.onDurationUpdate = onDurationUpdate || null;

      if (onDurationUpdate) {
        this.durationInterval = window.setInterval(() => {
          if (this.startTime && this.onDurationUpdate) {
            const seconds = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
            this.onDurationUpdate(seconds);
          }
        }, 1000);
      }

      return data.id;
    } catch (error) {
      console.error('Error starting form tracking:', error);
      return null;
    }
  }

  static async completeTracking(
    submissionId?: string,
    fieldInteractions?: Record<string, any>
  ): Promise<void> {
    if (!this.activeTrackingId || !this.startTime) {
      return;
    }

    const completedAt = new Date();
    const durationSeconds = Math.floor((completedAt.getTime() - this.startTime.getTime()) / 1000);

    try {
      await supabase
        .from('form_interaction_tracking')
        .update({
          completed_at: completedAt.toISOString(),
          duration_seconds: durationSeconds,
          status: 'completed',
          form_submission_id: submissionId || null,
          field_interactions: fieldInteractions || {},
        })
        .eq('id', this.activeTrackingId);
    } catch (error) {
      console.error('Error completing form tracking:', error);
    } finally {
      this.cleanup();
    }
  }

  static async abandonTracking(fieldInteractions?: Record<string, any>): Promise<void> {
    if (!this.activeTrackingId || !this.startTime) {
      return;
    }

    const abandonedAt = new Date();
    const durationSeconds = Math.floor((abandonedAt.getTime() - this.startTime.getTime()) / 1000);

    try {
      await supabase
        .from('form_interaction_tracking')
        .update({
          completed_at: abandonedAt.toISOString(),
          duration_seconds: durationSeconds,
          status: 'abandoned',
          field_interactions: fieldInteractions || {},
        })
        .eq('id', this.activeTrackingId);
    } catch (error) {
      console.error('Error abandoning form tracking:', error);
    } finally {
      this.cleanup();
    }
  }

  static async saveDraftTracking(fieldInteractions?: Record<string, any>): Promise<void> {
    if (!this.activeTrackingId || !this.startTime) {
      return;
    }

    const savedAt = new Date();
    const durationSeconds = Math.floor((savedAt.getTime() - this.startTime.getTime()) / 1000);

    try {
      await supabase
        .from('form_interaction_tracking')
        .update({
          completed_at: savedAt.toISOString(),
          duration_seconds: durationSeconds,
          status: 'saved_draft',
          field_interactions: fieldInteractions || {},
        })
        .eq('id', this.activeTrackingId);
    } catch (error) {
      console.error('Error saving draft tracking:', error);
    } finally {
      this.cleanup();
    }
  }

  static getCurrentDuration(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  static isTracking(): boolean {
    return this.activeTrackingId !== null;
  }

  private static cleanup(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    this.activeTrackingId = null;
    this.startTime = null;
    this.onDurationUpdate = null;
  }

  static async getFormInteractions(
    orgId: string,
    filters?: {
      userId?: string;
      formId?: string;
      status?: FormInteraction['status'];
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<FormInteraction[]> {
    let query = supabase
      .from('form_interaction_tracking')
      .select('*')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.formId) {
      query = query.eq('form_id', filters.formId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.startDate) {
      query = query.gte('started_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte('started_at', filters.endDate.toISOString());
    }

    query = query.limit(filters?.limit || 100);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching form interactions:', error);
      return [];
    }

    return data || [];
  }

  static async getFormTrackingStats(
    orgId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<FormTrackingStats> {
    let query = supabase
      .from('form_interaction_tracking')
      .select(`
        *,
        form:forms(id, name)
      `)
      .eq('org_id', orgId);

    if (startDate) {
      query = query.gte('started_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('started_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error || !data) {
      return {
        totalInteractions: 0,
        averageDurationSeconds: 0,
        completionRate: 0,
        abandonmentRate: 0,
        byForm: [],
      };
    }

    const totalInteractions = data.length;
    const completedInteractions = data.filter((d: any) => d.status === 'completed');
    const abandonedInteractions = data.filter((d: any) => d.status === 'abandoned');

    const durations = data
      .filter((d: any) => d.duration_seconds !== null)
      .map((d: any) => d.duration_seconds);

    const averageDurationSeconds =
      durations.length > 0 ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 0;

    const completionRate = totalInteractions > 0 ? (completedInteractions.length / totalInteractions) * 100 : 0;
    const abandonmentRate = totalInteractions > 0 ? (abandonedInteractions.length / totalInteractions) * 100 : 0;

    const formGroups = data.reduce((acc: any, item: any) => {
      if (!item.form_id) return acc;
      if (!acc[item.form_id]) {
        acc[item.form_id] = {
          formId: item.form_id,
          formName: item.form?.name || 'Unknown Form',
          interactions: [],
        };
      }
      acc[item.form_id].interactions.push(item);
      return acc;
    }, {});

    const byForm = Object.values(formGroups).map((group: any) => {
      const formDurations = group.interactions
        .filter((i: any) => i.duration_seconds !== null)
        .map((i: any) => i.duration_seconds);

      const formCompleted = group.interactions.filter((i: any) => i.status === 'completed');

      return {
        formId: group.formId,
        formName: group.formName,
        interactions: group.interactions.length,
        avgDuration: formDurations.length > 0
          ? Math.round(formDurations.reduce((a: number, b: number) => a + b, 0) / formDurations.length)
          : 0,
        completionRate: group.interactions.length > 0
          ? Math.round((formCompleted.length / group.interactions.length) * 100)
          : 0,
      };
    });

    return {
      totalInteractions,
      averageDurationSeconds,
      completionRate: Math.round(completionRate),
      abandonmentRate: Math.round(abandonmentRate),
      byForm,
    };
  }
}
