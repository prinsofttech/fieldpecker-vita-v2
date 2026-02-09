/*
  # Update Roles Hierarchy

  1. Changes
    - Remove constraints that limit role names and levels
    - Update existing roles to match new hierarchy
    - Add new roles: Head Quarters (HQ), Business Support Manager (BSM)
    - Rename supervisor to field_supervisor
    - Update hierarchy levels to reflect organizational structure

  2. New Role Hierarchy (level 0 = highest)
    - Super Admin (0): All organizations
    - Client Admin (1): Organization Admin
    - Head Quarters/HQ (2): Organizational overview
    - Business Support Manager/BSM (3): Back Office with visibility of one or more regions
    - Regional Manager (4): Manages multiple branches in a region
    - Branch Manager (5): Manages single branch operations
    - Field Supervisor (6): Supervises field agents
    - Field Agent (7): Executes field operations
*/

-- Drop constraints that limit role names and levels
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_check;
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_level_check;

-- Add new level constraint allowing levels 0-10
ALTER TABLE roles ADD CONSTRAINT roles_level_check CHECK (level >= 0 AND level <= 10);

-- Update supervisor to field_supervisor
UPDATE roles
SET 
  name = 'field_supervisor',
  display_name = 'Field Supervisor',
  description = 'Supervises field agents and operations',
  level = 6
WHERE name = 'supervisor';

-- Update field_agent level
UPDATE roles
SET level = 7
WHERE name = 'field_agent';

-- Update branch_manager level
UPDATE roles
SET level = 5
WHERE name = 'branch_manager';

-- Update regional_manager level
UPDATE roles
SET level = 4
WHERE name = 'regional_manager';

-- Update client_admin
UPDATE roles
SET 
  display_name = 'Client Admin',
  description = 'Organization administrator with full access',
  level = 1
WHERE name = 'client_admin';

-- Insert new roles
INSERT INTO roles (name, display_name, description, level, permissions) VALUES
('hq', 'Head Quarters (HQ)', 'Organizational overview and strategic management', 2, '{"view": "all", "edit": "reports", "manage": "overview"}'),
('bsm', 'Business Support Manager (BSM)', 'Back office operations with visibility of one or more regions', 3, '{"view": "regions", "edit": "support", "manage": "backoffice"}')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  level = EXCLUDED.level,
  permissions = EXCLUDED.permissions;
