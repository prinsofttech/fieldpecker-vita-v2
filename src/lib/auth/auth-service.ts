import { supabase } from '../supabase/client';
import type { User, Role } from '../supabase/types';
import { SessionService } from '../session/session-service';
import { LoginAttemptService } from '../security/login-attempt-service';
import { PasswordService } from '../security/password-service';

export interface SignUpData {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  org_id: string;
  role_id: string;
  parent_user_id?: string;
}

export interface SignInData {
  email: string;
  password: string;
  device_id?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  locked_until?: string;
  lockout_duration_minutes?: number;
  must_change_password?: boolean;
  password_expired?: boolean;
  remaining_attempts?: number;
}

export class AuthService {
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000;

  static async signUp(data: SignUpData, createdBy: string): Promise<AuthResponse> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
          },
        },
      });

      if (authError || !authData.user) {
        return { success: false, error: authError?.message || 'Sign up failed' };
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          org_id: data.org_id,
          role_id: data.role_id,
          email: data.email,
          full_name: data.full_name,
          phone: data.phone || null,
          parent_user_id: data.parent_user_id || null,
          created_by: createdBy,
          password_changed_at: new Date().toISOString(),
          session_expires_at: new Date(Date.now() + this.SESSION_TIMEOUT).toISOString(),
        })
        .select('*, role:roles(*), organization:organizations(*)')
        .single();

      if (userError) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        return { success: false, error: userError.message };
      }

      await this.logAudit(
        data.org_id,
        createdBy,
        'user_created',
        'users',
        authData.user.id,
        { email: data.email, role_id: data.role_id }
      );

      return { success: true, user: userData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async signIn(data: SignInData): Promise<AuthResponse> {
    try {
      const lockoutStatus = await LoginAttemptService.checkLockoutStatus(data.email);

      if (lockoutStatus.isLocked) {
        await LoginAttemptService.recordLoginAttempt(
          data.email,
          'lockout',
          undefined,
          'Attempted login while account is locked'
        );

        return {
          success: false,
          error: LoginAttemptService.formatLockoutMessage(lockoutStatus),
          locked_until: lockoutStatus.lockedUntil?.toISOString(),
          lockout_duration_minutes: lockoutStatus.lockoutDurationMinutes,
          remaining_attempts: 0
        };
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*, role:roles(*), organization:organizations(*)')
        .eq('email', data.email)
        .maybeSingle();

      if (userError || !user) {
        await LoginAttemptService.handleLoginAttempt(data.email, false, undefined, 'User not found');
        const newLockoutStatus = await LoginAttemptService.checkLockoutStatus(data.email);
        return {
          success: false,
          error: 'Invalid credentials',
          remaining_attempts: newLockoutStatus.remainingAttempts,
          lockout_duration_minutes: newLockoutStatus.lockoutDurationMinutes,
        };
      }

      if (user.status === 'locked' && user.locked_until) {
        const lockedUntil = new Date(user.locked_until);
        if (lockedUntil > new Date()) {
          return {
            success: false,
            error: `Account locked until ${lockedUntil.toLocaleString()}`,
            locked_until: user.locked_until,
            lockout_duration_minutes: lockoutStatus.lockoutDurationMinutes,
            remaining_attempts: 0
          };
        }
      }

      if (user.status === 'inactive') {
        return { success: false, error: 'Account is inactive' };
      }

      if (data.device_id && user.device_id && user.device_id !== data.device_id) {
        return { success: false, error: 'Already logged in on another device' };
      }

      const finalLockoutCheck = await LoginAttemptService.checkLockoutStatus(data.email);
      if (finalLockoutCheck.isLocked) {
        return {
          success: false,
          error: LoginAttemptService.formatLockoutMessage(finalLockoutCheck),
          locked_until: finalLockoutCheck.lockedUntil?.toISOString(),
          lockout_duration_minutes: finalLockoutCheck.lockoutDurationMinutes,
          remaining_attempts: 0
        };
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        const attemptResult = await LoginAttemptService.handleLoginAttempt(
          data.email,
          false,
          user.id,
          'Invalid password'
        );
        return {
          success: false,
          error: attemptResult.message || 'Invalid credentials',
          remaining_attempts: attemptResult.lockoutStatus.remainingAttempts,
          locked_until: attemptResult.lockoutStatus.lockedUntil?.toISOString(),
          lockout_duration_minutes: attemptResult.lockoutStatus.lockoutDurationMinutes,
        };
      }

      await LoginAttemptService.handleLoginAttempt(data.email, true, user.id);

      await supabase.rpc('clear_lockout_after_success', { user_id: user.id });

      await supabase
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          failed_login_attempts: 0,
          device_id: data.device_id || null,
          session_expires_at: new Date(Date.now() + this.SESSION_TIMEOUT).toISOString(),
        })
        .eq('id', user.id);

      await this.logAudit(user.org_id, user.id, 'user_login', 'users', user.id);

      const mustChangePassword = await PasswordService.checkMustChangePassword(user.id);
      const passwordExpiry = await PasswordService.checkPasswordExpiry(user.id);

      try {
        const sessionId = await SessionService.createSession(user.id);
        if (sessionId) {
          SessionService.startActivityTracking();
          await SessionService.startSessionMonitoring(sessionId);
        }
      } catch {
        // Proceed without session tracking
      }

      return {
        success: true,
        user,
        must_change_password: mustChangePassword,
        password_expired: passwordExpiry.isExpired
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async refreshSession(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('[AUTH] Session refresh failed:', error);
        return { success: false, error: error.message };
      }

      if (data.session) {
        console.log('[AUTH] Session refreshed successfully');
        return { success: true };
      }

      return { success: false, error: 'No session to refresh' };
    } catch (error) {
      console.error('[AUTH] Session refresh error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async signOut(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .maybeSingle();

      // Terminate session record
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: sessionData } = await supabase
            .from('user_sessions')
            .select('id')
            .eq('session_token', session.access_token)
            .eq('is_active', true)
            .maybeSingle();

          if (sessionData) {
            await SessionService.terminateSession(sessionData.id, 'user_logout');
          }
        }
        SessionService.stopActivityTracking();
        SessionService.stopSessionMonitoring();
      } catch (sessionError) {
        console.error('Failed to terminate session record:', sessionError);
      }

      await supabase
        .from('users')
        .update({
          device_id: null,
          session_expires_at: null,
        })
        .eq('id', user.id);

      if (userData) {
        await this.logAudit(
          userData.org_id,
          user.id,
          'user_logout',
          'users',
          user.id
        );
      }
    }

    await supabase.auth.signOut();
  }

  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const validation = PasswordService.validatePassword(newPassword);
      if (!validation.isValid) {
        return { success: false, error: validation.errors.join('. ') };
      }

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', userId)
        .single();

      if (!userData) {
        return { success: false, error: 'User not found' };
      }

      const result = await PasswordService.changePassword(userId, newPassword, 'user_change');

      if (!result.success) {
        return { success: false, error: result.error };
      }

      await this.logAudit(
        userData.org_id,
        userId,
        'password_changed',
        'users',
        userId
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async checkPasswordExpiry(userId: string): Promise<boolean> {
    const { data: user } = await supabase
      .from('users')
      .select('password_changed_at')
      .eq('id', userId)
      .single();

    if (!user) return false;

    const passwordAge = Date.now() - new Date(user.password_changed_at).getTime();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;

    return passwordAge > ninetyDays;
  }

  static async checkSessionExpiry(userId: string): Promise<boolean> {
    const { data: user } = await supabase
      .from('users')
      .select('session_expires_at')
      .eq('id', userId)
      .single();

    if (!user || !user.session_expires_at) return true;

    return new Date(user.session_expires_at) < new Date();
  }

  static async extendSessionTimeout(userId: string): Promise<void> {
    await supabase
      .from('users')
      .update({
        session_expires_at: new Date(Date.now() + this.SESSION_TIMEOUT).toISOString(),
      })
      .eq('id', userId);
  }

  private static async logAudit(
    orgId: string,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    changes?: Record<string, any>
  ): Promise<void> {
    await supabase.from('audit_logs').insert({
      org_id: orgId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      changes: changes || {},
    });
  }
}
