/*
  # Fix All User Deletion Foreign Key Constraints

  1. Changes
    - Update org_modules.enabled_by to SET NULL on delete
    - Update users.created_by to SET NULL on delete (self-referencing)
    - Update users.parent_user_id to SET NULL on delete (self-referencing)
  
  2. Security
    - Maintains data integrity while allowing user deletion
    - Preserves historical records with NULL references
    - Enables proper user lifecycle management
  
  3. Notes
    - Audit logs already set to SET NULL (migration 018)
    - Password history already set to CASCADE (original schema)
    - Regions, branches, departments already set to SET NULL (original schema)
*/

-- Fix org_modules.enabled_by constraint
ALTER TABLE org_modules 
DROP CONSTRAINT IF EXISTS org_modules_enabled_by_fkey;

ALTER TABLE org_modules
ADD CONSTRAINT org_modules_enabled_by_fkey 
FOREIGN KEY (enabled_by) 
REFERENCES users(id) 
ON DELETE SET NULL;

-- Fix users.created_by constraint (self-referencing)
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_created_by_fkey;

ALTER TABLE users
ADD CONSTRAINT users_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES users(id) 
ON DELETE SET NULL;

-- Fix users.parent_user_id constraint (self-referencing)
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_parent_user_id_fkey;

ALTER TABLE users
ADD CONSTRAINT users_parent_user_id_fkey 
FOREIGN KEY (parent_user_id) 
REFERENCES users(id) 
ON DELETE SET NULL;
