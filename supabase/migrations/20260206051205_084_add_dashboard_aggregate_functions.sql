/*
  # Dashboard Aggregate Functions

  1. New Functions
    - `get_monthly_activity_stats` - Returns monthly form submissions and issues counts for the current year
      - Parameters: `p_org_id` (uuid)
      - Returns: month number, form submission count, issues count
    - `get_territory_metrics` - Returns customer count and form submission count per region
      - Parameters: `p_org_id` (uuid)
      - Returns: region id, region name, customer count, form submission count

  2. Purpose
    - Replace 24+ individual queries with 2 efficient aggregate queries
    - Eliminate client-side pagination loops for territory data
    - Significantly improve dashboard load time
*/

CREATE OR REPLACE FUNCTION get_monthly_activity_stats(p_org_id uuid)
RETURNS TABLE(month_num int, forms_count bigint, issues_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH months AS (
    SELECT generate_series(1, 12) AS m
  ),
  form_counts AS (
    SELECT EXTRACT(MONTH FROM fs.submitted_at)::int AS m, COUNT(*) AS cnt
    FROM form_submissions fs
    JOIN forms f ON f.id = fs.form_id
    WHERE f.org_id = p_org_id
      AND fs.submitted_at >= date_trunc('year', CURRENT_DATE)
      AND fs.submitted_at < date_trunc('year', CURRENT_DATE) + interval '1 year'
    GROUP BY 1
  ),
  issue_counts AS (
    SELECT EXTRACT(MONTH FROM created_at)::int AS m, COUNT(*) AS cnt
    FROM issues
    WHERE org_id = p_org_id
      AND created_at >= date_trunc('year', CURRENT_DATE)
      AND created_at < date_trunc('year', CURRENT_DATE) + interval '1 year'
    GROUP BY 1
  )
  SELECT
    months.m AS month_num,
    COALESCE(fc.cnt, 0) AS forms_count,
    COALESCE(ic.cnt, 0) AS issues_count
  FROM months
  LEFT JOIN form_counts fc ON fc.m = months.m
  LEFT JOIN issue_counts ic ON ic.m = months.m
  ORDER BY months.m;
$$;

CREATE OR REPLACE FUNCTION get_territory_metrics(p_org_id uuid)
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
    WHERE f.org_id = p_org_id AND c.region_id IS NOT NULL
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
