/*
  # Fix lead_ranks RLS policies - use correct JWT path

  ## Problem
  The lead_ranks RLS policies reference `auth.jwt()->>'role'` and `auth.jwt()->>'org_id'`
  directly, but these values are stored inside `app_metadata` in the JWT.

  ## Changes
  - Drop and recreate all 4 RLS policies on `lead_ranks` table
  - Use `auth.jwt() -> 'app_metadata' ->> 'role'` for role checks
  - Use `(auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid` for org_id checks
  - This matches the pattern used by all other tables in the system
*/

DROP POLICY IF EXISTS "Users can view their organization lead ranks" ON lead_ranks;
DROP POLICY IF EXISTS "Admins can insert lead ranks" ON lead_ranks;
DROP POLICY IF EXISTS "Admins can update lead ranks" ON lead_ranks;
DROP POLICY IF EXISTS "Admins can delete non-system lead ranks" ON lead_ranks;

CREATE POLICY "Users can view their organization lead ranks"
  ON lead_ranks FOR SELECT
  TO authenticated
  USING (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY "Admins can insert lead ranks"
  ON lead_ranks FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
  );

CREATE POLICY "Admins can update lead ranks"
  ON lead_ranks FOR UPDATE
  TO authenticated
  USING (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
  )
  WITH CHECK (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
  );

CREATE POLICY "Admins can delete non-system lead ranks"
  ON lead_ranks FOR DELETE
  TO authenticated
  USING (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
    AND is_system = false
  );
