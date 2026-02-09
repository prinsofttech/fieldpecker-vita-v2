-- Enable RLS on all tables
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

-- Helper functions
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