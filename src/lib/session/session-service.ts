import { supabase } from '../supabase/client';
import { getDeviceFingerprint } from './device-fingerprint';

export interface SessionData {
  id: string;
  user_id: string;
  session_token?: string;
  device_name: string;
  ip_address: string;
  geolocation?: any;
  login_at: string;
  last_activity_at: string;
  logout_at?: string;
  session_duration_seconds?: number;
  termination_reason?: string;
  is_active: boolean;
  is_trusted_device: boolean;
}

export interface SecurityEvent {
  id: string;
  event_type: string;
  event_severity: string;
  event_description: string;
  created_at: string;
  ip_address?: string;
  requires_action: boolean;
}

export class SessionService {
  private static sessionCheckInterval: number | null = null;
  private static activityUpdateInterval: number | null = null;
  private static realtimeChannel: any = null;
  private static currentSessionId: string | null = null;
  private static sessionCheckFailures: number = 0;
  private static idleTimeoutMinutes: number = 30;
  private static lastActivityTimestamp: number = Date.now();
  private static idleWarningShown: boolean = false;
  private static readonly IDLE_WARNING_SECONDS = 15;

  static async createSession(userId: string): Promise<string | null> {
    console.log('[SESSION] ========================================');
    console.log('[SESSION] SESSION CREATION STARTING');
    console.log('[SESSION] User ID:', userId);
    console.log('[SESSION] Timestamp:', new Date().toISOString());
    console.log('[SESSION] ========================================');

    try {
      console.log('[SESSION] Step 1: Getting auth session...');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.error('[SESSION] ❌ No auth session found');
        return null;
      }

      console.log('[SESSION] ✓ Auth session found');
      console.log('[SESSION] Token length:', session.access_token?.length);
      console.log('[SESSION] Token expires:', session.expires_at);

      console.log('[SESSION] Step 2: Fetching user org_id...');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', userId)
        .maybeSingle();

      if (userError) {
        console.error('[SESSION] ❌ Database error fetching user org_id:', userError);
        console.error('[SESSION] Error code:', userError.code);
        console.error('[SESSION] Error message:', userError.message);
        console.error('[SESSION] Error details:', userError.details);
        return null;
      }

      if (!userData) {
        console.error('[SESSION] ❌ No user data returned');
        return null;
      }

      if (!userData.org_id) {
        console.error('[SESSION] ❌ User has no org_id');
        return null;
      }

      console.log('[SESSION] ✓ User org_id fetched:', userData.org_id);

      console.log('[SESSION] Step 3: Checking for existing session...');
      const { data: existingSession, error: existingError } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('session_token', session.access_token)
        .eq('is_active', true)
        .maybeSingle();

      if (existingError) {
        console.error('[SESSION] ⚠️ Error checking existing session:', existingError);
      }

      if (existingSession) {
        console.log('[SESSION] ✓ Existing session found, reusing:', existingSession.id);
        return existingSession.id;
      }

      console.log('[SESSION] No existing session found, creating new one');

      console.log('[SESSION] Step 4: Gathering device/IP data...');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );

      let fingerprint, ipAddress, geolocation;

      try {
        [fingerprint, ipAddress] = await Promise.race([
          Promise.all([
            getDeviceFingerprint(),
            this.getIPAddress()
          ]),
          timeoutPromise
        ]) as [any, string];

        console.log('[SESSION] ✓ Device fingerprint obtained:', fingerprint?.browser?.name, fingerprint?.os?.name);
        console.log('[SESSION] ✓ IP Address obtained:', ipAddress);

        geolocation = await Promise.race([
          this.getGeolocation(ipAddress).catch(() => ({ city: 'Unknown', country: 'Unknown' })),
          new Promise(resolve => setTimeout(() => resolve({ city: 'Unknown', country: 'Unknown' }), 3000))
        ]);
        console.log('[SESSION] ✓ Geolocation obtained:', geolocation);
      } catch (error) {
        console.warn('[SESSION] ⚠️ Failed to fetch device/IP data, using defaults:', error);
        fingerprint = { browser: { name: 'Unknown' }, os: { name: 'Unknown' } };
        ipAddress = '0.0.0.0';
        geolocation = { city: 'Unknown', country: 'Unknown' };
      }

      const sessionData = {
        user_id: userId,
        org_id: userData.org_id,
        session_token: session.access_token,
        device_fingerprint: fingerprint,
        device_name: this.getDeviceName(fingerprint),
        ip_address: ipAddress,
        geolocation,
        is_active: true,
      };

      console.log('[SESSION] Step 5: Inserting session into database...');
      console.log('[SESSION] Session data:', {
        user_id: sessionData.user_id,
        org_id: sessionData.org_id,
        device_name: sessionData.device_name,
        ip_address: sessionData.ip_address,
        token_length: sessionData.session_token?.length
      });

      const { data, error } = await supabase
        .from('user_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (error) {
        console.error('[SESSION] ❌ Database error creating session:', error);
        console.error('[SESSION] Error code:', error.code);
        console.error('[SESSION] Error message:', error.message);
        console.error('[SESSION] Error details:', error.details);
        console.error('[SESSION] Error hint:', error.hint);
        console.error('[SESSION] Full error:', JSON.stringify(error, null, 2));
        return null;
      }

      console.log('[SESSION] ========================================');
      console.log('[SESSION] ✓✓✓ SESSION CREATED SUCCESSFULLY ✓✓✓');
      console.log('[SESSION] Session ID:', data.id);
      console.log('[SESSION] ========================================');

      this.checkTrustedDevice(userId, fingerprint).catch(e =>
        console.warn('[SESSION] Trusted device check failed (non-critical):', e)
      );

      console.log('[SESSION] Step 6: Enforcing session policy...');
      try {
        const { data: policyResult, error: policyError } = await supabase.rpc('enforce_session_policy', {
          p_user_id: userId,
          p_new_session_id: data.id
        });

        if (policyError) {
          console.warn('[SESSION] Session policy enforcement error:', policyError);
        } else {
          console.log('[SESSION] Session policy result:', policyResult);
          if (policyResult?.terminated_count > 0) {
            console.log(`[SESSION] Terminated ${policyResult.terminated_count} older session(s)`);
          }
        }
      } catch (policyErr) {
        console.warn('[SESSION] Session policy enforcement failed (non-critical):', policyErr);
      }

      return data.id;
    } catch (error) {
      console.error('[SESSION] ========================================');
      console.error('[SESSION] ❌❌❌ SESSION CREATION FAILED ❌❌❌');
      console.error('[SESSION] Error:', error);
      console.error('[SESSION] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('[SESSION] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[SESSION] Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('[SESSION] ========================================');
      return null;
    }
  }

  static async terminateSession(sessionId: string, reason: string = 'user_logout'): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('terminate_user_session', {
        p_session_id: sessionId,
        p_reason: reason
      });

      return !error && data;
    } catch (error) {
      console.error('Error terminating session:', error);
      return false;
    }
  }

  static async terminateAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('terminate_all_user_sessions', {
        p_user_id: userId,
        p_reason: 'user_terminated_all',
        p_except_session_id: exceptSessionId || null
      });

      return error ? 0 : data;
    } catch (error) {
      console.error('Error terminating all sessions:', error);
      return 0;
    }
  }

  static async updateActivity(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.rpc('update_session_activity', {
        p_session_token: session.access_token
      });
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  }

  static async getActiveSessions(userId: string): Promise<SessionData[]> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('login_at', { ascending: false });

      return error ? [] : data || [];
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      return [];
    }
  }

  static async getSessionHistory(userId: string, limit: number = 50): Promise<SessionData[]> {
    try {
      const { data, error } = await supabase.rpc('get_session_history', {
        p_user_id: userId,
        p_limit: limit
      });

      return error ? [] : data || [];
    } catch (error) {
      console.error('Error fetching session history:', error);
      return [];
    }
  }

  static async getSecurityEvents(userId: string): Promise<SecurityEvent[]> {
    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      return error ? [] : data || [];
    } catch (error) {
      console.error('Error fetching security events:', error);
      return [];
    }
  }

  static async logFailedLogin(email: string, reason: string): Promise<void> {
    try {
      const fingerprint = await getDeviceFingerprint();
      const ipAddress = await this.getIPAddress();
      const geolocation = await this.getGeolocation(ipAddress);

      await supabase.from('failed_login_attempts').insert({
        email_attempted: email,
        device_fingerprint: fingerprint,
        failure_reason: reason,
        ip_address: ipAddress,
        geolocation,
        attempted_at: new Date().toISOString()
      });

      const { data } = await supabase.rpc('check_failed_login_attempts', {
        p_email: email,
        p_ip_address: ipAddress
      });

      if (data?.is_locked) {
        throw new Error(`Account locked. Too many failed attempts. Try again later.`);
      }
    } catch (error) {
      throw error;
    }
  }

  static startActivityTracking(): void {
    if (this.activityUpdateInterval) return;

    this.lastActivityTimestamp = Date.now();
    this.updateActivity();

    const trackActivity = () => {
      this.lastActivityTimestamp = Date.now();
    };

    const throttledUpdate = this.throttle(() => {
      trackActivity();
      this.updateActivity();
    }, 30000);

    document.addEventListener('mousemove', throttledUpdate);
    document.addEventListener('keydown', throttledUpdate);
    document.addEventListener('click', throttledUpdate);

    document.addEventListener('mousemove', trackActivity, { passive: true });
    document.addEventListener('keydown', trackActivity, { passive: true });
    document.addEventListener('click', trackActivity, { passive: true });
  }

  static stopActivityTracking(): void {
    if (this.activityUpdateInterval) {
      clearInterval(this.activityUpdateInterval);
      this.activityUpdateInterval = null;
    }
  }

  static async startSessionMonitoring(sessionId?: string): Promise<void> {
    console.log('[MONITOR] ========================================');
    console.log('[MONITOR] SESSION MONITORING STARTING');
    console.log('[MONITOR] Session ID:', sessionId);
    console.log('[MONITOR] Timestamp:', new Date().toISOString());
    console.log('[MONITOR] ========================================');

    if (this.sessionCheckInterval) {
      console.log('[MONITOR] ⚠️ Session monitoring already active, skipping');
      return;
    }

    // Store current session ID
    if (sessionId) {
      this.currentSessionId = sessionId;
      console.log('[MONITOR] ✓ Current session ID stored:', sessionId);
    } else {
      console.log('[MONITOR] ⚠️ No session ID provided to monitor');
    }

    await this.loadIdleTimeout();
    this.lastActivityTimestamp = Date.now();

    console.log('[MONITOR] Waiting 2 seconds before starting monitoring...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('[MONITOR] ✓ Wait complete, starting monitoring');

    // Set up realtime listener for session changes
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log('[MONITOR] Setting up realtime listener for user:', user.id);
      this.realtimeChannel = supabase
        .channel('session-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_sessions',
            filter: `user_id=eq.${user.id}`
          },
          async (payload) => {
            console.log('[MONITOR] ⚡ Session update detected via realtime:', payload);
            // If any session for this user is marked inactive, check if it's the current one
            if (payload.new.is_active === false) {
              console.log('[MONITOR] Session marked inactive:', payload.new.id);
              // If we have a session ID and it matches the deactivated one, log out immediately
              if (this.currentSessionId && payload.new.id === this.currentSessionId) {
                console.log('[MONITOR] ❌ Current session was terminated by admin, logging out...');
                await this.handleSessionTermination();
              } else {
                console.log('[MONITOR] Inactive session is not current session, ignoring');
              }
            }
          }
        )
        .subscribe();

      console.log('[MONITOR] ✓ Realtime listener subscribed');
    } else {
      console.warn('[MONITOR] ⚠️ No user found for realtime monitoring');
    }

    console.log('[MONITOR] ✓ Starting periodic check (every 5 seconds)');

    this.sessionCheckInterval = window.setInterval(async () => {
      const idleMs = Date.now() - this.lastActivityTimestamp;
      const idleLimitMs = this.idleTimeoutMinutes * 60 * 1000;
      const warningMs = idleLimitMs - this.IDLE_WARNING_SECONDS * 1000;

      if (idleMs >= idleLimitMs) {
        this.idleWarningShown = false;
        window.dispatchEvent(new CustomEvent('idle-timeout-expired'));
        console.log(`[MONITOR] Idle timeout reached (${Math.round(idleMs / 60000)}m idle, limit ${this.idleTimeoutMinutes}m)`);
        if (this.currentSessionId) {
          await this.terminateSession(this.currentSessionId, 'idle_timeout');
        }
        await this.handleSessionTermination();
        return;
      }

      if (idleMs >= warningMs && !this.idleWarningShown) {
        this.idleWarningShown = true;
        const remainingSec = Math.round((idleLimitMs - idleMs) / 1000);
        window.dispatchEvent(new CustomEvent('idle-timeout-warning', {
          detail: { remainingSeconds: remainingSec }
        }));
      }

      if (idleMs < warningMs && this.idleWarningShown) {
        this.idleWarningShown = false;
        window.dispatchEvent(new CustomEvent('idle-timeout-dismissed'));
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('[MONITOR] No auth session found, logging out');
        await this.handleSessionTermination();
        return;
      }

      if (this.currentSessionId) {
        const { data: sessionData, error: sessionError } = await supabase
          .from('user_sessions')
          .select('is_active')
          .eq('id', this.currentSessionId)
          .maybeSingle();

        if (sessionError) {
          this.sessionCheckFailures++;
          if (this.sessionCheckFailures >= 6) {
            console.warn(`[MONITOR] Session check has failed ${this.sessionCheckFailures} times consecutively`);
          }
          return;
        }

        this.sessionCheckFailures = 0;

        if (sessionData && sessionData.is_active === false) {
          console.log('[MONITOR] Session was deactivated by administrator, logging out');
          await this.handleSessionTermination();
          return;
        }
      }
    }, 5000);
  }

  static stopSessionMonitoring(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    this.currentSessionId = null;
    this.sessionCheckFailures = 0;
  }

  static dismissIdleWarning(): void {
    this.lastActivityTimestamp = Date.now();
    this.idleWarningShown = false;
    this.updateActivity();
  }

  static async forceLogout(): Promise<void> {
    if (this.currentSessionId) {
      await this.terminateSession(this.currentSessionId, 'user_logout');
    }
    await this.handleSessionTermination();
  }

  private static async loadIdleTimeout(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userData?.org_id) return;

      const { data: config } = await supabase
        .from('session_config')
        .select('idle_timeout_minutes')
        .eq('org_id', userData.org_id)
        .maybeSingle();

      if (config?.idle_timeout_minutes) {
        this.idleTimeoutMinutes = config.idle_timeout_minutes;
        console.log(`[MONITOR] Org idle timeout loaded: ${this.idleTimeoutMinutes} minutes`);
      } else {
        this.idleTimeoutMinutes = 30;
        console.log('[MONITOR] No org config found, using default: 30 minutes');
      }
    } catch (err) {
      console.warn('[MONITOR] Failed to load idle timeout config, using default:', err);
      this.idleTimeoutMinutes = 30;
    }
  }

  private static async handleSessionTermination(): Promise<void> {
    try {
      // Stop all monitoring
      this.stopSessionMonitoring();
      this.stopActivityTracking();

      // Sign out from Supabase auth
      await supabase.auth.signOut();

      // Redirect to login
      window.location.href = '/';
    } catch (error) {
      console.error('Error during session termination:', error);
      // Force redirect anyway
      window.location.href = '/';
    }
  }

  private static async checkTrustedDevice(userId: string, fingerprint: any): Promise<void> {
    try {
      const fingerprintHash = await this.hashFingerprint(fingerprint);

      const { data: existingDevice } = await supabase
        .from('trusted_devices')
        .select('*')
        .eq('user_id', userId)
        .eq('device_fingerprint_hash', fingerprintHash)
        .eq('is_active', true)
        .maybeSingle();

      if (!existingDevice) {
        await supabase.rpc('log_security_event', {
          p_user_id: userId,
          p_event_type: 'new_device_login',
          p_event_severity: 'medium',
          p_description: 'Login from new device detected',
          p_metadata: { device: fingerprint },
          p_ip_address: await this.getIPAddress()
        });
      } else {
        await supabase
          .from('trusted_devices')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', existingDevice.id);
      }
    } catch (error) {
      console.error('Error checking trusted device:', error);
    }
  }

  private static async getIPAddress(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error('IP fetch failed');

      const data = await response.json();

      if (data.ip && data.ip !== '0.0.0.0') {
        return data.ip;
      }

      // Fallback to alternative service
      const fallbackResponse = await fetch('https://api.my-ip.io/ip', {
        headers: { 'Accept': 'text/plain' }
      });
      const fallbackIP = await fallbackResponse.text();
      return fallbackIP.trim() || '0.0.0.0';
    } catch (error) {
      console.error('Failed to fetch IP address:', error);
      return '0.0.0.0';
    }
  }

  private static async getGeolocation(ip: string): Promise<any> {
    if (!ip || ip === '0.0.0.0') {
      return { city: 'Unknown', country: 'Unknown' };
    }

    try {
      const response = await fetch(`https://ipapi.co/${ip}/json/`);

      if (!response.ok) throw new Error('Geolocation fetch failed');

      const data = await response.json();

      return {
        country: data.country_name || 'Unknown',
        city: data.city || 'Unknown',
        region: data.region || '',
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        timezone: data.timezone || ''
      };
    } catch (error) {
      console.error('Failed to fetch geolocation:', error);
      return { city: 'Unknown', country: 'Unknown' };
    }
  }

  private static getDeviceName(fingerprint: any): string {
    const { browser, os } = fingerprint;
    return `${browser?.name || 'Unknown'} on ${os?.name || 'Unknown'}`;
  }

  private static async hashFingerprint(fingerprint: any): Promise<string> {
    const str = JSON.stringify(fingerprint);
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private static throttle(func: Function, limit: number) {
    let inThrottle: boolean;
    return function(this: any, ...args: any[]) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}
