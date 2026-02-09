/*
  # Add date filtering to territory metrics

  1. Modified Functions
    - `get_territory_metrics` - Added optional `p_start_date` and `p_end_date` parameters
      - When provided, form submission counts are filtered to the given date range
      - Customer counts remain unfiltered (always show total)
      - Defaults to no date filter for backward compatibility

  2. Purpose
    - Allow dashboard Distribution component to show current month data only
    - Keep the function flexible for other date ranges
*/

CREATE OR REPLACE FUNCTION get_territory_metrics(
  p_org_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE(region_id uuid, region_name text, customer_count bigint, form_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH region_customers AS (
    SELECT c.region_id, COUNT(*) AS cnt
    FROM customers c
    WHERE c.org_id = p_org_id AND c.region_id IS NOT NULL
    GROUP BY c.region_id
  ),
  region_forms AS (
    SELECT c.region_id, COUNT(*) AS cnt
    FROM form_submissions fs
    JOIN forms f ON f.id = fs.form_id
    JOIN customers c ON c.id = fs.agent_id
    WHERE f.org_id = p_org_id
      AND c.region_id IS NOT NULL
      AND (p_start_date IS NULL OR fs.submitted_at >= p_start_date)
      AND (p_end_date IS NULL OR fs.submitted_at <= p_end_date)
    GROUP BY c.region_id
  )
  SELECT
    r.id AS region_id,
    r.name AS region_name,
    COALESCE(rc.cnt, 0) AS customer_count,
    COALESCE(rf.cnt, 0) AS form_count
  FROM regions r
  LEFT JOIN region_customers rc ON rc.region_id = r.id
  LEFT JOIN region_forms rf ON rf.region_id = r.id
  WHERE r.org_id = p_org_id AND r.is_active = true
  ORDER BY r.name;
$$;
