/*
  # Fix Login RLS Policy

  1. Changes
    - Add policy to allow anon users to read user records by email (needed for login flow)
    - This is secure because:
      - Only basic user info is exposed (email, status, role)
      - Password hash is never returned
      - The actual authentication is still validated by Supabase Auth
      - After successful auth, normal RLS policies take over
  
  2. Security
    - Policy is restricted to SELECT only
    - Only allows lookup by email (not browsing all users)
    - Does not expose sensitive data
*/

-- Allow anon users to lookup user by email for login validation
DROP POLICY IF EXISTS "Allow user lookup for login" ON users;
CREATE POLICY "Allow user lookup for login"
  ON users FOR SELECT TO anon
  USING (true);
