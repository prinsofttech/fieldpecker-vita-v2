/*
  # Add org_id to JWT app_metadata

  1. Problem
    - RLS policies need org_id from JWT to avoid recursion
    - Currently org_id is not in JWT app_metadata

  2. Solution
    - Create trigger to update auth.users.raw_app_meta_data on user insert/update
    - This ensures org_id is available in JWT claims

  3. Security
    - Only triggers on user table changes
    - Syncs org_id to auth system for RLS policies
*/

-- Function to sync org_id to auth.users app_metadata
CREATE OR REPLACE FUNCTION sync_user_org_to_jwt()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the auth.users raw_app_meta_data with org_id
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('org_id', NEW.org_id::text)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS sync_user_org_to_jwt_trigger ON users;

-- Create trigger on users table
CREATE TRIGGER sync_user_org_to_jwt_trigger
  AFTER INSERT OR UPDATE OF org_id ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_org_to_jwt();

-- Backfill existing users
UPDATE auth.users au
SET raw_app_meta_data = 
  COALESCE(au.raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object('org_id', u.org_id::text)
FROM users u
WHERE au.id = u.id;
