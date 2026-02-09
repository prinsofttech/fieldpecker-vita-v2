/*
  # Add Check-in Module and Admin RLS Policies

  1. Module Registration
    - Insert 'check_in' into the modules table so it can be enabled per-organization

  2. Security Changes
    - Add SELECT policy for admins (client_admin, super_admin) to view all checkins within their org
    - Add UPDATE policy for admins to update checkins within their org (e.g., manual check-in)

  3. Notes
    - Existing user-level RLS policies remain intact (users can still manage their own checkins)
    - Admin visibility is scoped to org_id to maintain data isolation between organizations
    - The org_id is verified via the user's JWT app_metadata
*/

INSERT INTO modules (name, display_name, description, icon)
VALUES ('check_in', 'Check-In', 'Track field agent check-ins and check-outs with location data', 'user-check')
ON CONFLICT (name) DO NOTHING;

CREATE POLICY "Admins can view all org checkins"
  ON checkins
  FOR SELECT
  TO authenticated
  USING (
    org_id = (
      coalesce(
        current_setting('request.jwt.claims', true)::json->'app_metadata'->>'org_id',
        ''
      )
    )::uuid
    AND coalesce(
      current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
      ''
    ) IN ('super_admin', 'client_admin')
  );

CREATE POLICY "Admins can update org checkins"
  ON checkins
  FOR UPDATE
  TO authenticated
  USING (
    org_id = (
      coalesce(
        current_setting('request.jwt.claims', true)::json->'app_metadata'->>'org_id',
        ''
      )
    )::uuid
    AND coalesce(
      current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
      ''
    ) IN ('super_admin', 'client_admin')
  )
  WITH CHECK (
    org_id = (
      coalesce(
        current_setting('request.jwt.claims', true)::json->'app_metadata'->>'org_id',
        ''
      )
    )::uuid
    AND coalesce(
      current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
      ''
    ) IN ('super_admin', 'client_admin')
  );
