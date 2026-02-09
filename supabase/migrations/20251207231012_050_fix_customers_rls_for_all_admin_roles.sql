/*
  # Fix Customers RLS Policies for All Administrative Roles

  1. Changes
    - Update UPDATE policy to include all administrative roles: hq, bsm, regional_manager, branch_manager, field_supervisor
    - Update INSERT policy to include all administrative roles
    - Update DELETE policy to include all administrative roles
    - Ensure policies align with the role hierarchy defined in the system

  2. Role Hierarchy
    - Super Admin (0): Global access
    - Client Admin (1): Organization admin
    - HQ (2): Organizational overview
    - BSM (3): Back office with regional visibility
    - Regional Manager (4): Multiple branches
    - Branch Manager (5): Single branch
    - Field Supervisor (6): Field agents
    - Field Agent (7): Executions

  3. Security
    - All policies check organization membership
    - Super admin has override access
    - Maintains data isolation between organizations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can update agents in their organization" ON customers;
DROP POLICY IF EXISTS "Admins can create agents in their organization" ON customers;
DROP POLICY IF EXISTS "Admins can delete agents in their organization" ON customers;

-- Recreate UPDATE policy with all admin roles
CREATE POLICY "Admins can update customers in their organization"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    OR (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin'
  )
  WITH CHECK (
    (
      org_id = (SELECT org_id FROM users WHERE id = auth.uid())
      AND (auth.jwt()->>'app_metadata')::jsonb->>'role' IN (
        'client_admin', 
        'hq', 
        'bsm', 
        'regional_manager', 
        'branch_manager',
        'field_supervisor'
      )
    )
    OR (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin'
  );

-- Recreate INSERT policy with all admin roles
CREATE POLICY "Admins can create customers in their organization"
  ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      org_id = (SELECT org_id FROM users WHERE id = auth.uid())
      AND (auth.jwt()->>'app_metadata')::jsonb->>'role' IN (
        'client_admin', 
        'hq', 
        'bsm', 
        'regional_manager', 
        'branch_manager',
        'field_supervisor'
      )
    )
    OR (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin'
  );

-- Recreate DELETE policy with all admin roles
CREATE POLICY "Admins can delete customers in their organization"
  ON customers
  FOR DELETE
  TO authenticated
  USING (
    (
      org_id = (SELECT org_id FROM users WHERE id = auth.uid())
      AND (auth.jwt()->>'app_metadata')::jsonb->>'role' IN (
        'client_admin', 
        'hq', 
        'bsm', 
        'regional_manager', 
        'branch_manager',
        'field_supervisor'
      )
    )
    OR (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin'
  );
