/*
  # Create Admin Function for User Creation

  1. Purpose
    - Provide a secure way for admins to create users
    - Bypass RLS issues by using SECURITY DEFINER
    - Ensure proper validation and role checking

  2. Solution
    - Create a function that super admins can call to create users
    - Function has SECURITY DEFINER so it bypasses RLS
    - Function validates permissions using JWT claims

  3. Changes
    - Create admin_create_user() function
    - Grant execute to authenticated users
*/

-- Function for admins to create users (bypasses RLS)
CREATE OR REPLACE FUNCTION admin_create_user(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_org_id uuid,
  p_role_id uuid
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
  
  -- Get the role name for the new user
  SELECT name INTO v_new_role_name FROM roles WHERE id = p_role_id;
  
  -- Prevent creating super admins
  IF v_new_role_name = 'super_admin' AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: Cannot create super admin users';
  END IF;
  
  -- Insert the user
  INSERT INTO users (id, email, full_name, org_id, role_id, status)
  VALUES (p_user_id, p_email, p_full_name, p_org_id, p_role_id, 'active');
  
  -- Return success
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
GRANT EXECUTE ON FUNCTION admin_create_user(uuid, text, text, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION admin_create_user IS 'Allows admins to create users in their organization. Super admins can create users in any organization.';
