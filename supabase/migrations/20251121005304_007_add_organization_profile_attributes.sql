/*
  # Add Organization Profile Attributes

  1. New Columns
    - `max_users` (integer) - Maximum number of users allowed for the organization
    - `max_agents` (integer) - Maximum number of agents allowed for the organization
    - `max_modules` (integer) - Maximum number of modules allowed for the organization
    - `total_users` (integer) - Current total number of users in the organization
    - `total_agents` (integer) - Current total number of agents in the organization
    - `enabled_modules_count` (integer) - Current number of enabled modules

  2. Changes
    - Add new columns to organizations table with default values
    - These attributes will be managed by super admins
    - Used to track and limit organization resources

  3. Default Values
    - Basic tier: 10 users, 5 agents, 5 modules
    - Professional tier: 50 users, 25 agents, 15 modules
    - Enterprise tier: unlimited (999 as placeholder)
*/

-- Add new columns to organizations table
DO $$ 
BEGIN
  -- Add max_users column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'max_users'
  ) THEN
    ALTER TABLE organizations ADD COLUMN max_users integer DEFAULT 10;
  END IF;

  -- Add max_agents column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'max_agents'
  ) THEN
    ALTER TABLE organizations ADD COLUMN max_agents integer DEFAULT 5;
  END IF;

  -- Add max_modules column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'max_modules'
  ) THEN
    ALTER TABLE organizations ADD COLUMN max_modules integer DEFAULT 5;
  END IF;

  -- Add total_users column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'total_users'
  ) THEN
    ALTER TABLE organizations ADD COLUMN total_users integer DEFAULT 0;
  END IF;

  -- Add total_agents column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'total_agents'
  ) THEN
    ALTER TABLE organizations ADD COLUMN total_agents integer DEFAULT 0;
  END IF;

  -- Add enabled_modules_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'enabled_modules_count'
  ) THEN
    ALTER TABLE organizations ADD COLUMN enabled_modules_count integer DEFAULT 0;
  END IF;
END $$;

-- Update existing organizations based on their subscription tier
UPDATE organizations 
SET 
  max_users = CASE 
    WHEN subscription_tier = 'basic' THEN 10
    WHEN subscription_tier = 'professional' THEN 50
    WHEN subscription_tier = 'enterprise' THEN 999
    ELSE 10
  END,
  max_agents = CASE 
    WHEN subscription_tier = 'basic' THEN 5
    WHEN subscription_tier = 'professional' THEN 25
    WHEN subscription_tier = 'enterprise' THEN 999
    ELSE 5
  END,
  max_modules = CASE 
    WHEN subscription_tier = 'basic' THEN 5
    WHEN subscription_tier = 'professional' THEN 15
    WHEN subscription_tier = 'enterprise' THEN 999
    ELSE 5
  END
WHERE max_users = 10 AND max_agents = 5 AND max_modules = 5;

-- Create function to update organization user count
CREATE OR REPLACE FUNCTION update_org_user_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE organizations 
    SET total_users = total_users + 1 
    WHERE id = NEW.org_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE organizations 
    SET total_users = GREATEST(total_users - 1, 0)
    WHERE id = OLD.org_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update organization module count
CREATE OR REPLACE FUNCTION update_org_module_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_enabled = true THEN
    UPDATE organizations 
    SET enabled_modules_count = enabled_modules_count + 1 
    WHERE id = NEW.org_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_enabled = false AND NEW.is_enabled = true THEN
      UPDATE organizations 
      SET enabled_modules_count = enabled_modules_count + 1 
      WHERE id = NEW.org_id;
    ELSIF OLD.is_enabled = true AND NEW.is_enabled = false THEN
      UPDATE organizations 
      SET enabled_modules_count = GREATEST(enabled_modules_count - 1, 0)
      WHERE id = NEW.org_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.is_enabled = true THEN
    UPDATE organizations 
    SET enabled_modules_count = GREATEST(enabled_modules_count - 1, 0)
    WHERE id = OLD.org_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_org_user_count'
  ) THEN
    CREATE TRIGGER trigger_update_org_user_count
    AFTER INSERT OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_org_user_count();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_org_module_count'
  ) THEN
    CREATE TRIGGER trigger_update_org_module_count
    AFTER INSERT OR UPDATE OR DELETE ON org_modules
    FOR EACH ROW
    EXECUTE FUNCTION update_org_module_count();
  END IF;
END $$;

-- Initialize counts for existing organizations
UPDATE organizations o
SET 
  total_users = (
    SELECT COUNT(*) FROM users WHERE org_id = o.id
  ),
  enabled_modules_count = (
    SELECT COUNT(*) FROM org_modules WHERE org_id = o.id AND is_enabled = true
  );
