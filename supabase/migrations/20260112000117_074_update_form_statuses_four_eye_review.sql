/*
  # Update Form Submission Statuses and Four-Eye Review

  1. Changes
    - Add `approved_by` field to track who approved the submission
    - Add `rejected_by` field to track who rejected the submission
    - Add `approved_at` and `rejected_at` timestamps for audit trail
    - Update status values to: 'pending', 'approved', 'rejected'
    - Migrate existing 'reviewed' and 'submitted' statuses to 'pending'
    - Migrate existing reviewed_by data to appropriate approved_by/rejected_by columns
    - Change default status from 'submitted' to 'pending'
    - Add check constraint to prevent self-review
  
  2. Security
    - No RLS policy changes needed
    
  3. Implementation Notes
    - Four-eye review: submitter cannot approve/reject their own submission
    - Check constraint ensures approved_by and rejected_by are never the same as submitted_by
*/

-- Add new columns for approved_by and rejected_by
ALTER TABLE form_submissions
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- Migrate existing data: copy reviewed_by to appropriate column based on status
UPDATE form_submissions
SET approved_by = reviewed_by,
    approved_at = reviewed_at
WHERE status = 'approved' AND reviewed_by IS NOT NULL;

UPDATE form_submissions
SET rejected_by = reviewed_by,
    rejected_at = reviewed_at
WHERE status = 'rejected' AND reviewed_by IS NOT NULL;

-- Drop the old status check constraint
ALTER TABLE form_submissions
DROP CONSTRAINT IF EXISTS form_submissions_status_check;

-- Update 'reviewed' status to 'pending'
UPDATE form_submissions
SET status = 'pending'
WHERE status = 'reviewed';

-- Update any 'submitted' status to 'pending'
UPDATE form_submissions
SET status = 'pending'
WHERE status = 'submitted';

-- Add new status check constraint with only: pending, approved, rejected
ALTER TABLE form_submissions
ADD CONSTRAINT form_submissions_status_check 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Change default status to 'pending'
ALTER TABLE form_submissions
ALTER COLUMN status SET DEFAULT 'pending';

-- Add check constraint to prevent self-review (four-eye principle)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'no_self_approval' AND conrelid = 'form_submissions'::regclass
  ) THEN
    ALTER TABLE form_submissions
    ADD CONSTRAINT no_self_approval 
    CHECK (
      (approved_by IS NULL OR approved_by != submitted_by) AND
      (rejected_by IS NULL OR rejected_by != submitted_by)
    );
  END IF;
END $$;

-- Add check constraint to ensure only one review action per submission
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'single_review_action' AND conrelid = 'form_submissions'::regclass
  ) THEN
    ALTER TABLE form_submissions
    ADD CONSTRAINT single_review_action 
    CHECK (
      (approved_by IS NULL AND rejected_by IS NULL) OR
      (approved_by IS NOT NULL AND rejected_by IS NULL) OR
      (approved_by IS NULL AND rejected_by IS NOT NULL)
    );
  END IF;
END $$;

-- Create function to handle form approval
CREATE OR REPLACE FUNCTION approve_form_submission(
  p_submission_id uuid,
  p_reviewer_id uuid,
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submitted_by uuid;
  v_result jsonb;
BEGIN
  -- Get the submitter
  SELECT submitted_by INTO v_submitted_by
  FROM form_submissions
  WHERE id = p_submission_id;

  -- Check if reviewer is trying to review their own submission
  IF v_submitted_by = p_reviewer_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You cannot approve your own submission (four-eye review required)'
    );
  END IF;

  -- Check if already reviewed
  IF EXISTS (
    SELECT 1 FROM form_submissions 
    WHERE id = p_submission_id 
    AND (approved_by IS NOT NULL OR rejected_by IS NOT NULL)
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This submission has already been reviewed and cannot be modified'
    );
  END IF;

  -- Update the submission
  UPDATE form_submissions
  SET 
    status = 'approved',
    approved_by = p_reviewer_id,
    approved_at = now(),
    review_notes = p_review_notes,
    updated_at = now()
  WHERE id = p_submission_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Create function to handle form rejection
CREATE OR REPLACE FUNCTION reject_form_submission(
  p_submission_id uuid,
  p_reviewer_id uuid,
  p_rejection_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submitted_by uuid;
  v_result jsonb;
BEGIN
  -- Get the submitter
  SELECT submitted_by INTO v_submitted_by
  FROM form_submissions
  WHERE id = p_submission_id;

  -- Check if reviewer is trying to review their own submission
  IF v_submitted_by = p_reviewer_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You cannot reject your own submission (four-eye review required)'
    );
  END IF;

  -- Check if already reviewed
  IF EXISTS (
    SELECT 1 FROM form_submissions 
    WHERE id = p_submission_id 
    AND (approved_by IS NOT NULL OR rejected_by IS NOT NULL)
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This submission has already been reviewed and cannot be modified'
    );
  END IF;

  -- Update the submission
  UPDATE form_submissions
  SET 
    status = 'rejected',
    rejected_by = p_reviewer_id,
    rejected_at = now(),
    rejection_reason = p_rejection_reason,
    review_notes = p_rejection_reason,
    updated_at = now()
  WHERE id = p_submission_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION approve_form_submission TO authenticated;
GRANT EXECUTE ON FUNCTION reject_form_submission TO authenticated;
