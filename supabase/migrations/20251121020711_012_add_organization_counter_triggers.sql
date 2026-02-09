/*
  # Add Automatic Counter Updates for Organizations

  1. Problem
    - Organization counter columns (total_users, total_agents, enabled_modules_count) are not updating
    - SuperAdminDashboard shows 0 for all statistics

  2. Solution
    - Create triggers to automatically update counters when users/modules change
    - Update existing organizations with current counts

  3. Changes
    - Create function to update organization user count
    - Create function to update organization module count
    - Add triggers on users and org_modules tables
    - Update existing organizations with current counts
*/

-- Function to update organization user counts
CREATE OR REPLACE FUNCTION update_org_user_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE organizations
    SET total_users = (SELECT COUNT(*) FROM users WHERE org_id = OLD.org_id)
    WHERE id = OLD.org_id;
    RETURN OLD;
  ELSE
    UPDATE organizations
    SET total_users = (SELECT COUNT(*) FROM users WHERE org_id = NEW.org_id)
    WHERE id = NEW.org_id;
    
    -- If this was an UPDATE and org changed, update both orgs
    IF TG_OP = 'UPDATE' AND OLD.org_id != NEW.org_id THEN
      UPDATE organizations
      SET total_users = (SELECT COUNT(*) FROM users WHERE org_id = OLD.org_id)
      WHERE id = OLD.org_id;
    END IF;
    
    RETURN NEW;
  END IF;
END;
$$;

-- Function to update organization module counts
CREATE OR REPLACE FUNCTION update_org_module_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE organizations
    SET enabled_modules_count = (SELECT COUNT(*) FROM org_modules WHERE org_id = OLD.org_id AND is_enabled = true)
    WHERE id = OLD.org_id;
    RETURN OLD;
  ELSE
    UPDATE organizations
    SET enabled_modules_count = (SELECT COUNT(*) FROM org_modules WHERE org_id = NEW.org_id AND is_enabled = true)
    WHERE id = NEW.org_id;
    
    -- If this was an UPDATE and org changed, update both orgs
    IF TG_OP = 'UPDATE' AND OLD.org_id != NEW.org_id THEN
      UPDATE organizations
      SET enabled_modules_count = (SELECT COUNT(*) FROM org_modules WHERE org_id = OLD.org_id AND is_enabled = true)
      WHERE id = OLD.org_id;
    END IF;
    
    RETURN NEW;
  END IF;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_org_user_count_trigger ON users;
DROP TRIGGER IF EXISTS update_org_module_count_trigger ON org_modules;

-- Create triggers for user count updates
CREATE TRIGGER update_org_user_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_org_user_count();

-- Create triggers for module count updates
CREATE TRIGGER update_org_module_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON org_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_org_module_count();

-- Update all existing organizations with current counts
UPDATE organizations o
SET 
  total_users = (SELECT COUNT(*) FROM users WHERE org_id = o.id),
  enabled_modules_count = (SELECT COUNT(*) FROM org_modules WHERE org_id = o.id AND is_enabled = true),
  total_agents = 0;  -- Set to 0 for now since agents table doesn't exist yet
