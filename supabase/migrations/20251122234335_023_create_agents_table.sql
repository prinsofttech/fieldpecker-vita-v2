/*
  # Create Agents Table

  1. New Tables
    - `agents` - Field agents with comprehensive profile information
      - Basic Info: agent_name, agent_code, supervisor_code
      - Location: latitude, longitude, previous_latitude, previous_longitude, location_of_outlet
      - Contact: agent_telephone, operator, operator_telephone
      - Organization Structure: branch_id, region_id, org_id, supervising_branch_id, supervising_region_id
      - Agent Details: agent_type, active_type, country, agent_picture
      - Metadata: is_active, created_by, created_at, updated_at

  2. Security
    - Enable RLS on agents table
    - Users can view agents in their organization
    - Admins and managers can manage agents in their organization
    - Super admins have full access

  3. Notes
    - Agents do NOT have email addresses (they are not system users)
    - Agents are managed by organization users but are not users themselves
    - Supervisor code links agents to their supervisor
*/

-- Create agent_type enum
CREATE TYPE agent_type AS ENUM ('permanent', 'temporary', 'contract', 'freelance');

-- Create active_type enum
CREATE TYPE active_type AS ENUM ('active', 'inactive', 'suspended', 'on_leave');

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  region_id uuid REFERENCES regions(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  
  -- Supervising structure (where agent reports to)
  supervising_region_id uuid REFERENCES regions(id) ON DELETE SET NULL,
  supervising_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  
  -- Basic Information
  agent_name text NOT NULL,
  agent_code text NOT NULL,
  supervisor_code text,
  
  -- Location Information
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  previous_latitude decimal(10, 8),
  previous_longitude decimal(11, 8),
  location_of_outlet text,
  country text DEFAULT 'Kenya',
  
  -- Contact Information
  agent_telephone text,
  operator text,
  operator_telephone text,
  
  -- Agent Details
  agent_type agent_type DEFAULT 'permanent',
  active_type active_type DEFAULT 'active',
  agent_picture text, -- URL to profile picture
  
  -- Metadata
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_agent_code_per_org UNIQUE(org_id, agent_code)
);

-- Create indexes for better query performance
CREATE INDEX idx_agents_org_id ON agents(org_id);
CREATE INDEX idx_agents_region_id ON agents(region_id);
CREATE INDEX idx_agents_branch_id ON agents(branch_id);
CREATE INDEX idx_agents_supervisor_code ON agents(supervisor_code);
CREATE INDEX idx_agents_agent_code ON agents(agent_code);
CREATE INDEX idx_agents_active_type ON agents(active_type);

-- Enable RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view agents in their organization
CREATE POLICY "Users can view agents in their organization"
  ON agents FOR SELECT
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- INSERT: Admins and managers can create agents in their organization
CREATE POLICY "Admins can create agents in their organization"
  ON agents FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- UPDATE: Admins and managers can update agents in their organization
CREATE POLICY "Admins can update agents in their organization"
  ON agents FOR UPDATE
  TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- DELETE: Admins and managers can delete agents in their organization
CREATE POLICY "Admins can delete agents in their organization"
  ON agents FOR DELETE
  TO authenticated
  USING (
    (
      org_id = (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('client_admin', 'org_admin', 'manager')
    )
    OR 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at_trigger
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_agents_updated_at();

-- Create trigger to update organization total_agents counter
CREATE OR REPLACE FUNCTION update_org_agents_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE organizations
    SET total_agents = total_agents + 1
    WHERE id = NEW.org_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE organizations
    SET total_agents = total_agents - 1
    WHERE id = OLD.org_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_count_insert_trigger
  AFTER INSERT ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_org_agents_count();

CREATE TRIGGER agents_count_delete_trigger
  AFTER DELETE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_org_agents_count();

COMMENT ON TABLE agents IS 'Field agents - not system users, managed by organization users';
COMMENT ON COLUMN agents.agent_code IS 'Unique agent identifier within organization';
COMMENT ON COLUMN agents.supervisor_code IS 'Code of the supervisor managing this agent';
COMMENT ON COLUMN agents.agent_picture IS 'URL to agent profile picture';
COMMENT ON COLUMN agents.location_of_outlet IS 'Physical location description of outlet';
