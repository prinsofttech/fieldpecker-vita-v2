/*
  # Fix must_change_password for Existing Users

  ## Problem
  Migration 051 added must_change_password column with DEFAULT true.
  The final UPDATE statement only updates WHERE must_change_password IS NULL,
  but if the column was added with DEFAULT true, existing users have true instead of NULL.
  This causes existing users to be forced to change password on next login.

  ## Solution
  Update all existing users (created before this security migration) to have
  must_change_password = false, so they can continue logging in normally.
  Only NEW users created after this migration should require password change.

  ## Changes
  1. Update all users where must_change_password = true to false
  2. Except for users created very recently (within last 5 minutes)
  3. This ensures existing users aren't forced to change password
  4. New users created from now on will have must_change_password = true

  ## Security
  - Existing users retain their access without forced password change
  - New user accounts will still require password change on first login
*/

-- Update existing users to not require password change
-- Only update users created before the security migration (more than 5 minutes ago)
UPDATE users
SET must_change_password = false
WHERE must_change_password = true
  AND created_at < (now() - interval '5 minutes');

-- Also ensure password_expires_at is set to 90 days from now for users who don't have it
UPDATE users
SET password_expires_at = now() + interval '90 days'
WHERE password_expires_at IS NULL;
