/*
  # Add org_id to user_territories table

  1. Changes
    - Add org_id column to user_territories table
    - Add foreign key constraint to organizations table
    - Create index for faster lookups
    - Update existing records to populate org_id from users table

  2. Purpose
    - Enable proper RLS policies for user_territories
    - Ensure data isolation per organization
*/

-- Add org_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_territories' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE user_territories 
    ADD COLUMN org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate org_id from users table for existing records
UPDATE user_territories ut
SET org_id = u.org_id
FROM users u
WHERE ut.user_id = u.id AND ut.org_id IS NULL;

-- Make org_id NOT NULL after populating
ALTER TABLE user_territories ALTER COLUMN org_id SET NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_territories_org_id ON user_territories(org_id);

-- Update RLS policies for user_territories
DROP POLICY IF EXISTS "Users can view their own territories" ON user_territories;
DROP POLICY IF EXISTS "Admins can manage territories" ON user_territories;

-- Enable RLS
ALTER TABLE user_territories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own territories
CREATE POLICY "Users can view their own territories"
  ON user_territories FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'role') IN ('super_admin', 'org_admin', 'client_admin')
  );

-- Policy: Admins can insert territories
CREATE POLICY "Admins can insert territories"
  ON user_territories FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('super_admin', 'org_admin', 'client_admin')
    AND org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Policy: Admins can update territories
CREATE POLICY "Admins can update territories"
  ON user_territories FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('super_admin', 'org_admin', 'client_admin')
    AND org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Policy: Admins can delete territories
CREATE POLICY "Admins can delete territories"
  ON user_territories FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('super_admin', 'org_admin', 'client_admin')
    AND org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );