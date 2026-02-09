import { supabase } from '../supabase/client';

export interface LoginAttemptRecord {
  id: string;
  user_id: string | null;
  email: string;
  ip_address: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  attempt_type: 'success' | 'failure' | 'lockout';
  failure_reason: string | null;
  created_at: string;
}

export interface LockoutStatus {
  isLocked: boolean;
  remainingAttempts: number;
  lockedUntil: Date | null;
  lockoutDurationMinutes: number;
}

interface LockoutConfig {
  maxAttempts: number;
  lockoutDurationMinutes: number;
}

const DEFAULT_LOCKOUT_CONFIG: LockoutConfig = {
  maxAttempts: 5,
  lockoutDurationMinutes: 15,
};

export class LoginAttemptService {
  private static configCache: Map<string, { config: LockoutConfig; fetchedAt: number }> = new Map();
  private static readonly CACHE_TTL_MS = 60_000;

  private static async getLockoutConfig(email: string): Promise<LockoutConfig> {
    const cached = this.configCache.get(email);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS) {
      return cached.config;
    }

    const { data, error } = await supabase
      .rpc('get_lockout_config', { user_email: email })
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_LOCKOUT_CONFIG;
    }

    const config: LockoutConfig = {
      maxAttempts: data.max_attempts ?? DEFAULT_LOCKOUT_CONFIG.maxAttempts,
      lockoutDurationMinutes: data.lockout_duration_minutes ?? DEFAULT_LOCKOUT_CONFIG.lockoutDurationMinutes,
    };

    this.configCache.set(email, { config, fetchedAt: Date.now() });
    return config;
  }

  static async recordLoginAttempt(
    email: string,
    attemptType: 'success' | 'failure' | 'lockout',
    userId?: string,
    failureReason?: string,
    deviceInfo?: {
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: string;
    }
  ): Promise<void> {
    await supabase.from('login_attempts').insert({
      user_id: userId || null,
      email,
      ip_address: deviceInfo?.ipAddress || null,
      user_agent: deviceInfo?.userAgent || null,
      device_fingerprint: deviceInfo?.deviceFingerprint || null,
      attempt_type: attemptType,
      failure_reason: failureReason || null,
    });
  }

  static async getRecentFailedAttempts(email: string): Promise<number> {
    const { data, error } = await supabase.rpc('get_recent_login_attempts', {
      p_email: email,
    });

    if (error) {
      console.error('Error getting recent login attempts:', error);
      return 0;
    }

    return data || 0;
  }

  static async checkLockoutStatus(email: string): Promise<LockoutStatus> {
    const config = await this.getLockoutConfig(email);

    const { data: userLockoutData, error } = await supabase
      .rpc('check_user_lockout_status', { user_email: email })
      .maybeSingle();

    if (error) {
      return {
        isLocked: true,
        remainingAttempts: 0,
        lockedUntil: new Date(Date.now() + config.lockoutDurationMinutes * 60 * 1000),
        lockoutDurationMinutes: config.lockoutDurationMinutes,
      };
    }

    if (userLockoutData && userLockoutData.status === 'locked' && userLockoutData.locked_until) {
      const lockedUntil = new Date(userLockoutData.locked_until);
      if (lockedUntil > new Date()) {
        return {
          isLocked: true,
          remainingAttempts: 0,
          lockedUntil,
          lockoutDurationMinutes: config.lockoutDurationMinutes,
        };
      }
    }

    const failedAttempts = await this.getRecentFailedAttempts(email);

    if (failedAttempts >= config.maxAttempts) {
      const { data: lastAttemptTime, error: lastAttemptError } = await supabase
        .rpc('get_last_failed_login_attempt', { p_email: email });

      if (lastAttemptError) {
        return {
          isLocked: true,
          remainingAttempts: 0,
          lockedUntil: new Date(Date.now() + config.lockoutDurationMinutes * 60 * 1000),
          lockoutDurationMinutes: config.lockoutDurationMinutes,
        };
      }

      if (lastAttemptTime) {
        const lockoutEnd = new Date(
          new Date(lastAttemptTime).getTime() + config.lockoutDurationMinutes * 60 * 1000
        );
        if (lockoutEnd > new Date()) {
          return {
            isLocked: true,
            remainingAttempts: 0,
            lockedUntil: lockoutEnd,
            lockoutDurationMinutes: config.lockoutDurationMinutes,
          };
        }
      } else {
        return {
          isLocked: true,
          remainingAttempts: 0,
          lockedUntil: new Date(Date.now() + config.lockoutDurationMinutes * 60 * 1000),
          lockoutDurationMinutes: config.lockoutDurationMinutes,
        };
      }
    }

    return {
      isLocked: false,
      remainingAttempts: Math.max(0, config.maxAttempts - failedAttempts),
      lockedUntil: null,
      lockoutDurationMinutes: config.lockoutDurationMinutes,
    };
  }

  static async handleLoginAttempt(
    email: string,
    success: boolean,
    userId?: string,
    failureReason?: string,
    deviceInfo?: {
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: string;
    }
  ): Promise<{
    allowed: boolean;
    lockoutStatus: LockoutStatus;
    message?: string;
  }> {
    const config = await this.getLockoutConfig(email);
    const lockoutStatus = await this.checkLockoutStatus(email);

    if (lockoutStatus.isLocked) {
      await this.recordLoginAttempt(email, 'lockout', userId, 'Account locked due to too many failed attempts', deviceInfo);

      const remainingMinutes = Math.ceil(
        (lockoutStatus.lockedUntil!.getTime() - Date.now()) / (60 * 1000)
      );

      return {
        allowed: false,
        lockoutStatus,
        message: `Account is locked. Please try again in ${remainingMinutes} minute(s).`,
      };
    }

    if (success) {
      await this.recordLoginAttempt(email, 'success', userId, undefined, deviceInfo);

      if (userId) {
        await supabase
          .from('users')
          .update({
            failed_login_attempts: 0,
            locked_until: null,
            status: 'active',
          })
          .eq('id', userId);
      }

      return {
        allowed: true,
        lockoutStatus: {
          isLocked: false,
          remainingAttempts: config.maxAttempts,
          lockedUntil: null,
          lockoutDurationMinutes: config.lockoutDurationMinutes,
        },
      };
    }

    await this.recordLoginAttempt(email, 'failure', userId, failureReason || 'Invalid credentials', deviceInfo);

    const newLockoutStatus = await this.checkLockoutStatus(email);

    if (userId) {
      const updateData: Record<string, any> = {
        failed_login_attempts: config.maxAttempts - newLockoutStatus.remainingAttempts,
      };

      if (newLockoutStatus.isLocked) {
        updateData.status = 'locked';
        updateData.locked_until = newLockoutStatus.lockedUntil?.toISOString();
      }

      await supabase.from('users').update(updateData).eq('id', userId);
    }

    if (newLockoutStatus.isLocked) {
      return {
        allowed: false,
        lockoutStatus: newLockoutStatus,
        message: `Account has been locked due to too many failed attempts. Please try again in ${config.lockoutDurationMinutes} minutes.`,
      };
    }

    return {
      allowed: false,
      lockoutStatus: newLockoutStatus,
      message: `Invalid credentials. ${newLockoutStatus.remainingAttempts} attempt(s) remaining before account lockout.`,
    };
  }

  static async getLoginHistory(
    orgId: string,
    filters?: {
      userId?: string;
      email?: string;
      attemptType?: 'success' | 'failure' | 'lockout';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<LoginAttemptRecord[]> {
    let query = supabase
      .from('login_attempts')
      .select(`
        *,
        user:users!login_attempts_user_id_fkey(full_name, email, org_id)
      `)
      .order('created_at', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.email) {
      query = query.eq('email', filters.email);
    }

    if (filters?.attemptType) {
      query = query.eq('attempt_type', filters.attemptType);
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    query = query.limit(filters?.limit || 100);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching login history:', error);
      return [];
    }

    return (data || []).filter((record: any) => record.user?.org_id === orgId);
  }

  static async clearLockout(userId: string): Promise<void> {
    await supabase
      .from('users')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        status: 'active',
      })
      .eq('id', userId);
  }

  static formatLockoutMessage(lockoutStatus: LockoutStatus): string {
    if (!lockoutStatus.isLocked) {
      if (lockoutStatus.remainingAttempts <= 2) {
        return `Warning: ${lockoutStatus.remainingAttempts} login attempt(s) remaining before account lockout.`;
      }
      return '';
    }

    if (lockoutStatus.lockedUntil) {
      const remainingMinutes = Math.ceil(
        (lockoutStatus.lockedUntil.getTime() - Date.now()) / (60 * 1000)
      );
      return `Account locked. Try again in ${remainingMinutes} minute(s).`;
    }

    return 'Account is locked. Please contact your administrator.';
  }
}
