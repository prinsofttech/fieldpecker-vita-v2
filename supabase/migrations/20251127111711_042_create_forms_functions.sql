/*
  # Forms Module - Database Functions

  ## Overview
  This migration creates all the database functions needed for the forms module including:
  - Criteria evaluation
  - Form visibility evaluation
  - Form submission
  - Team hierarchy access
  - Monthly reset automation

  ## Functions Created

  ### 1. `evaluate_criteria`
  Evaluates dynamic criteria rules against customer/agent data

  ### 2. `evaluate_form_visibility`
  Determines if a form is visible/accessible to a specific agent at a given time

  ### 3. `submit_form`
  Handles the complete form submission flow with validation and logging

  ### 4. `get_team_hierarchy`
  Retrieves all subordinates in a user's reporting hierarchy

  ### 5. `can_access_agent_form`
  Checks if a user has permission to access a specific agent's form data

  ### 6. `reset_monthly_form_logs`
  Automated function for monthly log resets

  ## Security
  - All functions use SECURITY DEFINER
  - Permission checks integrated into functions
  - Input validation included
*/

-- 1. EVALUATE CRITERIA FUNCTION
CREATE OR REPLACE FUNCTION evaluate_criteria(
  p_criteria jsonb,
  p_agent_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rule jsonb;
  v_field text;
  v_operator text;
  v_value text;
  v_agent_value text;
  v_agent_record customers%ROWTYPE;
BEGIN
  -- If no criteria, always pass
  IF p_criteria IS NULL OR jsonb_array_length(p_criteria) = 0 THEN
    RETURN true;
  END IF;

  -- Get agent record
  SELECT * INTO v_agent_record
  FROM customers
  WHERE id = p_agent_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Evaluate each rule (AND logic)
  FOR v_rule IN SELECT * FROM jsonb_array_elements(p_criteria)
  LOOP
    v_field := v_rule->>'field';
    v_operator := v_rule->>'operator';
    v_value := v_rule->>'value';

    -- Get agent's field value based on field name
    CASE v_field
      WHEN 'full_name' THEN v_agent_value := v_agent_record.full_name;
      WHEN 'email' THEN v_agent_value := v_agent_record.email;
      WHEN 'phone' THEN v_agent_value := v_agent_record.phone;
      WHEN 'status' THEN v_agent_value := v_agent_record.status;
      WHEN 'agent_code' THEN v_agent_value := v_agent_record.agent_code;
      ELSE
        RAISE EXCEPTION 'Unknown field: %', v_field;
    END CASE;

    -- Evaluate based on operator
    CASE v_operator
      WHEN 'equals' THEN
        IF v_agent_value IS DISTINCT FROM v_value THEN
          RETURN false;
        END IF;
      WHEN 'not_equals' THEN
        IF v_agent_value = v_value THEN
          RETURN false;
        END IF;
      WHEN 'contains' THEN
        IF v_agent_value NOT LIKE '%' || v_value || '%' THEN
          RETURN false;
        END IF;
      WHEN 'starts_with' THEN
        IF v_agent_value NOT LIKE v_value || '%' THEN
          RETURN false;
        END IF;
      WHEN 'ends_with' THEN
        IF v_agent_value NOT LIKE '%' || v_value THEN
          RETURN false;
        END IF;
      ELSE
        RAISE EXCEPTION 'Unknown operator: %', v_operator;
    END CASE;
  END LOOP;

  RETURN true;
END;
$$;

-- 2. EVALUATE FORM VISIBILITY FUNCTION
CREATE OR REPLACE FUNCTION evaluate_form_visibility(
  p_form_id uuid,
  p_agent_id uuid,
  p_check_time timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_form record;
  v_log record;
  v_attachment record;
  v_current_month date;
BEGIN
  v_current_month := date_trunc('month', p_check_time)::date;

  -- Get form configuration
  SELECT * INTO v_form
  FROM forms
  WHERE id = p_form_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'visible', false,
      'reason', 'form_not_found_or_inactive'
    );
  END IF;

  -- Check if form is attached to customer
  IF v_form.attach_to_customer THEN
    SELECT * INTO v_attachment
    FROM form_customer_attachments
    WHERE form_id = p_form_id
    AND customer_id = p_agent_id
    AND is_active = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'visible', false,
        'reason', 'not_attached_to_customer'
      );
    END IF;

    -- Evaluate criteria
    IF NOT evaluate_criteria(v_attachment.criteria, p_agent_id) THEN
      RETURN jsonb_build_object(
        'visible', false,
        'reason', 'criteria_not_met',
        'criteria', v_attachment.criteria
      );
    END IF;
  END IF;

  -- Get or create submission log for current month
  SELECT * INTO v_log
  FROM form_submissions_log
  WHERE form_id = p_form_id
  AND agent_id = p_agent_id
  AND tracking_month = v_current_month;

  IF NOT FOUND THEN
    -- Create log entry for this month
    INSERT INTO form_submissions_log (
      form_id,
      agent_id,
      tracking_month,
      max_cycles_allowed,
      config_snapshot
    ) VALUES (
      p_form_id,
      p_agent_id,
      v_current_month,
      v_form.cycles_per_month,
      jsonb_build_object(
        'cycles_per_month', v_form.cycles_per_month,
        'enable_freeze', v_form.enable_freeze,
        'cycle_freeze_duration', v_form.cycle_freeze_duration::text
      )
    )
    RETURNING * INTO v_log;
  END IF;

  -- Check if frozen
  IF v_log.is_frozen AND v_log.freeze_expires_at > p_check_time THEN
    RETURN jsonb_build_object(
      'visible', false,
      'reason', 'form_frozen',
      'freeze_expires_at', v_log.freeze_expires_at,
      'remaining_seconds', EXTRACT(EPOCH FROM (v_log.freeze_expires_at - p_check_time))
    );
  END IF;

  -- Auto-unfreeze if freeze expired
  IF v_log.is_frozen AND v_log.freeze_expires_at <= p_check_time THEN
    UPDATE form_submissions_log
    SET is_frozen = false, freeze_expires_at = NULL
    WHERE id = v_log.id;
    v_log.is_frozen := false;
  END IF;

  -- Check if max cycles reached
  IF v_log.current_cycle >= v_log.max_cycles_allowed THEN
    RETURN jsonb_build_object(
      'visible', false,
      'reason', 'max_cycles_reached',
      'current_cycle', v_log.current_cycle,
      'max_cycles', v_log.max_cycles_allowed
    );
  END IF;

  -- Form is visible
  RETURN jsonb_build_object(
    'visible', true,
    'reason', 'accessible',
    'current_cycle', v_log.current_cycle,
    'max_cycles', v_log.max_cycles_allowed,
    'remaining_submissions', v_log.max_cycles_allowed - v_log.current_cycle,
    'log_id', v_log.id
  );
END;
$$;

-- 3. SUBMIT FORM FUNCTION
CREATE OR REPLACE FUNCTION submit_form(
  p_form_id uuid,
  p_agent_id uuid,
  p_submission_data jsonb,
  p_submitted_by uuid DEFAULT NULL,
  p_latitude decimal DEFAULT NULL,
  p_longitude decimal DEFAULT NULL
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

  -- Insert submission
  INSERT INTO form_submissions (
    form_id,
    agent_id,
    log_id,
    submission_data,
    cycle_number,
    submitted_by,
    latitude,
    longitude
  ) VALUES (
    p_form_id,
    p_agent_id,
    v_log.id,
    p_submission_data,
    v_new_cycle,
    COALESCE(p_submitted_by, p_agent_id::uuid),
    p_latitude,
    p_longitude
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

-- 4. GET TEAM HIERARCHY FUNCTION (already exists, but ensure it's available)
CREATE OR REPLACE FUNCTION get_team_hierarchy(p_user_id uuid)
RETURNS TABLE (
  subordinate_id uuid,
  hierarchy_level integer,
  reporting_path uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE team_tree AS (
    -- Base case: direct reports
    SELECT
      id as subordinate_id,
      1 as hierarchy_level,
      ARRAY[p_user_id, id] as reporting_path
    FROM customers
    WHERE supervisor_id = p_user_id

    UNION ALL

    -- Recursive case: reports of reports
    SELECT
      c.id,
      tt.hierarchy_level + 1,
      tt.reporting_path || c.id
    FROM customers c
    INNER JOIN team_tree tt ON c.supervisor_id = tt.subordinate_id
    WHERE NOT c.id = ANY(tt.reporting_path)
  )
  SELECT * FROM team_tree;
END;
$$;

-- 5. CAN ACCESS AGENT FORM FUNCTION
CREATE OR REPLACE FUNCTION can_access_agent_form(
  p_user_id uuid,
  p_agent_id uuid,
  p_form_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
  v_is_subordinate boolean;
  v_same_org boolean;
BEGIN
  -- Get user role
  SELECT r.name INTO v_user_role
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.id = p_user_id;

  -- Admin and client_admin can access all
  IF v_user_role IN ('super_admin', 'client_admin') THEN
    RETURN true;
  END IF;

  -- Check if agent is in user's hierarchy
  SELECT EXISTS(
    SELECT 1 FROM get_team_hierarchy(p_user_id)
    WHERE subordinate_id = p_agent_id
  ) INTO v_is_subordinate;

  -- Check if same organization
  SELECT EXISTS(
    SELECT 1 FROM users u1
    JOIN customers c ON c.id = p_agent_id
    WHERE u1.id = p_user_id
    AND u1.org_id = c.org_id
  ) INTO v_same_org;

  -- User can access their own forms or subordinate forms in same org
  RETURN (v_is_subordinate OR p_user_id::text = p_agent_id::text) AND v_same_org;
END;
$$;

-- 6. MONTHLY RESET FUNCTION
CREATE OR REPLACE FUNCTION reset_monthly_form_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_month date;
  v_current_month date;
  v_archived_count integer;
BEGIN
  v_current_month := date_trunc('month', now())::date;
  v_last_month := (v_current_month - interval '1 month')::date;

  -- Count logs from last month
  SELECT COUNT(*) INTO v_archived_count
  FROM form_submissions_log
  WHERE tracking_month = v_last_month;

  -- Log the reset event
  INSERT INTO system_events (
    event_type,
    event_data,
    created_at
  ) VALUES (
    'monthly_form_log_reset',
    jsonb_build_object(
      'reset_month', v_current_month,
      'previous_month', v_last_month,
      'logs_count', v_archived_count
    ),
    now()
  );

  RETURN v_archived_count;
END;
$$;
