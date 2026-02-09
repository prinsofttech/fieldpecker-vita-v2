/*
  # Fix session_config RLS policies - incorrect JWT path

  1. Changes
    - Drop existing policies that use incorrect JWT path `auth.jwt() ->> 'role'`
    - Recreate policies using correct path `auth.jwt() -> 'app_metadata' ->> 'role'`
    - Split ALL policy into separate SELECT, INSERT, UPDATE, DELETE policies

  2. Security
    - Client admins can read and manage session config for their own organization
    - Super admins can read and manage all session configs
    - All policies properly check authentication and ownership
*/

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_config' AND policyname = 'Admins can manage session config') THEN
    DROP POLICY "Admins can manage session config" ON session_config;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'session_config' AND policyname = 'Admins can view session config') THEN
    DROP POLICY "Admins can view session config" ON session_config;
  END IF;
END $$;

CREATE POLICY "Client admins can view own org session config"
  ON session_config FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin')
    OR (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
      AND org_id = (SELECT u.org_id FROM users u WHERE u.id = auth.uid())
    )
  );

CREATE POLICY "Client admins can insert own org session config"
  ON session_config FOR INSERT
  TO authenticated
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin')
    OR (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
      AND org_id = (SELECT u.org_id FROM users u WHERE u.id = auth.uid())
    )
  );

CREATE POLICY "Client admins can update own org session config"
  ON session_config FOR UPDATE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin')
    OR (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
      AND org_id = (SELECT u.org_id FROM users u WHERE u.id = auth.uid())
    )
  )
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin')
    OR (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
      AND org_id = (SELECT u.org_id FROM users u WHERE u.id = auth.uid())
    )
  );

CREATE POLICY "Client admins can delete own org session config"
  ON session_config FOR DELETE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin')
    OR (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
      AND org_id = (SELECT u.org_id FROM users u WHERE u.id = auth.uid())
    )
  );
