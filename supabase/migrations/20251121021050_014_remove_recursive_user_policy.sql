/*
  # Remove Recursive User Policy

  1. Problem
    - "Users can view users in own organization" policy queries users table from within users policy
    - This causes infinite recursion when super admin tries to fetch user data
    - Error: "infinite recursion detected in policy for relation users"

  2. Solution
    - Drop the recursive policy
    - Keep only the non-recursive policies:
      - Super admins can view all (uses JWT only)
      - Users can view themselves (uses auth.uid() only)

  3. Changes
    - Remove "Users can view users in own organization" policy
    - This means regular users can only see themselves, not other users in their org
    - If needed, we can add this back using a SECURITY DEFINER function later
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view users in own organization" ON users;

-- The remaining SELECT policies are safe:
-- 1. "Super admins can view all users" - uses JWT claim only, no table queries
-- 2. "Users can view themselves" - uses auth.uid() only, no table queries
-- 3. "Allow user lookup for login" - for anon users during login

-- If regular users need to see org members, we'll handle that through
-- a SECURITY DEFINER function or view, not through RLS
