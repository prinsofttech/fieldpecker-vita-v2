/*
  # Add Function to Get Organization Members

  1. Purpose
    - Allow users to view other users in their organization
    - Bypass RLS using SECURITY DEFINER to avoid recursion

  2. Changes
    - Create get_org_members() function
    - Returns users in the caller's organization
    - Super admins can pass an org_id parameter
*/

-- Function for users to get members of their organization
CREATE OR REPLACE FUNCTION get_org_members(p_org_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  org_id uuid,
  role_id uuid,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_user_org_id uuid;
BEGIN
  -- Get caller's role from JWT
  v_user_role := auth.jwt() -> 'app_metadata' ->> 'role';
  
  -- If super admin and org_id provided, return that org's members
  IF v_user_role = 'super_admin' AND p_org_id IS NOT NULL THEN
    RETURN QUERY
    SELECT u.id, u.email, u.full_name, u.org_id, u.role_id, u.status, u.created_at
    FROM users u
    WHERE u.org_id = p_org_id
    ORDER BY u.created_at DESC;
    RETURN;
  END IF;
  
  -- If super admin and no org_id, return all users
  IF v_user_role = 'super_admin' THEN
    RETURN QUERY
    SELECT u.id, u.email, u.full_name, u.org_id, u.role_id, u.status, u.created_at
    FROM users u
    ORDER BY u.created_at DESC;
    RETURN;
  END IF;
  
  -- For regular users, get their org_id
  SELECT u.org_id INTO v_user_org_id
  FROM users u
  WHERE u.id = auth.uid();
  
  -- Return members of their organization
  IF v_user_org_id IS NOT NULL THEN
    RETURN QUERY
    SELECT u.id, u.email, u.full_name, u.org_id, u.role_id, u.status, u.created_at
    FROM users u
    WHERE u.org_id = v_user_org_id
    ORDER BY u.created_at DESC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_org_members(uuid) TO authenticated;

COMMENT ON FUNCTION get_org_members IS 'Returns users in the caller organization. Super admins can pass org_id to view any org, or no param to view all users.';
