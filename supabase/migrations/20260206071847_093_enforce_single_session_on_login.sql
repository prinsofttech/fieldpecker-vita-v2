/*
  # Enforce single session on login when multiple devices is disabled

  1. New Functions
    - `enforce_session_policy(p_user_id uuid, p_new_session_id uuid)` 
      - Checks the user's org session_config for allow_multiple_devices / max_concurrent_sessions
      - When allow_multiple_devices is false, terminates ALL other active sessions for the user
      - When allow_multiple_devices is true, enforces max_concurrent_sessions by terminating oldest sessions
      - Returns JSON with: terminated_count, policy_applied, allow_multiple_devices

  2. Purpose
    - Automatically log out older sessions when a user logs in and multi-device is disabled
    - Enforce max concurrent session limits when multi-device is enabled
    - Called from the frontend session service after creating a new session

  3. Security
    - Function is SECURITY DEFINER to bypass RLS for cross-session termination
    - Only terminates sessions belonging to the same user
*/

CREATE OR REPLACE FUNCTION enforce_session_policy(
  p_user_id uuid,
  p_new_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
  v_allow_multiple boolean;
  v_max_sessions integer;
  v_terminated integer := 0;
  v_excess_count integer;
BEGIN
  SELECT org_id INTO v_org_id FROM users WHERE id = p_user_id;
  
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'terminated_count', 0,
      'policy_applied', false,
      'error', 'User not found'
    );
  END IF;

  SELECT 
    COALESCE(sc.allow_multiple_devices, true),
    COALESCE(sc.max_concurrent_sessions, 3)
  INTO v_allow_multiple, v_max_sessions
  FROM session_config sc
  WHERE sc.org_id = v_org_id;

  IF NOT FOUND THEN
    v_allow_multiple := true;
    v_max_sessions := 3;
  END IF;

  IF NOT v_allow_multiple THEN
    v_max_sessions := 1;
  END IF;

  SELECT COUNT(*) INTO v_excess_count
  FROM user_sessions
  WHERE user_id = p_user_id
    AND is_active = true
    AND id != p_new_session_id;

  IF v_excess_count >= v_max_sessions THEN
    WITH sessions_to_terminate AS (
      SELECT id
      FROM user_sessions
      WHERE user_id = p_user_id
        AND is_active = true
        AND id != p_new_session_id
      ORDER BY last_activity_at ASC
      LIMIT (v_excess_count - v_max_sessions + 1)
    )
    UPDATE user_sessions
    SET 
      is_active = false,
      logout_at = now(),
      termination_reason = CASE 
        WHEN NOT v_allow_multiple THEN 'new_login_single_device'
        ELSE 'max_sessions_exceeded'
      END,
      session_duration_seconds = EXTRACT(EPOCH FROM (now() - login_at))::integer
    WHERE id IN (SELECT id FROM sessions_to_terminate);

    GET DIAGNOSTICS v_terminated = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'terminated_count', v_terminated,
    'policy_applied', true,
    'allow_multiple_devices', v_allow_multiple,
    'max_sessions', v_max_sessions
  );
END;
$$;
