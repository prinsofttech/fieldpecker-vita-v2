/*
  # Fix Form Submission Status Properly

  1. Changes
    - Drop old status check constraint
    - Update any 'submitted' or 'reviewed' statuses to 'pending'
    - Add new status check constraint allowing only: pending, approved, rejected
  
  2. Notes
    - This ensures four-eye review works correctly
    - Forms with 'pending' status can be reviewed
    - Forms with 'approved' or 'rejected' status are locked
*/

-- Step 1: Drop the old check constraint first
ALTER TABLE form_submissions
DROP CONSTRAINT IF EXISTS form_submissions_status_check;

-- Step 2: Now update any legacy statuses to 'pending' (no constraint in the way)
UPDATE form_submissions
SET status = 'pending'
WHERE status IN ('submitted', 'reviewed');

-- Step 3: Add new constraint with only the three valid statuses
ALTER TABLE form_submissions
ADD CONSTRAINT form_submissions_status_check 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Step 4: Ensure default status is 'pending'
ALTER TABLE form_submissions
ALTER COLUMN status SET DEFAULT 'pending';
