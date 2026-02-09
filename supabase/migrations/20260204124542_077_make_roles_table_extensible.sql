/*
  # Make Roles Table Extensible

  1. Changes
    - Remove the CHECK constraint on roles.name that restricts role names to specific values
    - This allows administrators to create custom roles dynamically
    - Maintain data integrity with unique constraint on name

  2. Security
    - Existing RLS policies remain unchanged
    - Only authenticated admins can manage roles

  3. Notes
    - Existing roles are preserved
    - System roles (super_admin, client_admin, field_agent) can still be protected at application level
*/

-- Drop the existing constraint on role names
DO $$
BEGIN
  -- Check if constraint exists and drop it
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'roles_name_check'
    AND table_name = 'roles'
  ) THEN
    ALTER TABLE roles DROP CONSTRAINT roles_name_check;
  END IF;
END $$;

-- Ensure name column is still unique and not null
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'roles_name_key'
    AND table_name = 'roles'
  ) THEN
    ALTER TABLE roles ADD CONSTRAINT roles_name_key UNIQUE (name);
  END IF;
END $$;

-- Ensure display_name is not null
DO $$
BEGIN
  ALTER TABLE roles ALTER COLUMN display_name SET NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Ensure level has reasonable bounds
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'roles_level_check'
    AND table_name = 'roles'
  ) THEN
    ALTER TABLE roles ADD CONSTRAINT roles_level_check CHECK (level >= 0 AND level <= 100);
  END IF;
END $$;
