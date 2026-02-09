/*
  # Fix Branches RLS Policies

  1. Changes
    - Drop all existing incorrect branch policies
    - Create simple, correct policies based on org_id matching
    - Allow client_admin, org_admin, manager, and super_admin to manage branches
    - Use direct org_id comparison instead of complex function calls
  
  2. Security
    - Users can only access branches in their organization
    - Super admins can access all branches
    - Client admins, org admins, and managers can manage branches in their org
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view branches in their organization regions" ON branches;
DROP POLICY IF EXISTS "Client admins can insert branches" ON branches;
DROP POLICY IF EXISTS "Client admins can update branches" ON branches;
DROP POLICY IF EXISTS "Client admins can delete branches" ON branches;
DROP POLICY IF EXISTS "Org admins can insert branches in their organization regions" ON branches;
DROP POLICY IF EXISTS "Org admins can update branches in their organization regions" ON branches;
DROP POLICY IF EXISTS "Org admins can delete branches in their organization regions" ON branches;

-- SELECT: All authenticated users can view branches in their organization
CREATE POLICY "Users can view branches in their organization"
  ON branches FOR SELECT
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
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
      (auth.jwt() ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
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
      (auth.jwt() ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() ->> 'role') = 'super_admin'
  );
