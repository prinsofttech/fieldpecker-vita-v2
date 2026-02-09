/*
  # Add server-side session idle check function

  1. New Functions
    - `check_session_idle_status` - Returns session status with idle seconds computed server-side
      - Avoids client/server clock skew causing premature logouts
      - Returns idle_seconds, timeout_seconds, is_active, and remaining_seconds

  2. Purpose
    - Fix bug where client clock being ahead of server clock caused immediate logout
    - All time comparisons now use the database server's clock consistently
*/

CREATE OR REPLACE FUNCTION check_session_idle_status(p_session_id uuid)
RETURNS TABLE(
  is_active boolean,
  idle_seconds numeric,
  timeout_seconds numeric,
  remaining_seconds numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    us.is_active,
    EXTRACT(EPOCH FROM (now() - us.last_activity_at)) AS idle_seconds,
    (us.idle_timeout_minutes * 60)::numeric AS timeout_seconds,
    GREATEST(0, (us.idle_timeout_minutes * 60)::numeric - EXTRACT(EPOCH FROM (now() - us.last_activity_at))) AS remaining_seconds
  FROM user_sessions us
  WHERE us.id = p_session_id;
$$;

GRANT EXECUTE ON FUNCTION check_session_idle_status(uuid) TO authenticated;
