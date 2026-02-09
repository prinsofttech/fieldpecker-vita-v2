/*
  # Fix submit_form function and enforce pending status

  1. Changes
    - Replace the submit_form function to:
      - Accept p_submitted_by parameter (the authenticated user's ID)
      - Set status to 'pending' instead of 'submitted'
      - Store submitted_by in the form_submissions row
    - Update all existing rows with status 'submitted' to 'pending'
    - Add check constraint to only allow: pending, approved, rejected

  2. Notes
    - The previous version of submit_form was missing the submitted_by parameter
    - The previous version hardcoded status as 'submitted' which is not a valid status
    - Only pending, approved, and rejected are valid statuses
*/

-- Step 1: Update existing 'submitted' rows to 'pending'
UPDATE form_submissions
SET status = 'pending'
WHERE status = 'submitted';

-- Step 2: Drop old function and recreate with correct signature
DROP FUNCTION IF EXISTS submit_form(uuid, uuid, timestamptz, timestamptz, double precision, double precision, jsonb, text, text, integer);

CREATE OR REPLACE FUNCTION submit_form(
  p_agent_id uuid,
  p_form_id uuid,
  p_form_started_at timestamptz DEFAULT NULL,
  p_form_end_time timestamptz DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_submission_data jsonb DEFAULT '{}'::jsonb,
  p_supervisor_code text DEFAULT NULL,
  p_supervisor_name text DEFAULT NULL,
  p_time_spent integer DEFAULT NULL,
  p_submitted_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cycle_number INTEGER;
  v_submission_id UUID;
  v_result JSON;
BEGIN
  SELECT COALESCE(MAX(cycle_number), 0) + 1
  INTO v_cycle_number
  FROM form_submissions
  WHERE form_id = p_form_id
    AND agent_id = p_agent_id;

  INSERT INTO form_submissions (
    form_id,
    agent_id,
    submission_data,
    cycle_number,
    latitude,
    longitude,
    form_started_at,
    form_end_time,
    status,
    submitted_at,
    submitted_by,
    supervisor_name,
    supervisor_code,
    time_spent
  )
  VALUES (
    p_form_id,
    p_agent_id,
    p_submission_data,
    v_cycle_number,
    p_latitude,
    p_longitude,
    p_form_started_at,
    p_form_end_time,
    'pending',
    NOW(),
    COALESCE(p_submitted_by, auth.uid()),
    p_supervisor_name,
    p_supervisor_code,
    make_interval(secs => p_time_spent)
  )
  RETURNING id INTO v_submission_id;

  v_result := json_build_object(
    'success', true,
    'message', 'Form submitted successfully',
    'submission_id', v_submission_id,
    'cycle_number', v_cycle_number
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to submit form: ' || SQLERRM
    );
END;
$$;

-- Step 3: Add check constraint (drop first if exists)
ALTER TABLE form_submissions
DROP CONSTRAINT IF EXISTS form_submissions_status_check;

ALTER TABLE form_submissions
ADD CONSTRAINT form_submissions_status_check
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Step 4: Ensure column default is pending
ALTER TABLE form_submissions
ALTER COLUMN status SET DEFAULT 'pending';
