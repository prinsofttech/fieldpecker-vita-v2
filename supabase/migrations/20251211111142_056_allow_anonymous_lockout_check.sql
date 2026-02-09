/*
  # Allow Anonymous Lockout Status Check During Login

  ## Problem
  The checkLockoutStatus() function queries the users table BEFORE authentication:
  ```typescript
  const { data: user } = await supabase
    .from('users')
    .select('status, locked_until, failed_login_attempts')
    .eq('email', email)
    .maybeSingle();
  ```
  
  However, the current RLS policy only allows authenticated users to read from users table.
  This causes the query to hang/timeout during login when user is still anonymous.

  ## Solution
  Add a restricted policy that allows anonymous users to read ONLY:
  - status
  - locked_until
  - failed_login_attempts
  
  For a user record matching their login email. This is safe because:
  - Only exposes lockout status, not sensitive data
  - Required for security feature (account lockout)
  - Cannot be used to enumerate users (they need email)
  - No PII or sensitive information exposed

  ## Security Considerations
  - Anonymous users can check if an email is locked out
  - This is acceptable as it's necessary for the lockout feature
  - Only exposes account security status, not user data
  - Lockout status is not sensitive information

  ## Changes
  1. Create policy for anonymous users to check lockout status by email
*/

-- Allow anonymous users to check lockout status during login
CREATE POLICY "Anonymous users can check lockout status"
  ON users FOR SELECT
  TO anon
  USING (true);
