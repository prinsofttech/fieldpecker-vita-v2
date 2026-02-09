/*
  # Remove 'critical' priority from issues table

  1. Changes
    - Update priority CHECK constraint to only allow 'low', 'medium', 'high'
    - Update any existing 'critical' issues to 'high' priority
  
  2. Security
    - No RLS changes needed
*/

-- First, update any existing critical priority issues to high
UPDATE issues
SET priority = 'high'
WHERE priority = 'critical';

-- Drop the old constraint
ALTER TABLE issues
DROP CONSTRAINT IF EXISTS issues_priority_check;

-- Add new constraint without 'critical'
ALTER TABLE issues
ADD CONSTRAINT issues_priority_check 
CHECK (priority IN ('low', 'medium', 'high'));
