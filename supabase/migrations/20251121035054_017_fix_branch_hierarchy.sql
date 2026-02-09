/*
  # Fix Branch Hierarchy to Belong to Regions

  1. Changes
    - Remove `organization_id` foreign key from `branches` table
    - Add `region_id` foreign key to `branches` table
    - Update RLS policies for branches to check region membership
    - Add helper function to check if user can access branch via region
  
  2. Security
    - Update RLS policies to verify access through region hierarchy
    - Ensure branches can only be accessed by users in the parent region's organization
*/

-- Drop existing policies on branches
DROP POLICY IF EXISTS "Users can view branches in their organization" ON branches;
DROP POLICY IF EXISTS "Org admins can insert branches" ON branches;
DROP POLICY IF EXISTS "Org admins can update branches" ON branches;
DROP POLICY IF EXISTS "Org admins can delete branches" ON branches;

-- Add region_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'region_id'
  ) THEN
    ALTER TABLE branches ADD COLUMN region_id uuid REFERENCES regions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_branches_region_id ON branches(region_id);

-- Create helper function to check if user can access branch
CREATE OR REPLACE FUNCTION user_can_access_branch(branch_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  branch_region_id uuid;
  region_org_id uuid;
  user_org_id uuid;
BEGIN
  -- Get the region_id from the branch
  SELECT region_id INTO branch_region_id
  FROM branches
  WHERE id = branch_uuid;

  IF branch_region_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get the organization_id from the region
  SELECT organization_id INTO region_org_id
  FROM regions
  WHERE id = branch_region_id;

  IF region_org_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get user's organization_id from JWT claims
  user_org_id := (auth.jwt()->>'organization_id')::uuid;

  -- Check if user's organization matches
  RETURN user_org_id = region_org_id;
END;
$$;

-- Create new RLS policies for branches
CREATE POLICY "Users can view branches in their organization regions"
  ON branches
  FOR SELECT
  TO authenticated
  USING (user_can_access_branch(id));

CREATE POLICY "Org admins can insert branches in their organization regions"
  ON branches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role' = 'org_admin' OR auth.jwt()->>'role' = 'super_admin')
    AND user_can_access_branch(id)
  );

CREATE POLICY "Org admins can update branches in their organization regions"
  ON branches
  FOR UPDATE
  TO authenticated
  USING (user_can_access_branch(id))
  WITH CHECK (
    (auth.jwt()->>'role' = 'org_admin' OR auth.jwt()->>'role' = 'super_admin')
    AND user_can_access_branch(id)
  );

CREATE POLICY "Org admins can delete branches in their organization regions"
  ON branches
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt()->>'role' = 'org_admin' OR auth.jwt()->>'role' = 'super_admin')
    AND user_can_access_branch(id)
  );
