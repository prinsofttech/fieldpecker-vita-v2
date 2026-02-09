/*
  # Fix Team Hierarchy Function to Use Users Table

  1. Changes
    - Update get_team_hierarchy to query users table instead of non-existent team_members table
    - Use reports_to_user_id column from users table
    - This will properly return the team hierarchy for supervisors viewing their team's forms

  2. Security
    - Maintains SECURITY DEFINER for proper access
    - All dependent policies remain intact
*/

-- Drop policies that depend on get_team_hierarchy
DROP POLICY IF EXISTS "Supervisors can view team logs" ON form_submissions_log;
DROP POLICY IF EXISTS "Supervisors can view team submissions" ON form_submissions;
DROP POLICY IF EXISTS "Reviewers can update submission status" ON form_submissions;

-- Drop and recreate the function to use users table
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
    -- Base case: direct reports from users table
    SELECT
      u.id as subordinate_id,
      1 as hierarchy_level,
      ARRAY[p_user_id, u.id] as reporting_path
    FROM users u
    WHERE u.reports_to_user_id = p_user_id
      AND u.status = 'active'

    UNION ALL

    -- Recursive case: reports of reports
    SELECT
      u.id,
      tt.hierarchy_level + 1,
      tt.reporting_path || u.id
    FROM users u
    INNER JOIN team_tree tt ON u.reports_to_user_id = tt.subordinate_id
    WHERE NOT u.id = ANY(tt.reporting_path)
      AND u.status = 'active'
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

COMMENT ON FUNCTION get_team_hierarchy IS 'Returns hierarchical team structure from users table using reports_to_user_id';
