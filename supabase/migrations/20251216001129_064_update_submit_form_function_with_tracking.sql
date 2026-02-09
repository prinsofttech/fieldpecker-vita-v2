/*
  # Update submit_form Function with Tracking Fields

  ## Changes
  Updates the submit_form database function to accept and store additional tracking fields:
  - time_spent: Duration taken to complete the form
  - supervisor_name: Name of the supervisor
  - supervisor_code: Supervisor's code/ID
  - form_started_at: When the user started filling the form

  ## Updated Function Signature
  The function now accepts these additional parameters and stores them in the form_submissions table.
*/

CREATE OR REPLACE FUNCTION submit_form(
  p_form_id uuid,
  p_agent_id uuid,
  p_submission_data jsonb,
  p_submitted_by uuid DEFAULT NULL,
  p_latitude decimal DEFAULT NULL,
  p_longitude decimal DEFAULT NULL,
  p_time_spent text DEFAULT NULL,
  p_supervisor_name text DEFAULT NULL,
  p_supervisor_code text DEFAULT NULL,
  p_form_started_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_visibility jsonb;
  v_log record;
  v_form record;
  v_submission_id uuid;
  v_new_cycle integer;
  v_freeze_expires timestamptz;
BEGIN
  -- Check visibility
  v_visibility := evaluate_form_visibility(p_form_id, p_agent_id);

  IF NOT (v_visibility->>'visible')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'form_not_visible',
      'details', v_visibility
    );
  END IF;

  -- Get log record
  SELECT * INTO v_log
  FROM form_submissions_log
  WHERE id = (v_visibility->>'log_id')::uuid;

  -- Get form config
  SELECT * INTO v_form
  FROM forms
  WHERE id = p_form_id;

  -- Calculate new cycle and freeze time
  v_new_cycle := v_log.current_cycle + 1;

  IF v_form.enable_freeze THEN
    v_freeze_expires := now() + v_form.cycle_freeze_duration;
  END IF;

  -- Insert submission with all tracking fields
  INSERT INTO form_submissions (
    form_id,
    agent_id,
    log_id,
    submission_data,
    cycle_number,
    submitted_by,
    latitude,
    longitude,
    time_spent,
    supervisor_name,
    supervisor_code,
    form_started_at
  ) VALUES (
    p_form_id,
    p_agent_id,
    v_log.id,
    p_submission_data,
    v_new_cycle,
    COALESCE(p_submitted_by, p_agent_id::uuid),
    p_latitude,
    p_longitude,
    p_time_spent::interval,
    p_supervisor_name,
    p_supervisor_code,
    p_form_started_at
  )
  RETURNING id INTO v_submission_id;

  -- Update log
  UPDATE form_submissions_log
  SET
    current_cycle = v_new_cycle,
    submissions_count = submissions_count + 1,
    last_submission_at = now(),
    is_frozen = COALESCE(v_form.enable_freeze, false),
    freeze_expires_at = v_freeze_expires,
    updated_at = now()
  WHERE id = v_log.id;

  RETURN jsonb_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'cycle_number', v_new_cycle,
    'frozen_until', v_freeze_expires
  );
END;
$$;