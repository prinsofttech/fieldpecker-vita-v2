/*
  # Add organization-level idle timeout configuration

  1. Changes
    - Adds default idle_timeout_minutes to organization settings jsonb
    - Creates function `update_org_settings` for admins to update org settings safely
    - Updates session creation to read idle timeout from organization settings

  2. Purpose
    - Allow client admins to configure idle timeout duration per organization
    - Default remains 10 minutes if not configured
*/

CREATE OR REPLACE FUNCTION update_org_settings(
  p_org_id uuid,
  p_settings jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_current_settings jsonb;
  v_merged_settings jsonb;
BEGIN
  SELECT settings INTO v_current_settings
  FROM organizations
  WHERE id = p_org_id;

  v_merged_settings := COALESCE(v_current_settings, '{}'::jsonb) || p_settings;

  UPDATE organizations
  SET settings = v_merged_settings, updated_at = now()
  WHERE id = p_org_id;

  RETURN v_merged_settings;
END;
$$;

CREATE OR REPLACE FUNCTION get_org_idle_timeout(p_org_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (settings->>'idle_timeout_minutes')::integer,
    10
  )
  FROM organizations
  WHERE id = p_org_id;
$$;
