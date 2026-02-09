/*
  # Fix Login Attempts RLS Policy

  1. Changes
    - Drop existing INSERT policy that requires authentication
    - Create new INSERT policy that allows anyone (including unauthenticated) to record login attempts
    - This is necessary because login attempts occur BEFORE authentication

  2. Security
    - Policy allows inserts from anyone but the data is write-only
    - Admins can still read the data via the existing SELECT policy
    - The table remains secure as only admins can view the attempts
*/

-- Drop the existing policy that requires authentication
DROP POLICY IF EXISTS "System can insert login attempts" ON login_attempts;

-- Create new policy that allows unauthenticated inserts
-- This is safe because:
-- 1. Users can only INSERT (not read, update, or delete)
-- 2. The SELECT policy restricts who can view the data to admins only
-- 3. Login attempts MUST be recorded before authentication occurs
CREATE POLICY "Allow login attempt recording"
  ON login_attempts FOR INSERT
  TO public
  WITH CHECK (true);

-- Ensure anon role has insert permission
GRANT INSERT ON login_attempts TO anon;
GRANT INSERT ON login_attempts TO authenticated;
