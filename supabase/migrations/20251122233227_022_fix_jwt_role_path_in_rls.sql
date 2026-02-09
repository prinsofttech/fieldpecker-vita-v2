/*
  # Fix JWT Role Path in RLS Policies

  1. Changes
    - Fix branches, regions, and departments RLS policies
    - Change auth.jwt() ->> 'role' to auth.jwt() -> 'app_metadata' ->> 'role'
    - The role is stored in app_metadata, not at root level
  
  2. Security
    - Maintains same security logic
    - Fixes authentication checks to properly read role from JWT
*/

-- ============================================
-- BRANCHES POLICIES - FIX JWT PATH
-- ============================================

DROP POLICY IF EXISTS "Users can view branches in their organization" ON branches;
DROP POLICY IF EXISTS "Admins can create branches in their organization" ON branches;
DROP POLICY IF EXISTS "Admins can update branches in their organization" ON branches;
DROP POLICY IF EXISTS "Admins can delete branches in their organization" ON branches;

-- SELECT: All authenticated users can view branches in their organization
CREATE POLICY "Users can view branches in their organization"
  ON branches FOR SELECT
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- INSERT: Admins and managers can create branches in their organization
CREATE POLICY "Admins can create branches in their organization"
  ON branches FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- UPDATE: Admins and managers can update branches in their organization
CREATE POLICY "Admins can update branches in their organization"
  ON branches FOR UPDATE
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- DELETE: Admins and managers can delete branches in their organization
CREATE POLICY "Admins can delete branches in their organization"
  ON branches FOR DELETE
  TO authenticated
  USING (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- ============================================
-- REGIONS POLICIES - FIX JWT PATH
-- ============================================

DROP POLICY IF EXISTS "Users can view regions in their organization" ON regions;
DROP POLICY IF EXISTS "Admins can create regions in their organization" ON regions;
DROP POLICY IF EXISTS "Admins can update regions in their organization" ON regions;
DROP POLICY IF EXISTS "Admins can delete regions in their organization" ON regions;

-- SELECT: All authenticated users can view regions in their organization
CREATE POLICY "Users can view regions in their organization"
  ON regions FOR SELECT
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
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
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
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
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
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
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- ============================================
-- DEPARTMENTS POLICIES - FIX JWT PATH
-- ============================================

DROP POLICY IF EXISTS "Users can view departments in their organization" ON departments;
DROP POLICY IF EXISTS "Admins can create departments in their organization" ON departments;
DROP POLICY IF EXISTS "Admins can update departments in their organization" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments in their organization" ON departments;

-- SELECT: All authenticated users can view departments in their organization
CREATE POLICY "Users can view departments in their organization"
  ON departments FOR SELECT
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
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
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
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
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
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
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );
