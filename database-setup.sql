/*
  # FieldPecker Foundation - Core Schema & Multi-Tenancy Setup

  Run this SQL in your Supabase SQL Editor to set up the complete database.
*/

-- =====================================================
-- ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  subscription_tier text NOT NULL DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'professional', 'enterprise')),
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- =====================================================
-- ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL CHECK (name IN ('client_admin', 'regional_manager', 'branch_manager', 'supervisor', 'field_agent')),
  display_name text NOT NULL,
  level integer NOT NULL CHECK (level >= 1 AND level <= 5),
  permissions jsonb DEFAULT '{}'::jsonb,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_level ON roles(level);

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'locked')),
  last_login_at timestamptz,
  password_changed_at timestamptz DEFAULT now(),
  failed_login_attempts integer DEFAULT 0,
  locked_until timestamptz,
  device_id text,
  session_expires_at timestamptz,
  parent_user_id uuid REFERENCES users(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_parent_user_id ON users(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);

-- =====================================================
-- MODULES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL CHECK (name IN ('supervision', 'issue_tracker', 'leads_sales', 'performance_kpi')),
  display_name text NOT NULL,
  description text,
  icon text,
  is_core boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modules_name ON modules(name);

-- =====================================================
-- ORG_MODULES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS org_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  is_enabled boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  enabled_at timestamptz DEFAULT now(),
  enabled_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_org_modules_org_id ON org_modules(org_id);
CREATE INDEX IF NOT EXISTS idx_org_modules_module_id ON org_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_org_modules_enabled ON org_modules(org_id, is_enabled);

-- =====================================================
-- AUDIT_LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =====================================================
-- PASSWORD_HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);

-- =====================================================
-- SEED DEFAULT ROLES
-- =====================================================
INSERT INTO roles (name, display_name, level, description, permissions) VALUES
  ('client_admin', 'Client Admin', 1, 'Full organizational access and control', '{"all": true}'::jsonb),
  ('regional_manager', 'Regional Manager', 2, 'Manages multiple branches in a region', '{"manage_branches": true, "view_reports": true}'::jsonb),
  ('branch_manager', 'Branch Manager', 3, 'Manages single branch operations', '{"manage_branch": true, "assign_tasks": true}'::jsonb),
  ('supervisor', 'Supervisor', 4, 'Supervises field agents', '{"assign_tasks": true, "view_reports": true}'::jsonb),
  ('field_agent', 'Field Agent', 5, 'Executes field operations', '{"complete_tasks": true, "submit_reports": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- SEED DEFAULT MODULES
-- =====================================================
INSERT INTO modules (name, display_name, description, icon, is_core) VALUES
  ('supervision', 'Supervision', 'Field visits, compliance checks, photo/GPS capture', 'eye', false),
  ('issue_tracker', 'Issue Tracker', 'Issue logging, assignment workflows, escalations', 'alert-circle', false),
  ('leads_sales', 'Leads & Sales', 'Lead capture, follow-ups, conversion tracking', 'trending-up', false),
  ('performance_kpi', 'Performance & KPIs', 'Target monitoring, dashboards, reporting', 'bar-chart', false)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;

-- Organizations policies
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT TO authenticated
  USING (id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Only client admins can update organization" ON organizations;
CREATE POLICY "Only client admins can update organization"
  ON organizations FOR UPDATE TO authenticated
  USING (id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin'))
  WITH CHECK (id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin'));

-- Roles policies
DROP POLICY IF EXISTS "Authenticated users can view roles" ON roles;
CREATE POLICY "Authenticated users can view roles"
  ON roles FOR SELECT TO authenticated USING (true);

-- Users policies
DROP POLICY IF EXISTS "Users can view users in own organization" ON users;
CREATE POLICY "Users can view users in own organization"
  ON users FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can insert users" ON users;
CREATE POLICY "Admins and managers can insert users"
  ON users FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.level <= 3));

DROP POLICY IF EXISTS "Admins and managers can update users" ON users;
CREATE POLICY "Admins and managers can update users"
  ON users FOR UPDATE TO authenticated
  USING (org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.level <= 3))
  WITH CHECK (org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.level <= 3));

DROP POLICY IF EXISTS "Only admins can delete users" ON users;
CREATE POLICY "Only admins can delete users"
  ON users FOR DELETE TO authenticated
  USING (org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin'));

-- Modules policies
DROP POLICY IF EXISTS "Authenticated users can view modules" ON modules;
CREATE POLICY "Authenticated users can view modules"
  ON modules FOR SELECT TO authenticated USING (true);

-- Org modules policies
DROP POLICY IF EXISTS "Users can view own org modules" ON org_modules;
CREATE POLICY "Users can view own org modules"
  ON org_modules FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Only admins can manage org modules" ON org_modules;
CREATE POLICY "Only admins can manage org modules"
  ON org_modules FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin'));

DROP POLICY IF EXISTS "Only admins can update org modules" ON org_modules;
CREATE POLICY "Only admins can update org modules"
  ON org_modules FOR UPDATE TO authenticated
  USING (org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin'))
  WITH CHECK (org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin'));

DROP POLICY IF EXISTS "Only admins can delete org modules" ON org_modules;
CREATE POLICY "Only admins can delete org modules"
  ON org_modules FOR DELETE TO authenticated
  USING (org_id IN (SELECT u.org_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.name = 'client_admin'));

-- Audit logs policies
DROP POLICY IF EXISTS "Users can view own org audit logs" ON audit_logs;
CREATE POLICY "Users can view own org audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Password history policies
DROP POLICY IF EXISTS "Users can view own password history" ON password_history;
CREATE POLICY "Users can view own password history"
  ON password_history FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert password history" ON password_history;
CREATE POLICY "System can insert password history"
  ON password_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_org_modules_updated_at ON org_modules;
CREATE TRIGGER update_org_modules_updated_at
  BEFORE UPDATE ON org_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION user_has_module_access(p_user_id uuid, p_module_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    JOIN org_modules om ON om.org_id = u.org_id
    JOIN modules m ON m.id = om.module_id
    WHERE u.id = p_user_id AND m.name = p_module_name AND om.is_enabled = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_can_manage(p_manager_id uuid, p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  manager_level integer;
  user_level integer;
  same_org boolean;
BEGIN
  SELECT r.level INTO manager_level FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = p_manager_id;
  SELECT r.level INTO user_level FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = p_user_id;
  SELECT EXISTS (SELECT 1 FROM users u1 JOIN users u2 ON u1.org_id = u2.org_id WHERE u1.id = p_manager_id AND u2.id = p_user_id) INTO same_org;
  RETURN same_org AND manager_level < user_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_audit_trail(
  p_org_id uuid, p_user_id uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_changes jsonb DEFAULT '{}'::jsonb, p_ip_address text DEFAULT NULL, p_user_agent text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE audit_id uuid;
BEGIN
  INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, changes, ip_address, user_agent)
  VALUES (p_org_id, p_user_id, p_action, p_entity_type, p_entity_id, p_changes, p_ip_address, p_user_agent)
  RETURNING id INTO audit_id;
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Database setup complete!' as status;
