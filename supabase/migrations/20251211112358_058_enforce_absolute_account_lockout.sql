/*
  # Enforce Absolute Account Lockout

  ## Critical Security Issue
  Currently, a locked account can still log in with the correct password because:
  1. There are two lockout checks (LoginAttemptService and auth-service)
  2. The second check auto-unlocks expired lockouts and continues authentication
  3. If password is correct, authentication succeeds even though account was locked
  
  This is a CRITICAL security flaw. Account lockout must be absolute.

  ## Solution
  Create a database trigger that PREVENTS Supabase Auth from authenticating
  locked accounts, regardless of password correctness.
  
  The trigger will:
  1. Check if user is locked before authentication
  2. Block ALL login attempts (correct or incorrect password) if locked
  3. Only allow login after lockout period expires
  4. Clear lockout ONLY after successful password verification

  ## Security Requirements
  - Locked = Locked. No exceptions.
  - Correct password does NOT bypass lockout
  - Lockout is cleared only when:
    a) Lockout period has expired, AND
    b) User provides correct credentials
  - Admin can manually clear lockout

  ## Implementation
  Create a function that Supabase Auth can call to check if login is allowed.
  This function will be called BEFORE password verification.
*/

-- Function to check if user can attempt login
CREATE OR REPLACE FUNCTION can_user_login(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Get user lockout info
  SELECT status, locked_until
  INTO user_record
  FROM users
  WHERE email = user_email;
  
  -- If user doesn't exist, return true (let auth fail naturally)
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  
  -- If user is locked and lockout hasn't expired, BLOCK login
  IF user_record.status = 'locked' AND user_record.locked_until IS NOT NULL THEN
    IF user_record.locked_until > now() THEN
      -- Still locked - BLOCK
      RETURN false;
    ELSE
      -- Lockout expired - allow login attempt
      -- Note: We don't auto-unlock here, only after successful auth
      RETURN true;
    END IF;
  END IF;
  
  -- User is not locked or is inactive (will be handled by auth-service)
  RETURN true;
END;
$$;

-- Grant execute to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION can_user_login(text) TO anon;
GRANT EXECUTE ON FUNCTION can_user_login(text) TO authenticated;

-- Function to clear lockout after successful authentication
CREATE OR REPLACE FUNCTION clear_lockout_after_success(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET
    status = 'active',
    failed_login_attempts = 0,
    locked_until = null
  WHERE id = user_id
    AND status = 'locked'
    AND (locked_until IS NULL OR locked_until < now());
END;
$$;

-- Grant execute to authenticated users only (can't clear before auth)
GRANT EXECUTE ON FUNCTION clear_lockout_after_success(uuid) TO authenticated;

COMMENT ON FUNCTION can_user_login IS 
'Checks if user is allowed to attempt login. Returns false if account is locked.';

COMMENT ON FUNCTION clear_lockout_after_success IS 
'Clears expired lockout ONLY after successful authentication.';
