/*
  # Fix Users SELECT Policy for Client Admin and Other Roles

  1. Changes
    - Add policy allowing users to view other users in their organization
    - This enables client_admin and managers to see their team members
    - Maintains security by restricting to same organization only

  2. Security
    - Users can only view other users in the same organization
    - Super admins retain ability to view all users
    - Users can still view themselves
*/

-- Drop old policy if exists
DROP POLICY IF EXISTS "Users can view users in own organization" ON users;

-- Create comprehensive policy for viewing users in same organization
CREATE POLICY "Users can view users in own organization"
  ON users FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id 
      FROM users 
      WHERE id = auth.uid()
    )
  );
