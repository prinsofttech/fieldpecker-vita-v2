/*
  # Add default value for expires_at column

  1. Changes
    - Set expires_at default to 12 hours from session creation
    - Ensures all timestamp columns use server time, preventing clock skew issues

  2. Purpose
    - Fix logout bug caused by client/server clock differences
    - All session timestamps now use consistent database server time
*/

ALTER TABLE user_sessions 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '12 hours');
