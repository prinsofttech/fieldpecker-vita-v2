import { supabase } from '../supabase/client';
import type { Checkin, CheckinWithUser, CheckinFilters, CheckinStats } from './types';

export class CheckinService {
  private static async enrichWithUsers(checkins: Checkin[]): Promise<CheckinWithUser[]> {
    if (checkins.length === 0) return [];

    const userIds = [...new Set(checkins.map(c => c.user_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', userIds);

    const userMap = new Map((users || []).map(u => [u.id, u]));

    return checkins.map(c => ({
      ...c,
      user: userMap.get(c.user_id) || undefined,
    }));
  }

  static async listCheckins(
    orgId: string,
    filters?: CheckinFilters,
    sortBy: string = 'check_in_at',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<CheckinWithUser[]> {
    let query = supabase
      .from('checkins')
      .select('*')
      .eq('org_id', orgId);

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters?.status === 'checked_in') {
      query = query.is('check_out_at', null);
    } else if (filters?.status === 'checked_out') {
      query = query.not('check_out_at', 'is', null);
    }

    if (filters?.start_date || filters?.end_date) {
      const tzOffset = new Date().getTimezoneOffset();
      const tzSign = tzOffset <= 0 ? '+' : '-';
      const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
      const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
      const tz = `${tzSign}${tzHours}:${tzMins}`;

      if (filters?.start_date) {
        query = query.gte('check_in_at', `${filters.start_date}T00:00:00${tz}`);
      }
      if (filters?.end_date) {
        query = query.lte('check_in_at', `${filters.end_date}T23:59:59${tz}`);
      }
    }

    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error } = await query;
    if (error) throw error;

    let enriched = await this.enrichWithUsers(data || []);

    if (filters?.search) {
      const term = filters.search.toLowerCase();
      enriched = enriched.filter(c =>
        c.user?.full_name?.toLowerCase().includes(term) ||
        c.user?.email?.toLowerCase().includes(term)
      );
    }

    return enriched;
  }

  static async getCheckin(checkinId: string): Promise<CheckinWithUser | null> {
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('id', checkinId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const enriched = await this.enrichWithUsers([data]);
    return enriched[0] || null;
  }

  static async checkIn(
    userId: string,
    orgId: string,
    latitude?: number,
    longitude?: number
  ): Promise<Checkin> {
    const { data, error } = await supabase
      .from('checkins')
      .insert({
        user_id: userId,
        org_id: orgId,
        check_in_at: new Date().toISOString(),
        check_in_latitude: latitude ?? null,
        check_in_longitude: longitude ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async checkOut(
    checkinId: string,
    latitude?: number,
    longitude?: number
  ): Promise<Checkin> {
    const { data, error } = await supabase
      .from('checkins')
      .update({
        check_out_at: new Date().toISOString(),
        check_out_latitude: latitude ?? null,
        check_out_longitude: longitude ?? null,
      })
      .eq('id', checkinId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getActiveCheckin(userId: string): Promise<Checkin | null> {
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', userId)
      .is('check_out_at', null)
      .order('check_in_at', { ascending: false })
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async getStats(orgId: string, filters?: CheckinFilters): Promise<CheckinStats> {
    let query = supabase
      .from('checkins')
      .select('check_in_at, check_out_at')
      .eq('org_id', orgId);

    if (filters?.start_date || filters?.end_date) {
      const tzOffset = new Date().getTimezoneOffset();
      const tzSign = tzOffset <= 0 ? '+' : '-';
      const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
      const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
      const tz = `${tzSign}${tzHours}:${tzMins}`;

      if (filters?.start_date) {
        query = query.gte('check_in_at', `${filters.start_date}T00:00:00${tz}`);
      }
      if (filters?.end_date) {
        query = query.lte('check_in_at', `${filters.end_date}T23:59:59${tz}`);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    const records = data || [];
    const checkedIn = records.filter(r => !r.check_out_at).length;
    const checkedOut = records.filter(r => r.check_out_at).length;

    let totalMinutes = 0;
    let completedCount = 0;
    records.forEach(r => {
      if (r.check_out_at) {
        const diff = new Date(r.check_out_at).getTime() - new Date(r.check_in_at).getTime();
        totalMinutes += diff / 60000;
        completedCount++;
      }
    });

    return {
      total: records.length,
      checked_in: checkedIn,
      checked_out: checkedOut,
      avg_duration_minutes: completedCount > 0 ? Math.round(totalMinutes / completedCount) : 0,
    };
  }
}
