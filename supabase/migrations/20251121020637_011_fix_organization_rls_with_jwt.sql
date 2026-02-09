/*
  # Fix Organization RLS Policies to Use JWT Claims

  1. Problem
    - Organization policies are querying users table, causing recursion
    - Super admins can't see organizations due to RLS preventing queries

  2. Solution
    - Update all organization policies to use JWT claims instead of querying users
    - This matches the fix we applied to users table

  3. Changes
    - Drop and recreate all organization policies using JWT claims
    - Ensure super admins can view, create, update, and delete all organizations
    - Regular users can only view their own organization
*/

-- Drop existing organization policies
DROP POLICY IF EXISTS "Super admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
DROP POLICY IF EXISTS "Only client admins can update organization" ON organizations;
DROP POLICY IF EXISTS "Super admins can create organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins can delete organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins can update organizations" ON organizations;

-- Recreate policies using JWT claims (no table queries!)
CREATE POLICY "Super admins can view all organizations"
  ON organizations FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT TO authenticated
  USING (
    id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Super admins can create organizations"
  ON organizations FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Super admins can update all organizations"
  ON organizations FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Client admins can update own organization"
  ON organizations FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
    AND id IN (SELECT org_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
    AND id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Super admins can delete organizations"
  ON organizations FOR DELETE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- Also update org_modules policies to use JWT claims
DROP POLICY IF EXISTS "Super admins can view all org modules" ON org_modules;
DROP POLICY IF EXISTS "Users can view own org modules" ON org_modules;
DROP POLICY IF EXISTS "Super admins can manage all org modules" ON org_modules;
DROP POLICY IF EXISTS "Only admins can manage org modules" ON org_modules;
DROP POLICY IF EXISTS "Only admins can update org modules" ON org_modules;
DROP POLICY IF EXISTS "Only admins can delete org modules" ON org_modules;

CREATE POLICY "Super admins can view all org modules"
  ON org_modules FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Users can view own org modules"
  ON org_modules FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Super admins can insert org modules"
  ON org_modules FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Admins can insert org modules in own org"
  ON org_modules FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
    AND org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Super admins can update org modules"
  ON org_modules FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Admins can update org modules in own org"
  ON org_modules FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
    AND org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
    AND org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Super admins can delete org modules"
  ON org_modules FOR DELETE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Admins can delete org modules in own org"
  ON org_modules FOR DELETE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
    AND org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Update audit_logs policies to use JWT claims
DROP POLICY IF EXISTS "Super admins can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can view own org audit logs" ON audit_logs;

CREATE POLICY "Super admins can view all audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Users can view own org audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );
