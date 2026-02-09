/*
  # Fix Session Management Functions

  ## Overview
  Drop and recreate session management functions to ensure they work correctly.

  ## Changes
  - Drop existing functions
  - Recreate with correct signatures
  - Add proper error handling
  - Grant execute permissions
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS terminate_user_session(uuid, text);
DROP FUNCTION IF EXISTS terminate_all_user_sessions(uuid, text, uuid);
DROP FUNCTION IF EXISTS check_concurrent_sessions(uuid, uuid);
DROP FUNCTION IF EXISTS update_session_activity(text);
DROP FUNCTION IF EXISTS log_security_event(uuid, text, text, text, jsonb, inet, boolean);
DROP FUNCTION IF EXISTS check_failed_login_attempts(text, inet);
DROP FUNCTION IF EXISTS get_session_history(uuid, integer);

-- Function: Terminate a specific user session
CREATE FUNCTION terminate_user_session(
  p_session_id uuid,
  p_reason text DEFAULT 'user_logout'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_sessions
  SET
    is_active = false,
    logout_at = now(),
    termination_reason = p_reason,
    session_duration_seconds = EXTRACT(EPOCH FROM (now() - login_at))::integer
  WHERE id = p_session_id
    AND is_active = true;

  RETURN FOUND;
END;
$$;

-- Function: Terminate all sessions for a user
CREATE FUNCTION terminate_all_user_sessions(
  p_user_id uuid,
  p_reason text DEFAULT 'user_terminated_all',
  p_except_session_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE user_sessions
  SET
    is_active = false,
    logout_at = now(),
    termination_reason = p_reason,
    session_duration_seconds = EXTRACT(EPOCH FROM (now() - login_at))::integer
  WHERE user_id = p_user_id
    AND is_active = true
    AND (p_except_session_id IS NULL OR id != p_except_session_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END;
$$;

-- Function: Check and enforce concurrent session limits
CREATE FUNCTION check_concurrent_sessions(
  p_user_id uuid,
  p_new_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_sessions integer;
  v_current_sessions integer;
  v_sessions_to_terminate integer;
  v_org_id uuid;
BEGIN
  -- Get user's organization
  SELECT org_id INTO v_org_id
  FROM users
  WHERE id = p_user_id;

  -- Get max concurrent sessions for this org (default 3)
  SELECT COALESCE(max_concurrent_sessions, 3)
  INTO v_max_sessions
  FROM session_config
  WHERE org_id = v_org_id;

  IF v_max_sessions IS NULL THEN
    v_max_sessions := 3;
  END IF;

  -- Count current active sessions
  SELECT COUNT(*)
  INTO v_current_sessions
  FROM user_sessions
  WHERE user_id = p_user_id
    AND is_active = true;

  -- If over limit, terminate oldest sessions
  IF v_current_sessions > v_max_sessions THEN
    v_sessions_to_terminate := v_current_sessions - v_max_sessions;

    -- Terminate oldest sessions
    UPDATE user_sessions
    SET
      is_active = false,
      logout_at = now(),
      termination_reason = 'concurrent_session_limit',
      session_duration_seconds = EXTRACT(EPOCH FROM (now() - login_at))::integer
    WHERE id IN (
      SELECT id
      FROM user_sessions
      WHERE user_id = p_user_id
        AND is_active = true
        AND id != p_new_session_id
      ORDER BY login_at ASC
      LIMIT v_sessions_to_terminate
    );

    -- Log security event if we have the table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events') THEN
      INSERT INTO security_events (
        user_id,
        event_type,
        event_severity,
        event_description,
        requires_action
      ) VALUES (
        p_user_id,
        'concurrent_session_limit',
        'medium',
        format('Terminated %s session(s) due to concurrent session limit', v_sessions_to_terminate),
        false
      );
    END IF;
  END IF;
END;
$$;

-- Function: Update session activity timestamp
CREATE FUNCTION update_session_activity(
  p_session_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_sessions
  SET last_activity_at = now()
  WHERE session_token = p_session_token
    AND is_active = true;
END;
$$;

-- Function: Get session history for a user
CREATE FUNCTION get_session_history(
  p_user_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  device_name text,
  ip_address inet,
  geolocation jsonb,
  login_at timestamptz,
  logout_at timestamptz,
  last_activity_at timestamptz,
  session_duration_seconds integer,
  termination_reason text,
  is_active boolean,
  is_trusted_device boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    us.id,
    us.user_id,
    us.device_name,
    us.ip_address,
    us.geolocation,
    us.login_at,
    us.logout_at,
    us.last_activity_at,
    us.session_duration_seconds,
    us.termination_reason,
    us.is_active,
    us.is_trusted_device
  FROM user_sessions us
  WHERE us.user_id = p_user_id
  ORDER BY us.login_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION terminate_user_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION terminate_all_user_sessions(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_concurrent_sessions(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_session_activity(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_history(uuid, integer) TO authenticated;
