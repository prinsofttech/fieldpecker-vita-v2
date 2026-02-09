/*
  # Grant Execute Permissions for Login Attempt Function

  1. Changes
    - Grant EXECUTE permission on get_recent_login_attempts to public
    - This allows the function to be called during login attempts (before authentication)

  2. Security
    - Function is SECURITY DEFINER so it runs with owner privileges
    - Function only counts attempts, doesn't expose sensitive data
    - Safe to allow public access as it's needed for login flow
*/

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_recent_login_attempts(text) TO anon;
GRANT EXECUTE ON FUNCTION get_recent_login_attempts(text) TO authenticated;

-- Also grant select on login_attempts table to the function (implicitly through SECURITY DEFINER)
-- No additional grants needed since SECURITY DEFINER bypasses RLS
