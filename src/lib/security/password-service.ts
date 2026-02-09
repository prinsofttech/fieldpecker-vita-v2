import { supabase } from '../supabase/client';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PasswordRequirements {
  minLength: number;
  requireAlphanumeric: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
}

const DEFAULT_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireAlphanumeric: true,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
};

export class PasswordService {
  private static readonly PASSWORD_EXPIRY_DAYS = 90;
  private static readonly PASSWORD_HISTORY_DAYS = 180;

  static validatePassword(
    password: string,
    requirements: PasswordRequirements = DEFAULT_REQUIREMENTS
  ): PasswordValidationResult {
    const errors: string[] = [];

    if (password.length < requirements.minLength) {
      errors.push(`Password must be at least ${requirements.minLength} characters long`);
    }

    if (requirements.requireAlphanumeric) {
      const hasLetter = /[a-zA-Z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      if (!hasLetter || !hasNumber) {
        errors.push('Password must contain both letters and numbers');
      }
    }

    if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (requirements.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (requirements.requireNumber && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (requirements.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static async checkPasswordExpiry(userId: string): Promise<{
    isExpired: boolean;
    daysUntilExpiry: number;
    expiresAt: Date | null;
  }> {
    const { data: user } = await supabase
      .from('users')
      .select('password_changed_at, password_expires_at')
      .eq('id', userId)
      .maybeSingle();

    if (!user) {
      return { isExpired: true, daysUntilExpiry: 0, expiresAt: null };
    }

    const passwordChangedAt = user.password_changed_at ? new Date(user.password_changed_at) : new Date();
    const expiresAt = user.password_expires_at
      ? new Date(user.password_expires_at)
      : new Date(passwordChangedAt.getTime() + this.PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const now = new Date();
    const isExpired = now > expiresAt;
    const daysUntilExpiry = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    return { isExpired, daysUntilExpiry, expiresAt };
  }

  static async checkMustChangePassword(userId: string): Promise<boolean> {
    const { data: user } = await supabase
      .from('users')
      .select('must_change_password')
      .eq('id', userId)
      .maybeSingle();

    return user?.must_change_password === true;
  }

  static async checkPasswordReuse(userId: string, newPasswordHash: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('check_password_reuse', {
        p_user_id: userId,
        p_password_hash: newPasswordHash,
      });

    if (error) {
      console.error('Error checking password reuse:', error);
      return false;
    }

    return data === true;
  }

  static async addPasswordToHistory(
    userId: string,
    passwordHash: string,
    changeReason: 'initial' | 'user_change' | 'forced_change' | 'admin_reset' | 'expiry'
  ): Promise<void> {
    await supabase.from('password_history').insert({
      user_id: userId,
      password_hash: passwordHash,
      change_reason: changeReason,
      expires_at: new Date(Date.now() + this.PASSWORD_HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  static async logPasswordAudit(
    userId: string,
    orgId: string,
    action: 'password_created' | 'password_changed' | 'password_reset' | 'password_expired' | 'password_reuse_blocked' | 'forced_change_required',
    performedBy?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await supabase.from('password_audit_log').insert({
      user_id: userId,
      org_id: orgId,
      action,
      performed_by: performedBy || userId,
      metadata: metadata || {},
    });
  }

  static async changePassword(
    userId: string,
    newPassword: string,
    changeReason: 'user_change' | 'forced_change' | 'admin_reset' | 'expiry'
  ): Promise<{ success: boolean; error?: string }> {
    const validation = this.validatePassword(newPassword);
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

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const newExpiresAt = new Date(Date.now() + this.PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await supabase
      .from('users')
      .update({
        password_changed_at: new Date().toISOString(),
        password_expires_at: newExpiresAt.toISOString(),
        must_change_password: false,
      })
      .eq('id', userId);

    const simpleHash = btoa(newPassword).substring(0, 60);
    await this.addPasswordToHistory(userId, simpleHash, changeReason);

    await this.logPasswordAudit(userId, userData.org_id, 'password_changed', userId, {
      change_reason: changeReason,
    });

    return { success: true };
  }

  static async forcePasswordChangeOnNextLogin(userId: string, adminId: string): Promise<void> {
    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', userId)
      .single();

    await supabase
      .from('users')
      .update({ must_change_password: true })
      .eq('id', userId);

    if (userData) {
      await this.logPasswordAudit(userId, userData.org_id, 'forced_change_required', adminId, {
        triggered_by: adminId,
      });
    }
  }

  static getPasswordStrength(password: string): {
    score: number;
    label: 'weak' | 'fair' | 'good' | 'strong';
    color: string;
  } {
    let score = 0;

    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

    if (score <= 2) return { score, label: 'weak', color: '#EF4444' };
    if (score <= 4) return { score, label: 'fair', color: '#F59E0B' };
    if (score <= 5) return { score, label: 'good', color: '#3B82F6' };
    return { score, label: 'strong', color: '#10B981' };
  }
}
