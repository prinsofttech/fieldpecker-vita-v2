/*
  # Fix Forms Functions Customer Column References

  1. Changes
    - Fix get_team_hierarchy function to work with actual customer schema
    - Customers don't have supervisor_id (UUID), they have supervisor_code (text)
    - The team hierarchy is actually based on users (team_members table), not customers
    - Drop dependent policies and recreate them after function fix

  2. Security
    - Function remains SECURITY DEFINER for proper access
    - Recreate all RLS policies that depend on this function
*/

-- Drop policies that depend on get_team_hierarchy
DROP POLICY IF EXISTS "Supervisors can view team logs" ON form_submissions_log;
DROP POLICY IF EXISTS "Supervisors can view team submissions" ON form_submissions;
DROP POLICY IF EXISTS "Reviewers can update submission status" ON form_submissions;

-- Drop and recreate the get_team_hierarchy function to work with team_members table
DROP FUNCTION IF EXISTS get_team_hierarchy(uuid);

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
    -- Base case: direct reports from team_members table
    SELECT
      tm.member_id as subordinate_id,
      1 as hierarchy_level,
      ARRAY[p_user_id, tm.member_id] as reporting_path
    FROM team_members tm
    WHERE tm.supervisor_id = p_user_id
      AND tm.is_active = true

    UNION ALL

    -- Recursive case: reports of reports
    SELECT
      tm.member_id,
      tt.hierarchy_level + 1,
      tt.reporting_path || tm.member_id
    FROM team_members tm
    INNER JOIN team_tree tt ON tm.supervisor_id = tt.subordinate_id
    WHERE NOT tm.member_id = ANY(tt.reporting_path)
      AND tm.is_active = true
  )
  SELECT * FROM team_tree;
END;
$$;

-- Recreate the RLS policies
CREATE POLICY "Supervisors can view team logs"
  ON form_submissions_log FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT subordinate_id FROM get_team_hierarchy(auth.uid())
    )
  );

CREATE POLICY "Supervisors can view team submissions"
  ON form_submissions FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT subordinate_id FROM get_team_hierarchy(auth.uid())
    )
  );

CREATE POLICY "Reviewers can update submission status"
  ON form_submissions FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    OR
    agent_id IN (
      SELECT subordinate_id FROM get_team_hierarchy(auth.uid())
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    OR
    agent_id IN (
      SELECT subordinate_id FROM get_team_hierarchy(auth.uid())
    )
  );

COMMENT ON FUNCTION get_team_hierarchy IS 'Returns hierarchical team structure from team_members table, not customers';
