/*
  # Add org_id to user_branches table

  1. Changes
    - Add org_id column to user_branches table
    - Add foreign key constraint to organizations table
    - Create index for faster lookups
    - Update existing records to populate org_id from users table

  2. Purpose
    - Enable proper RLS policies for user_branches
    - Ensure data isolation per organization
*/

-- Add org_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_branches' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE user_branches 
    ADD COLUMN org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate org_id from users table for existing records
UPDATE user_branches ub
SET org_id = u.org_id
FROM users u
WHERE ub.user_id = u.id AND ub.org_id IS NULL;

-- Make org_id NOT NULL after populating
ALTER TABLE user_branches ALTER COLUMN org_id SET NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_branches_org_id ON user_branches(org_id);

-- Update RLS policies for user_branches
DROP POLICY IF EXISTS "Users can view their own branches" ON user_branches;
DROP POLICY IF EXISTS "Admins can manage branches" ON user_branches;

-- Enable RLS
ALTER TABLE user_branches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own branches
CREATE POLICY "Users can view their own branches"
  ON user_branches FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'role') IN ('super_admin', 'org_admin', 'client_admin')
  );

-- Policy: Admins can insert user branches
CREATE POLICY "Admins can insert user branches"
  ON user_branches FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('super_admin', 'org_admin', 'client_admin')
    AND org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Policy: Admins can update user branches
CREATE POLICY "Admins can update user branches"
  ON user_branches FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('super_admin', 'org_admin', 'client_admin')
    AND org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Policy: Admins can delete user branches
CREATE POLICY "Admins can delete user branches"
  ON user_branches FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('super_admin', 'org_admin', 'client_admin')
    AND org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );