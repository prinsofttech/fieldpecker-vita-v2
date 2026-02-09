/*
  # Add Super Admin Role
  
  1. Changes
    - Add 'super_admin' to roles table CHECK constraint
    - Insert super_admin role with level 0 (highest privilege)
    - Update users table to support NULL org_id for super admins
  
  2. Purpose
    - Super admins can create and manage client organizations
    - Super admins operate at system level (no org_id)
    - Super admins have all permissions across all organizations
  
  3. Security
    - Super admin accounts should be tightly controlled
    - Only super admins can create new organizations
    - Super admins can access all client data
  
  4. Note
    - org_id is now nullable to support super admins
    - Application layer enforces that only super_admin role can have NULL org_id
*/

-- Drop existing CHECK constraint on roles.name and add super_admin
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_check;
ALTER TABLE roles ADD CONSTRAINT roles_name_check 
  CHECK (name IN ('super_admin', 'client_admin', 'regional_manager', 'branch_manager', 'supervisor', 'field_agent'));

-- Update level constraint to allow level 0 for super_admin
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_level_check;
ALTER TABLE roles ADD CONSTRAINT roles_level_check 
  CHECK (level >= 0 AND level <= 5);

-- Make org_id nullable for super admins
ALTER TABLE users ALTER COLUMN org_id DROP NOT NULL;

-- Insert super_admin role
INSERT INTO roles (name, display_name, level, description, permissions) VALUES
  ('super_admin', 'Super Admin', 0, 'System administrator with full access to all organizations', '{"system_admin": true, "create_organizations": true, "manage_all": true}'::jsonb)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  level = EXCLUDED.level,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;

-- Add index for super admin queries
CREATE INDEX IF NOT EXISTS idx_users_super_admin ON users(role_id) WHERE org_id IS NULL;

-- Add comment explaining org_id nullability
COMMENT ON COLUMN users.org_id IS 'Organization ID. NULL only for super_admin role users.';
