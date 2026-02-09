/*
  # Create Team Hierarchy System

  1. New Tables
    - `user_sessions`: Track active user sessions for login/logout status
    - `user_locations`: Track real-time user location data
    - `user_activity_metrics`: Store productivity metrics and work completed
    - `team_hierarchy_cache`: Materialized view of team relationships for performance

  2. Updates to Existing Tables
    - Add `reports_to_user_id` to users table for reporting relationships
    - Add indexes for efficient hierarchy queries

  3. Functions
    - `get_direct_reports`: Get all users directly reporting to a user
    - `get_all_subordinates`: Get all users in the reporting chain (recursive)
    - `check_circular_reporting`: Prevent circular reporting relationships
    - `update_team_hierarchy_cache`: Refresh the hierarchy cache

  4. Security
    - RLS policies for hierarchical data access
    - Users can only view data for their direct and indirect reports
*/

-- Add reports_to_user_id to users table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'reports_to_user_id'
  ) THEN
    ALTER TABLE users ADD COLUMN reports_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create user_sessions table for login/logout tracking
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_info jsonb DEFAULT '{}',
  login_at timestamptz DEFAULT now(),
  logout_at timestamptz,
  is_active boolean DEFAULT true,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Create user_locations table for real-time location tracking
CREATE TABLE IF NOT EXISTS user_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  accuracy decimal(10, 2),
  address text,
  activity_type text DEFAULT 'unknown',
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create user_activity_metrics table
CREATE TABLE IF NOT EXISTS user_activity_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  tasks_completed integer DEFAULT 0,
  forms_submitted integer DEFAULT 0,
  customers_visited integer DEFAULT 0,
  distance_traveled decimal(10, 2) DEFAULT 0,
  work_hours decimal(5, 2) DEFAULT 0,
  performance_score decimal(5, 2) DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, metric_date)
);

-- Create team_hierarchy_cache table
CREATE TABLE IF NOT EXISTS team_hierarchy_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subordinate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  depth integer NOT NULL,
  path uuid[],
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, subordinate_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_reports_to ON users(reports_to_user_id) WHERE reports_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_locations_user_recorded ON user_locations(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_date ON user_activity_metrics(user_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_team_hierarchy_user ON team_hierarchy_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_team_hierarchy_subordinate ON team_hierarchy_cache(subordinate_id);

-- Function to check for circular reporting relationships
CREATE OR REPLACE FUNCTION check_circular_reporting()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid;
  max_depth integer := 100;
  depth integer := 0;
BEGIN
  IF NEW.reports_to_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id = NEW.reports_to_user_id THEN
    RAISE EXCEPTION 'User cannot report to themselves';
  END IF;

  current_user_id := NEW.reports_to_user_id;
  
  WHILE current_user_id IS NOT NULL AND depth < max_depth LOOP
    IF current_user_id = NEW.id THEN
      RAISE EXCEPTION 'Circular reporting relationship detected';
    END IF;
    
    SELECT reports_to_user_id INTO current_user_id 
    FROM users 
    WHERE id = current_user_id;
    
    depth := depth + 1;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent circular relationships
DROP TRIGGER IF EXISTS prevent_circular_reporting ON users;
CREATE TRIGGER prevent_circular_reporting
  BEFORE INSERT OR UPDATE OF reports_to_user_id ON users
  FOR EACH ROW
  EXECUTE FUNCTION check_circular_reporting();

-- Function to get direct reports
CREATE OR REPLACE FUNCTION get_direct_reports(manager_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  role_id uuid,
  department_id uuid,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.full_name, u.email, u.role_id, u.department_id, u.status
  FROM users u
  WHERE u.reports_to_user_id = manager_id
  AND u.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all subordinates (recursive)
CREATE OR REPLACE FUNCTION get_all_subordinates(manager_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  depth integer
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE subordinates AS (
    SELECT u.id, u.full_name, u.email, u.reports_to_user_id, 1 as depth
    FROM users u
    WHERE u.reports_to_user_id = manager_id
    AND u.status = 'active'
    
    UNION ALL
    
    SELECT u.id, u.full_name, u.email, u.reports_to_user_id, s.depth + 1
    FROM users u
    INNER JOIN subordinates s ON u.reports_to_user_id = s.id
    WHERE u.status = 'active'
    AND s.depth < 10
  )
  SELECT s.id, s.full_name, s.email, s.depth
  FROM subordinates s
  ORDER BY s.depth, s.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refresh team hierarchy cache
CREATE OR REPLACE FUNCTION refresh_team_hierarchy_cache()
RETURNS void AS $$
BEGIN
  TRUNCATE team_hierarchy_cache;
  
  INSERT INTO team_hierarchy_cache (user_id, subordinate_id, org_id, depth, path)
  WITH RECURSIVE hierarchy AS (
    SELECT 
      u.id as manager_id,
      u.id as subordinate_id,
      u.org_id,
      0 as depth,
      ARRAY[u.id] as path
    FROM users u
    WHERE u.status = 'active'
    
    UNION ALL
    
    SELECT 
      h.manager_id,
      u.id as subordinate_id,
      u.org_id,
      h.depth + 1,
      h.path || u.id
    FROM hierarchy h
    INNER JOIN users u ON u.reports_to_user_id = h.subordinate_id
    WHERE u.status = 'active'
    AND h.depth < 10
    AND NOT (u.id = ANY(h.path))
  )
  SELECT DISTINCT manager_id, subordinate_id, org_id, depth, path
  FROM hierarchy
  WHERE manager_id != subordinate_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_hierarchy_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_sessions
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view subordinate sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT subordinate_id FROM team_hierarchy_cache WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin'
  );

-- RLS Policies for user_locations
CREATE POLICY "Users can view own location"
  ON user_locations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view subordinate locations"
  ON user_locations FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT subordinate_id FROM team_hierarchy_cache WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all locations"
  ON user_locations FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin'
  );

-- RLS Policies for user_activity_metrics
CREATE POLICY "Users can view own metrics"
  ON user_activity_metrics FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view subordinate metrics"
  ON user_activity_metrics FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT subordinate_id FROM team_hierarchy_cache WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all metrics"
  ON user_activity_metrics FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin'
  );

-- RLS Policies for team_hierarchy_cache
CREATE POLICY "Users can view own hierarchy"
  ON team_hierarchy_cache FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR subordinate_id = auth.uid());

CREATE POLICY "Super admins can view all hierarchy"
  ON team_hierarchy_cache FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'super_admin'
  );
