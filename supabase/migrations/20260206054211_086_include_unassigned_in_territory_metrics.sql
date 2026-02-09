/*
  # Include unassigned customers in territory metrics

  1. Modified Functions
    - `get_territory_metrics` - Now includes customers with no territory assigned
      - Adds an "Unassigned" row for customers without a region_id
      - Ensures Distribution total matches Total Customers count
      - Form submissions from unassigned customers are also counted

  2. Purpose
    - Fix discrepancy between Total Customers card and Distribution chart
    - Customers without a territory were previously excluded from the Distribution
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
    WHERE c.org_id = p_org_id
    GROUP BY c.region_id
  ),
  region_forms AS (
    SELECT c.region_id, COUNT(*) AS cnt
    FROM form_submissions fs
    JOIN forms f ON f.id = fs.form_id
    JOIN customers c ON c.id = fs.agent_id
    WHERE f.org_id = p_org_id
      AND (p_start_date IS NULL OR fs.submitted_at >= p_start_date)
      AND (p_end_date IS NULL OR fs.submitted_at <= p_end_date)
    GROUP BY c.region_id
  ),
  assigned AS (
    SELECT
      r.id AS region_id,
      r.name AS region_name,
      COALESCE(rc.cnt, 0) AS customer_count,
      COALESCE(rf.cnt, 0) AS form_count
    FROM regions r
    LEFT JOIN region_customers rc ON rc.region_id = r.id
    LEFT JOIN region_forms rf ON rf.region_id = r.id
    WHERE r.org_id = p_org_id AND r.is_active = true
  ),
  unassigned AS (
    SELECT
      NULL::uuid AS region_id,
      'Unassigned'::text AS region_name,
      COALESCE(rc.cnt, 0) AS customer_count,
      COALESCE(rf.cnt, 0) AS form_count
    FROM region_customers rc
    FULL OUTER JOIN region_forms rf ON true AND rc.region_id IS NULL AND rf.region_id IS NULL
    WHERE rc.region_id IS NULL OR rf.region_id IS NULL
  )
  SELECT * FROM assigned
  UNION ALL
  SELECT * FROM unassigned WHERE customer_count > 0 OR form_count > 0
  ORDER BY region_name;
$$;
