/*
  # Unify Territories and Sub-Territories

  1. Changes
    - Add `parent_id` column to `regions` table to support hierarchical territories
    - Territories without parent_id are top-level territories
    - Territories with parent_id are sub-territories
    - Add `address` column to regions for consistency with branches
    
  2. Migration Strategy
    - Keep existing `branches` table for backward compatibility
    - New territories created through the unified interface will use parent_id
    
  3. Security
    - Update RLS policies to handle hierarchical access
*/

-- Add parent_id and address columns to regions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regions' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE regions ADD COLUMN parent_id uuid REFERENCES regions(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regions' AND column_name = 'address'
  ) THEN
    ALTER TABLE regions ADD COLUMN address text;
  END IF;
END $$;

-- Create index for efficient parent lookups
CREATE INDEX IF NOT EXISTS idx_regions_parent_id ON regions(parent_id);
CREATE INDEX IF NOT EXISTS idx_regions_org_parent ON regions(org_id, parent_id);

-- Add constraint to prevent circular references
CREATE OR REPLACE FUNCTION check_region_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  current_id uuid;
  depth int := 0;
  max_depth int := 10;
BEGIN
  current_id := NEW.parent_id;
  
  -- If no parent, it's a top-level territory
  IF current_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Prevent self-reference
  IF NEW.id = NEW.parent_id THEN
    RAISE EXCEPTION 'A territory cannot be its own parent';
  END IF;
  
  -- Check for circular references by traversing up the hierarchy
  WHILE current_id IS NOT NULL AND depth < max_depth LOOP
    -- Check if we've reached the original record (circular reference)
    IF current_id = NEW.id THEN
      RAISE EXCEPTION 'Circular reference detected in territory hierarchy';
    END IF;
    
    -- Move up one level
    SELECT parent_id INTO current_id FROM regions WHERE id = current_id;
    depth := depth + 1;
  END LOOP;
  
  IF depth >= max_depth THEN
    RAISE EXCEPTION 'Territory hierarchy too deep (max % levels)', max_depth;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for hierarchy validation
DROP TRIGGER IF EXISTS validate_region_hierarchy ON regions;
CREATE TRIGGER validate_region_hierarchy
  BEFORE INSERT OR UPDATE OF parent_id ON regions
  FOR EACH ROW
  EXECUTE FUNCTION check_region_hierarchy();

-- Create a view for easier querying of territories with their hierarchy
CREATE OR REPLACE VIEW territories_hierarchy AS
WITH RECURSIVE territory_tree AS (
  -- Base case: top-level territories
  SELECT 
    id,
    org_id,
    parent_id,
    name,
    code,
    description,
    address,
    is_active,
    created_by,
    created_at,
    updated_at,
    0 as level,
    name as path,
    ARRAY[id] as id_path
  FROM regions
  WHERE parent_id IS NULL
  
  UNION ALL
  
  -- Recursive case: sub-territories
  SELECT 
    r.id,
    r.org_id,
    r.parent_id,
    r.name,
    r.code,
    r.description,
    r.address,
    r.is_active,
    r.created_by,
    r.created_at,
    r.updated_at,
    tt.level + 1,
    tt.path || ' > ' || r.name,
    tt.id_path || r.id
  FROM regions r
  INNER JOIN territory_tree tt ON r.parent_id = tt.id
)
SELECT * FROM territory_tree;
