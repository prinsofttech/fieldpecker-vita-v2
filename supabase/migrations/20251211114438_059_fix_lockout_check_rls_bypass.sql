/*
  # Fix Lockout Check RLS Bypass

  ## Problem
  The lockout check at login-attempt-service.ts:122-129 uses a direct query to 
  login_attempts table, which is blocked by RLS for anonymous users. This causes 
  the lockout check to fail silently:
  
  - Line 117: RPC get_recent_login_attempts() works (SECURITY DEFINER)
  - Line 122: Direct query to login_attempts fails (RLS blocks anonymous)
  - Result: lastAttempt = null, lockout bypassed
  
  User logs show:
  - [LOCKOUT] Recent failed attempts: 5 / 5
  - [LOCKOUT] Max attempts reached, checking last attempt time...
  - [LOCKOUT] ✓ NOT LOCKED - Login allowed  ← BUG!

  ## Solution
  Create a secure RPC function that returns the last failed attempt timestamp
  using SECURITY DEFINER to bypass RLS. This ensures anonymous users during 
  login can check lockout status without direct table access.

  ## Changes
  1. Create get_last_failed_login_attempt() RPC function
     - Returns timestamp of most recent failed attempt
     - Uses SECURITY DEFINER to bypass RLS
     - Only returns minimal data needed for lockout calculation
  2. Grant execute permission to anon and authenticated roles

  ## Security
  - Function only returns timestamp, no PII
  - Scoped to single email lookup
  - Cannot be used to enumerate users
*/

-- Create secure function to get last failed attempt timestamp
CREATE OR REPLACE FUNCTION get_last_failed_login_attempt(p_email text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_attempt timestamptz;
BEGIN
  SELECT created_at INTO v_last_attempt
  FROM login_attempts
  WHERE email = p_email
    AND attempt_type = 'failure'
    AND created_at > now() - interval '15 minutes'
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_last_attempt;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_last_failed_login_attempt(text) TO anon;
GRANT EXECUTE ON FUNCTION get_last_failed_login_attempt(text) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION get_last_failed_login_attempt IS 
'Securely gets timestamp of last failed login attempt for lockout calculation. Bypasses RLS for anonymous users during login flow.';
