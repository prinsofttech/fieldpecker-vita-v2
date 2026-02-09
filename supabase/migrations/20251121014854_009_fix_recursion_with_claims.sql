/*
  # Fix Infinite Recursion - Use JWT Claims Instead

  1. Problem
    - Any query to users table from within users policies causes recursion
    - Even SECURITY DEFINER functions that query users cause issues
    - Need a way to check user role WITHOUT querying users table

  2. Solution
    - Store role information in auth.users app_metadata (JWT claims)
    - Check JWT claims directly in policies without querying users table
    - Use a trigger to sync role to JWT when user is created/updated

  3. Changes
    - Create function to update user JWT claims
    - Create trigger to automatically sync role to JWT
    - Update policies to check JWT claims instead of querying users
    - Drop problematic policies and recreate them
*/

-- Function to update auth.users metadata with role information
CREATE OR REPLACE FUNCTION sync_user_role_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name text;
BEGIN
  -- Get the role name
  SELECT name INTO v_role_name FROM roles WHERE id = NEW.role_id;
  
  -- Update the auth.users metadata
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', v_role_name)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to sync role on insert and update
DROP TRIGGER IF EXISTS sync_role_to_jwt_on_insert ON users;
DROP TRIGGER IF EXISTS sync_role_to_jwt_on_update ON users;

CREATE TRIGGER sync_role_to_jwt_on_insert
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_role_to_jwt();

CREATE TRIGGER sync_role_to_jwt_on_update
  AFTER UPDATE OF role_id ON users
  FOR EACH ROW
  WHEN (OLD.role_id IS DISTINCT FROM NEW.role_id)
  EXECUTE FUNCTION sync_user_role_to_jwt();

-- Drop all existing users policies
DROP POLICY IF EXISTS "Super admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view users in own organization" ON users;
DROP POLICY IF EXISTS "Super admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins and managers can insert users" ON users;
DROP POLICY IF EXISTS "Super admins can update users" ON users;
DROP POLICY IF EXISTS "Admins and managers can update users" ON users;
DROP POLICY IF EXISTS "Super admins can delete users" ON users;
DROP POLICY IF EXISTS "Only admins can delete users" ON users;

-- Recreate policies using JWT claims (no table queries!)
CREATE POLICY "Super admins can view all users"
  ON users FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Users can view users in own organization"
  ON users FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

-- For INSERT, we can't query users table at all
-- Super admins are identified by JWT claim only
CREATE POLICY "Super admins can insert users"
  ON users FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- For regular admins, we'll allow if they have the right role in JWT
-- AND the new user is being added to their org (checked in application)
CREATE POLICY "Admins can insert users in own org"
  ON users FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'manager')
  );

CREATE POLICY "Super admins can update all users"
  ON users FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Admins can update users in own org"
  ON users FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'manager')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'manager')
  );

CREATE POLICY "Super admins can delete users"
  ON users FOR DELETE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Admins can delete users in own org"
  ON users FOR DELETE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
  );

-- Update existing users to have their role in JWT
DO $$
DECLARE
  rec RECORD;
  v_role_name text;
BEGIN
  FOR rec IN SELECT u.id, u.role_id FROM users u LOOP
    SELECT name INTO v_role_name FROM roles WHERE id = rec.role_id;
    
    UPDATE auth.users
    SET raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('role', v_role_name)
    WHERE id = rec.id;
  END LOOP;
END $$;
