/*
  # Add supervisor_code field to users table
  
  1. Changes
    - Add `supervisor_code` column to `users` table
    - Add index for faster lookups on supervisor_code
  
  2. Purpose
    - Store supervisor codes for field supervisors and field agents
    - Enable tracking and identification of supervisors
    - Support supervisor-agent relationship tracking
  
  3. Notes
    - Field is optional (nullable) as not all roles require a supervisor code
    - Primarily used for field_supervisor and field_agent roles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'supervisor_code'
  ) THEN
    ALTER TABLE users ADD COLUMN supervisor_code text;
  END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_supervisor_code ON users(supervisor_code) WHERE supervisor_code IS NOT NULL;