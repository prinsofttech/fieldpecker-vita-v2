/*
  # Fix Regions and Departments RLS Policies

  1. Changes
    - Drop all existing incorrect region and department policies
    - Create simple, correct policies based on org_id matching
    - Allow client_admin, org_admin, manager, and super_admin to manage regions/departments
    - Use direct org_id comparison
  
  2. Security
    - Users can only access regions/departments in their organization
    - Super admins can access all regions/departments
    - Client admins, org admins, and managers can manage in their org
*/

-- ============================================
-- REGIONS POLICIES
-- ============================================

-- Drop all existing region policies
DROP POLICY IF EXISTS "Users can view regions in their organization" ON regions;
DROP POLICY IF EXISTS "Client admins can insert regions" ON regions;
DROP POLICY IF EXISTS "Client admins can update regions" ON regions;
DROP POLICY IF EXISTS "Client admins can delete regions" ON regions;

-- SELECT: All authenticated users can view regions in their organization
CREATE POLICY "Users can view regions in their organization"
  ON regions FOR SELECT
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- INSERT: Admins and managers can create regions in their organization
CREATE POLICY "Admins can create regions in their organization"
  ON regions FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- UPDATE: Admins and managers can update regions in their organization
CREATE POLICY "Admins can update regions in their organization"
  ON regions FOR UPDATE
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- DELETE: Admins and managers can delete regions in their organization
CREATE POLICY "Admins can delete regions in their organization"
  ON regions FOR DELETE
  TO authenticated
  USING (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- ============================================
-- DEPARTMENTS POLICIES
-- ============================================

-- Drop all existing department policies
DROP POLICY IF EXISTS "Users can view departments in their organization" ON departments;
DROP POLICY IF EXISTS "Client admins can insert departments" ON departments;
DROP POLICY IF EXISTS "Client admins can update departments" ON departments;
DROP POLICY IF EXISTS "Client admins can delete departments" ON departments;

-- SELECT: All authenticated users can view departments in their organization
CREATE POLICY "Users can view departments in their organization"
  ON departments FOR SELECT
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- INSERT: Admins and managers can create departments in their organization
CREATE POLICY "Admins can create departments in their organization"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- UPDATE: Admins and managers can update departments in their organization
CREATE POLICY "Admins can update departments in their organization"
  ON departments FOR UPDATE
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- DELETE: Admins and managers can delete departments in their organization
CREATE POLICY "Admins can delete departments in their organization"
  ON departments FOR DELETE
  TO authenticated
  USING (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
  );
