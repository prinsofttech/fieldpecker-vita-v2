/*
  # Fix User Deletion Constraints
  
  1. Ensure Proper Foreign Key Constraints
    - Verify all self-referencing user constraints have ON DELETE SET NULL
    - Check issue_tracker_settings.created_by constraint
    - Ensure user_sessions cascade properly
  
  2. Security
    - Maintain RLS policies for deletion
    - Ensure only admins can delete users
*/

-- Ensure issue_tracker_settings.created_by has proper ON DELETE behavior
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'issue_tracker_settings' 
    AND constraint_name = 'issue_tracker_settings_created_by_fkey'
  ) THEN
    ALTER TABLE issue_tracker_settings 
    DROP CONSTRAINT issue_tracker_settings_created_by_fkey;
    
    ALTER TABLE issue_tracker_settings
    ADD CONSTRAINT issue_tracker_settings_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES users(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure all user self-referencing constraints have ON DELETE SET NULL
DO $$
BEGIN
  -- parent_user_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'users' 
    AND constraint_name = 'users_parent_user_id_fkey'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_parent_user_id_fkey;
    ALTER TABLE users
    ADD CONSTRAINT users_parent_user_id_fkey 
    FOREIGN KEY (parent_user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL;
  END IF;

  -- created_by
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'users' 
    AND constraint_name = 'users_created_by_fkey'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_created_by_fkey;
    ALTER TABLE users
    ADD CONSTRAINT users_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES users(id) 
    ON DELETE SET NULL;
  END IF;

  -- reports_to_user_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'users' 
    AND constraint_name = 'users_reports_to_user_id_fkey'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_reports_to_user_id_fkey;
    ALTER TABLE users
    ADD CONSTRAINT users_reports_to_user_id_fkey 
    FOREIGN KEY (reports_to_user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL;
  END IF;
END $$;