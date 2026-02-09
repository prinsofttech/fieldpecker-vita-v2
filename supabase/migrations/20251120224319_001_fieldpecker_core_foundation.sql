-- FieldPecker Core Foundation Migration

-- Organizations table
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

-- Roles table
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

-- Users table
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

-- Modules table
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

-- Org modules table
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

-- Audit logs table
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

-- Password history table
CREATE TABLE IF NOT EXISTS password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);

-- Seed roles
INSERT INTO roles (name, display_name, level, description, permissions) VALUES
  ('client_admin', 'Client Admin', 1, 'Full organizational access and control', '{"all": true}'::jsonb),
  ('regional_manager', 'Regional Manager', 2, 'Manages multiple branches in a region', '{"manage_branches": true, "view_reports": true}'::jsonb),
  ('branch_manager', 'Branch Manager', 3, 'Manages single branch operations', '{"manage_branch": true, "assign_tasks": true}'::jsonb),
  ('supervisor', 'Supervisor', 4, 'Supervises field agents', '{"assign_tasks": true, "view_reports": true}'::jsonb),
  ('field_agent', 'Field Agent', 5, 'Executes field operations', '{"complete_tasks": true, "submit_reports": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Seed modules
INSERT INTO modules (name, display_name, description, icon, is_core) VALUES
  ('supervision', 'Supervision', 'Field visits, compliance checks, photo/GPS capture', 'eye', false),
  ('issue_tracker', 'Issue Tracker', 'Issue logging, assignment workflows, escalations', 'alert-circle', false),
  ('leads_sales', 'Leads & Sales', 'Lead capture, follow-ups, conversion tracking', 'trending-up', false),
  ('performance_kpi', 'Performance & KPIs', 'Target monitoring, dashboards, reporting', 'bar-chart', false)
ON CONFLICT (name) DO NOTHING;