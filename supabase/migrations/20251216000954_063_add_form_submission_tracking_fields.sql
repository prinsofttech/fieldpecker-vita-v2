/*
  # Add Form Submission Tracking Fields

  ## Changes
  This migration adds additional tracking and metadata fields to the form_submissions table
  to capture comprehensive submission information including:
  - Rejection reason for rejected forms
  - Time spent completing the form
  - Supervisor information (name and code)
  - Form start time for accurate time tracking

  ## New Columns
  1. `rejection_reason` (text)
     - Stores the reason when a form is rejected
     - Required when status is 'rejected'

  2. `time_spent` (interval)
     - Duration taken to complete the form
     - Calculated from form_started_at to submitted_at

  3. `supervisor_name` (text)
     - Name of the supervisor associated with the submission

  4. `supervisor_code` (text)
     - Code/ID of the supervisor

  5. `form_started_at` (timestamptz)
     - Timestamp when user started filling the form
     - Used to calculate time_spent

  ## Notes
  - All new fields are nullable for backward compatibility
  - Existing submissions will have NULL values for new fields
  - Future submissions should populate these fields
*/

-- Add rejection_reason column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_submissions' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE form_submissions ADD COLUMN rejection_reason text;
  END IF;
END $$;

-- Add time_spent column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_submissions' AND column_name = 'time_spent'
  ) THEN
    ALTER TABLE form_submissions ADD COLUMN time_spent interval;
  END IF;
END $$;

-- Add supervisor_name column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_submissions' AND column_name = 'supervisor_name'
  ) THEN
    ALTER TABLE form_submissions ADD COLUMN supervisor_name text;
  END IF;
END $$;

-- Add supervisor_code column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_submissions' AND column_name = 'supervisor_code'
  ) THEN
    ALTER TABLE form_submissions ADD COLUMN supervisor_code text;
  END IF;
END $$;

-- Add form_started_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_submissions' AND column_name = 'form_started_at'
  ) THEN
    ALTER TABLE form_submissions ADD COLUMN form_started_at timestamptz;
  END IF;
END $$;

-- Add index for rejection_reason lookups
CREATE INDEX IF NOT EXISTS idx_submissions_rejection_reason
  ON form_submissions(rejection_reason)
  WHERE rejection_reason IS NOT NULL;

-- Add index for supervisor_code lookups
CREATE INDEX IF NOT EXISTS idx_submissions_supervisor_code
  ON form_submissions(supervisor_code)
  WHERE supervisor_code IS NOT NULL;