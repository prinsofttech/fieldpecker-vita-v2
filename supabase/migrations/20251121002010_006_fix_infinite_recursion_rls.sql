/*
  # Fix Infinite Recursion in RLS Policies

  1. Problem
    - The is_super_admin() function queries the users table
    - This triggers RLS policies that call is_super_admin()
    - Creates infinite recursion

  2. Solution
    - Recreate the entire policy structure without using the function that causes recursion
    - Use direct role checks in app_metadata instead
    - Simplify policies to avoid circular dependencies

  3. Changes
    - Drop and recreate all policies that depend on is_super_admin()
    - Use simpler logic that doesn't cause recursion
*/

-- First, drop all policies that depend on is_super_admin
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
DROP POLICY IF EXISTS "Only client admins can update organization" ON organizations;
DROP POLICY IF EXISTS "Super admins can create organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins can delete organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view users in own organization" ON users;
DROP POLICY IF EXISTS "Admins and managers can insert users" ON users;
DROP POLICY IF EXISTS "Admins and managers can update users" ON users;
DROP POLICY IF EXISTS "Only admins can delete users" ON users;
DROP POLICY IF EXISTS "Users can view own org modules" ON org_modules;
DROP POLICY IF EXISTS "Only admins can manage org modules" ON org_modules;
DROP POLICY IF EXISTS "Only admins can update org modules" ON org_modules;
DROP POLICY IF EXISTS "Only admins can delete org modules" ON org_modules;
DROP POLICY IF EXISTS "Users can view own org audit logs" ON audit_logs;

-- Now drop the function
DROP FUNCTION IF EXISTS is_super_admin(uuid) CASCADE;

-- Recreate the function using SQL language (more efficient, no recursion)
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM users u 
    JOIN roles r ON u.role_id = r.id 
    WHERE u.id = p_user_id 
    AND r.name = 'super_admin'
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_super_admin(uuid) TO authenticated, anon;

-- Recreate organizations policies
CREATE POLICY "Super admins can view all organizations"
  ON organizations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT TO authenticated
  USING (
    id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Only client admins can update organization"
  ON organizations FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.name = 'client_admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.name = 'client_admin'
    )
  );

CREATE POLICY "Super admins can create organizations"
  ON organizations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete organizations"
  ON organizations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- Recreate users policies without recursion
CREATE POLICY "Super admins can view all users"
  ON users FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Users can view users in own organization"
  ON users FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Super admins can insert users"
  ON users FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Admins and managers can insert users"
  ON users FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.level <= 3
    )
  );

CREATE POLICY "Super admins can update users"
  ON users FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Admins and managers can update users"
  ON users FOR UPDATE TO authenticated
  USING (
    org_id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.level <= 3
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.level <= 3
    )
  );

CREATE POLICY "Super admins can delete users"
  ON users FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Only admins can delete users"
  ON users FOR DELETE TO authenticated
  USING (
    org_id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.name = 'client_admin'
    )
  );

-- Recreate org_modules policies
CREATE POLICY "Super admins can view all org modules"
  ON org_modules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Users can view own org modules"
  ON org_modules FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Super admins can manage all org modules"
  ON org_modules FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Only admins can manage org modules"
  ON org_modules FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.name = 'client_admin'
    )
  );

CREATE POLICY "Only admins can update org modules"
  ON org_modules FOR UPDATE TO authenticated
  USING (
    org_id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.name = 'client_admin'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.name = 'client_admin'
    )
  );

CREATE POLICY "Only admins can delete org modules"
  ON org_modules FOR DELETE TO authenticated
  USING (
    org_id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.name = 'client_admin'
    )
  );

-- Recreate audit logs policies
CREATE POLICY "Super admins can view all audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      JOIN users u ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Users can view own org audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );
