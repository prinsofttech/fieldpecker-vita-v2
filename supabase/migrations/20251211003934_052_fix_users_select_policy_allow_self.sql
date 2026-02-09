/*
  # Fix Users SELECT Policy - Allow Reading Own Record

  ## Problem
  Users are getting logged out immediately after login because:
  1. SessionService.createSession tries to read from users table to get org_id
  2. The RLS policy requires org_id in JWT app_metadata
  3. On fresh login, JWT might not have org_id yet, or it's not refreshed
  4. The SELECT query fails, returning no results
  5. Session creation fails
  6. User gets logged out

  ## Solution
  Update the users SELECT policy to allow users to ALWAYS read their own record
  by user ID (auth.uid()), in addition to reading users in the same organization.

  ## Changes
  1. Drop existing "Users can view users in own organization" policy
  2. Create new policy that allows:
     - Users to view their own record (id = auth.uid())
     - Users to view other users in same organization

  ## Security
  - Users can always read their own user record
  - Users can read other users in the same organization
  - Super admins can view all users (handled by separate policy)
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view users in own organization" ON users;

-- Create new policy that allows self-read and same-org read
CREATE POLICY "Users can view users in own organization"
  ON users FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );
