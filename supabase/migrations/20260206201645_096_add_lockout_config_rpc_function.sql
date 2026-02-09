/*
  # Add lockout config RPC function for login flow

  1. New Functions
    - `get_lockout_config(user_email text)` - Returns the lockout settings for the user's organization
      - `max_attempts` (integer) - Max failed login attempts before lockout
      - `lockout_duration_minutes` (integer) - How long the account stays locked (in minutes)
    - This function is SECURITY DEFINER so it can be called by anonymous users during login
    - Falls back to sensible defaults (5 attempts, 15 minutes) if no config exists

  2. Security
    - Function uses SECURITY DEFINER to bypass RLS for anonymous login flow
    - Only returns lockout config values, never user data
    - Granted to both anon and authenticated roles

  3. Purpose
    - Allows LoginAttemptService to read admin-configured lockout settings from session_config table
    - Eliminates hardcoded lockout constants in the frontend code
    - Makes admin SessionConfigManager settings actually take effect at login time
*/

CREATE OR REPLACE FUNCTION get_lockout_config(user_email text)
RETURNS TABLE(max_attempts integer, lockout_duration_minutes integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT u.org_id INTO v_org_id
  FROM users u
  WHERE u.email = user_email
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN QUERY SELECT 5::integer AS max_attempts, 15::integer AS lockout_duration_minutes;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(sc.auto_lock_after_failed_attempts, 5)::integer AS max_attempts,
    COALESCE(sc.lockout_duration_minutes, 15)::integer AS lockout_duration_minutes
  FROM session_config sc
  WHERE sc.org_id = v_org_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 5::integer AS max_attempts, 15::integer AS lockout_duration_minutes;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_lockout_config(text) TO anon;
GRANT EXECUTE ON FUNCTION get_lockout_config(text) TO authenticated;
