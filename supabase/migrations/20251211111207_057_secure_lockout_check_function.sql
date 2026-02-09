/*
  # Secure Lockout Check Function

  ## Problem
  Previous migration (056) allowed anonymous users to read entire users table.
  This is a security risk as it exposes all user data.

  ## Solution
  1. Drop the overly permissive anonymous policy
  2. Create a secure function that:
     - Runs with SECURITY DEFINER (bypasses RLS)
     - Only returns lockout-related fields
     - Only accepts email parameter
     - Cannot be used to enumerate users beyond what's needed

  ## Security
  - Function only returns: status, locked_until, failed_login_attempts
  - No PII or sensitive data exposed
  - Cannot be used to dump user table
  - Properly scoped to single email lookup

  ## Changes
  1. Drop overly permissive anonymous policy
  2. Create secure function for lockout checking
  3. Grant execute permission to anon role
*/

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anonymous users can check lockout status" ON users;

-- Create secure function that only returns lockout status
CREATE OR REPLACE FUNCTION check_user_lockout_status(user_email text)
RETURNS TABLE (
  status text,
  locked_until timestamptz,
  failed_login_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.status,
    u.locked_until,
    u.failed_login_attempts
  FROM users u
  WHERE u.email = user_email
  LIMIT 1;
END;
$$;

-- Grant execute to anonymous users (needed for login flow)
GRANT EXECUTE ON FUNCTION check_user_lockout_status(text) TO anon;
GRANT EXECUTE ON FUNCTION check_user_lockout_status(text) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION check_user_lockout_status IS 
'Securely checks user lockout status during login. Only returns lockout-related fields.';
