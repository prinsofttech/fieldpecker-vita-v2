/*
  # Super Admin RLS Policies
  
  1. Purpose
    - Grant super admins full access to all organizations
    - Allow super admins to create new organizations
    - Allow super admins to manage all users across all organizations
    - Maintain existing client-level access controls
  
  2. Changes
    - Update organizations policies for super admin access
    - Update users policies for super admin management
    - Update org_modules policies for super admin control
    - Update audit_logs policies for super admin visibility
    - Add helper function to check if user is super admin
  
  3. Security
    - Super admins bypass org-level restrictions
    - Super admins can see and manage all data
    - Regular users remain restricted to their organization
*/

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u 
    JOIN roles r ON u.role_id = r.id 
    WHERE u.id = p_user_id AND r.name = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations policies (updated for super admin)
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Only client admins can update organization" ON organizations;
CREATE POLICY "Only client admins can update organization"
  ON organizations FOR UPDATE TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin')
  )
  WITH CHECK (
    is_super_admin(auth.uid()) OR
    id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin')
  );

-- Add policy for super admins to create organizations
DROP POLICY IF EXISTS "Super admins can create organizations" ON organizations;
CREATE POLICY "Super admins can create organizations"
  ON organizations FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

-- Add policy for super admins to delete organizations
DROP POLICY IF EXISTS "Super admins can delete organizations" ON organizations;
CREATE POLICY "Super admins can delete organizations"
  ON organizations FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

-- Users policies (updated for super admin)
DROP POLICY IF EXISTS "Users can view users in own organization" ON users;
CREATE POLICY "Users can view users in own organization"
  ON users FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins and managers can insert users" ON users;
CREATE POLICY "Admins and managers can insert users"
  ON users FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin(auth.uid()) OR
    org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.level <= 3)
  );

DROP POLICY IF EXISTS "Admins and managers can update users" ON users;
CREATE POLICY "Admins and managers can update users"
  ON users FOR UPDATE TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.level <= 3)
  )
  WITH CHECK (
    is_super_admin(auth.uid()) OR
    org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.level <= 3)
  );

DROP POLICY IF EXISTS "Only admins can delete users" ON users;
CREATE POLICY "Only admins can delete users"
  ON users FOR DELETE TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin')
  );

-- Org modules policies (updated for super admin)
DROP POLICY IF EXISTS "Users can view own org modules" ON org_modules;
CREATE POLICY "Users can view own org modules"
  ON org_modules FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Only admins can manage org modules" ON org_modules;
CREATE POLICY "Only admins can manage org modules"
  ON org_modules FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin(auth.uid()) OR
    org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin')
  );

DROP POLICY IF EXISTS "Only admins can update org modules" ON org_modules;
CREATE POLICY "Only admins can update org modules"
  ON org_modules FOR UPDATE TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin')
  )
  WITH CHECK (
    is_super_admin(auth.uid()) OR
    org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin')
  );

DROP POLICY IF EXISTS "Only admins can delete org modules" ON org_modules;
CREATE POLICY "Only admins can delete org modules"
  ON org_modules FOR DELETE TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin')
  );

-- Audit logs policies (updated for super admin)
DROP POLICY IF EXISTS "Users can view own org audit logs" ON audit_logs;
CREATE POLICY "Users can view own org audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid()) OR
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Comment to document super admin access
COMMENT ON FUNCTION is_super_admin(uuid) IS 'Returns true if the given user has the super_admin role';
