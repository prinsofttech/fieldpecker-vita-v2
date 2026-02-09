/*
  # Update admin_create_user function to support supervisor_code
  
  1. Changes
    - Add `p_supervisor_code` parameter to admin_create_user function
    - Update INSERT statement to include supervisor_code
  
  2. Purpose
    - Enable setting supervisor codes when creating users
    - Support field supervisor and field agent workflows
  
  3. Notes
    - Parameter is optional (DEFAULT NULL)
    - Only relevant for field_supervisor and field_agent roles
*/

-- Drop existing function
DROP FUNCTION IF EXISTS admin_create_user(uuid, text, text, uuid, uuid, uuid);

-- Recreate with supervisor_code parameter
CREATE OR REPLACE FUNCTION admin_create_user(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_org_id uuid,
  p_role_id uuid,
  p_reports_to_user_id uuid DEFAULT NULL,
  p_supervisor_code text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_caller_org_id uuid;
  v_new_role_name text;
BEGIN
  -- Get caller's role from JWT
  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
  
  -- Check if caller is authorized
  IF v_caller_role NOT IN ('super_admin', 'client_admin', 'manager') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can create users';
  END IF;
  
  -- If not super admin, verify they're creating user in their own org
  IF v_caller_role != 'super_admin' THEN
    SELECT org_id INTO v_caller_org_id FROM users WHERE id = auth.uid();
    IF v_caller_org_id != p_org_id THEN
      RAISE EXCEPTION 'Unauthorized: Can only create users in your own organization';
    END IF;
  END IF;
  
  -- Get the role name being assigned
  SELECT name INTO v_new_role_name FROM roles WHERE id = p_role_id;
  
  -- Insert the new user
  INSERT INTO users (
    id,
    org_id,
    role_id,
    email,
    full_name,
    status,
    created_by,
    reports_to_user_id,
    supervisor_code,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_org_id,
    p_role_id,
    p_email,
    p_full_name,
    'active',
    auth.uid(),
    p_reports_to_user_id,
    p_supervisor_code,
    now(),
    now()
  );
  
  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION admin_create_user TO authenticated;