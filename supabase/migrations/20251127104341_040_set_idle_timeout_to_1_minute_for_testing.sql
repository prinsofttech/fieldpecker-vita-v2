/*
  # Set Idle Timeout to 1 Minute for Testing

  ## Overview
  This migration temporarily sets the idle timeout to 1 minute for testing purposes.

  ## Changes
  1. Update default idle_timeout_minutes in trigger functions to 1 minute
  2. Update existing active sessions to 1 minute timeout

  ## Note
  This is temporary for testing. Revert to 30 minutes for production.
*/

-- Update the create_session_on_login function to use 1 minute timeout
CREATE OR REPLACE FUNCTION create_session_on_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_exists boolean;
  v_org_id uuid;
BEGIN
  SELECT EXISTS(SELECT 1 FROM users WHERE id = NEW.id), org_id
  INTO v_user_exists, v_org_id
  FROM users
  WHERE id = NEW.id;

  IF v_user_exists THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_sessions 
      WHERE user_id = NEW.id 
      AND is_active = true 
      AND login_at > now() - interval '1 minute'
    ) THEN
      INSERT INTO user_sessions (
        user_id,
        org_id,
        session_token,
        device_fingerprint,
        device_name,
        ip_address,
        login_at,
        last_activity_at,
        is_active,
        expires_at,
        idle_timeout_minutes
      ) VALUES (
        NEW.id,
        v_org_id,
        COALESCE(NEW.last_sign_in_at::text, gen_random_uuid()::text),
        '{}'::jsonb,
        'Browser',
        '0.0.0.0'::inet,
        now(),
        now(),
        true,
        now() + interval '12 hours',
        1
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Update the ensure_user_session function to use 1 minute timeout
CREATE OR REPLACE FUNCTION ensure_user_session(
  p_user_id uuid,
  p_session_token text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id uuid;
  v_org_id uuid;
  v_token text;
BEGIN
  SELECT org_id INTO v_org_id
  FROM users
  WHERE id = p_user_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_token := COALESCE(p_session_token, gen_random_uuid()::text);

  SELECT id INTO v_session_id
  FROM user_sessions
  WHERE user_id = p_user_id
    AND is_active = true
    AND (session_token = v_token OR session_token IS NULL)
  ORDER BY login_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    INSERT INTO user_sessions (
      user_id,
      org_id,
      session_token,
      device_fingerprint,
      device_name,
      ip_address,
      login_at,
      last_activity_at,
      is_active,
      expires_at,
      idle_timeout_minutes
    ) VALUES (
      p_user_id,
      v_org_id,
      v_token,
      '{}'::jsonb,
      'Browser',
      '0.0.0.0'::inet,
      now(),
      now(),
      true,
      now() + interval '12 hours',
      1
    )
    RETURNING id INTO v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$;

-- Update all existing active sessions to use 1 minute timeout
UPDATE user_sessions
SET idle_timeout_minutes = 1
WHERE is_active = true;
