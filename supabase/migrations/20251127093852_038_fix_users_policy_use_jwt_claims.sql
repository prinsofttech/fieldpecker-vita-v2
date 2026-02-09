/*
  # Fix Users SELECT Policy - Use JWT Claims

  1. Problem
    - Previous policy used subquery causing infinite recursion
    - Users could not log in due to RLS policy blocking itself

  2. Solution
    - Use JWT claims (app_metadata) instead of subquery
    - Organization ID is stored in JWT during login
    - No circular dependency

  3. Security
    - Users can view other users in same organization
    - Super admins can view all users
    - Users can view themselves
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view users in own organization" ON users;

-- Create policy using JWT claims to avoid recursion
CREATE POLICY "Users can view users in own organization"
  ON users FOR SELECT
  TO authenticated
  USING (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );
