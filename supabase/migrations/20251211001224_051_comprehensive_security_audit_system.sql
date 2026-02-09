/*
  # Comprehensive Security and Audit System
  
  This migration implements a complete security and audit system with:
  
  1. Password Security Enhancements
    - `must_change_password` flag for first login enforcement
    - Enhanced password_history for 180-day reuse prevention
    - `login_attempts` table for detailed tracking
    - Password expiration tracking (90 days)
  
  2. Form Interaction Tracking
    - `form_interaction_tracking` table to capture form start/end times
    - Stores duration metrics for analytics
  
  3. Issue Tracker Enhancements
    - `issue_statuses` table for custom statuses per organization
    - `action_taken` field on issues
    - `last_modified_by` tracking
    - `status_change_comments` for mandatory comments on status changes
    - Enhanced audit trail
  
  4. Security
    - RLS policies for all new tables
    - Audit logging for all password-related activities
    - Tamper-proof audit trail design
*/

-- =====================================================
-- PART 1: PASSWORD SECURITY ENHANCEMENTS
-- =====================================================

-- Add must_change_password flag to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'must_change_password'
  ) THEN
    ALTER TABLE users ADD COLUMN must_change_password boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password_expires_at'
  ) THEN
    ALTER TABLE users ADD COLUMN password_expires_at timestamptz DEFAULT (now() + interval '90 days');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_password_check'
  ) THEN
    ALTER TABLE users ADD COLUMN last_password_check timestamptz;
  END IF;
END $$;

-- Create login_attempts table for detailed tracking
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  ip_address text,
  user_agent text,
  device_fingerprint text,
  attempt_type text NOT NULL CHECK (attempt_type IN ('success', 'failure', 'lockout')),
  failure_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_type ON login_attempts(attempt_type);

-- Enhance password_history table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'password_history' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE password_history ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '180 days');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'password_history' AND column_name = 'change_reason'
  ) THEN
    ALTER TABLE password_history ADD COLUMN change_reason text CHECK (change_reason IN ('initial', 'user_change', 'forced_change', 'admin_reset', 'expiry'));
  END IF;
END $$;

-- Create password_audit_log for comprehensive password tracking
CREATE TABLE IF NOT EXISTS password_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('password_created', 'password_changed', 'password_reset', 'password_expired', 'password_reuse_blocked', 'forced_change_required')),
  performed_by uuid REFERENCES users(id),
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_audit_user_id ON password_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_password_audit_org_id ON password_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_password_audit_action ON password_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_password_audit_created_at ON password_audit_log(created_at DESC);

-- =====================================================
-- PART 2: FORM INTERACTION TRACKING
-- =====================================================

-- Create form_interaction_tracking table
CREATE TABLE IF NOT EXISTS form_interaction_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  form_id uuid REFERENCES forms(id) ON DELETE SET NULL,
  form_submission_id uuid REFERENCES form_submissions(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_seconds integer,
  session_id uuid,
  device_info jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'saved_draft')),
  field_interactions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_tracking_org_id ON form_interaction_tracking(org_id);
CREATE INDEX IF NOT EXISTS idx_form_tracking_user_id ON form_interaction_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_form_tracking_form_id ON form_interaction_tracking(form_id);
CREATE INDEX IF NOT EXISTS idx_form_tracking_started_at ON form_interaction_tracking(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_tracking_status ON form_interaction_tracking(status);

-- =====================================================
-- PART 3: ISSUE TRACKER ENHANCEMENTS
-- =====================================================

-- Create issue_statuses table for custom statuses
CREATE TABLE IF NOT EXISTS issue_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text NOT NULL,
  color text DEFAULT '#6B7280',
  icon text DEFAULT 'circle',
  sort_order integer DEFAULT 0,
  is_default boolean DEFAULT false,
  is_system boolean DEFAULT false,
  is_active boolean DEFAULT true,
  description text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_statuses_org_name ON issue_statuses(org_id, name) WHERE org_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_statuses_system_name ON issue_statuses(name) WHERE org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_issue_statuses_org_id ON issue_statuses(org_id);
CREATE INDEX IF NOT EXISTS idx_issue_statuses_is_active ON issue_statuses(is_active);

-- Insert system default statuses
INSERT INTO issue_statuses (org_id, name, display_name, color, icon, sort_order, is_default, is_system) VALUES
  (NULL, 'new', 'New', '#3B82F6', 'circle', 1, true, true),
  (NULL, 'assigned', 'Assigned', '#8B5CF6', 'user-check', 2, false, true),
  (NULL, 'in_progress', 'In Progress', '#F59E0B', 'loader', 3, false, true),
  (NULL, 'on_hold', 'On Hold', '#6B7280', 'pause-circle', 4, false, true),
  (NULL, 'resolved', 'Resolved', '#10B981', 'check-circle', 5, false, true),
  (NULL, 'closed', 'Closed', '#1F2937', 'x-circle', 6, false, true)
ON CONFLICT DO NOTHING;

-- Create status_change_comments table for mandatory comments
CREATE TABLE IF NOT EXISTS status_change_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  old_status text NOT NULL,
  new_status text NOT NULL,
  comment text NOT NULL,
  changed_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_comments_issue_id ON status_change_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_status_comments_changed_by ON status_change_comments(changed_by);
CREATE INDEX IF NOT EXISTS idx_status_comments_created_at ON status_change_comments(created_at DESC);

-- Add new columns to issues table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issues' AND column_name = 'action_taken'
  ) THEN
    ALTER TABLE issues ADD COLUMN action_taken text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issues' AND column_name = 'last_modified_by'
  ) THEN
    ALTER TABLE issues ADD COLUMN last_modified_by uuid REFERENCES users(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issues' AND column_name = 'last_modified_at'
  ) THEN
    ALTER TABLE issues ADD COLUMN last_modified_at timestamptz DEFAULT now();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issues' AND column_name = 'custom_status_id'
  ) THEN
    ALTER TABLE issues ADD COLUMN custom_status_id uuid REFERENCES issue_statuses(id);
  END IF;
END $$;

-- Create trigger to update last_modified fields
CREATE OR REPLACE FUNCTION update_issue_last_modified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.last_modified_at := now();
  NEW.last_modified_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_issue_last_modified ON issues;
CREATE TRIGGER trigger_update_issue_last_modified
  BEFORE UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION update_issue_last_modified();

-- Enhanced issue history tracking
CREATE OR REPLACE FUNCTION track_comprehensive_issue_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_changed_by uuid;
BEGIN
  v_changed_by := COALESCE(auth.uid(), NEW.last_modified_by);
  
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
      VALUES (NEW.id, v_changed_by, 'status_change', 
              jsonb_build_object('status', OLD.status),
              jsonb_build_object('status', NEW.status));
    END IF;
    
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
      VALUES (NEW.id, v_changed_by, 'assignment_change',
              jsonb_build_object('assigned_to', OLD.assigned_to),
              jsonb_build_object('assigned_to', NEW.assigned_to));
    END IF;
    
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
      VALUES (NEW.id, v_changed_by, 'priority_change',
              jsonb_build_object('priority', OLD.priority),
              jsonb_build_object('priority', NEW.priority));
    END IF;
    
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
      VALUES (NEW.id, v_changed_by, 'title_change',
              jsonb_build_object('title', OLD.title),
              jsonb_build_object('title', NEW.title));
    END IF;
    
    IF OLD.description IS DISTINCT FROM NEW.description THEN
      INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
      VALUES (NEW.id, v_changed_by, 'description_change',
              jsonb_build_object('description', LEFT(COALESCE(OLD.description, ''), 500)),
              jsonb_build_object('description', LEFT(COALESCE(NEW.description, ''), 500)));
    END IF;
    
    IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
      INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
      VALUES (NEW.id, v_changed_by, 'due_date_change',
              jsonb_build_object('due_date', OLD.due_date),
              jsonb_build_object('due_date', NEW.due_date));
    END IF;
    
    IF OLD.category_id IS DISTINCT FROM NEW.category_id THEN
      INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
      VALUES (NEW.id, v_changed_by, 'category_change',
              jsonb_build_object('category_id', OLD.category_id),
              jsonb_build_object('category_id', NEW.category_id));
    END IF;
    
    IF OLD.action_taken IS DISTINCT FROM NEW.action_taken THEN
      INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
      VALUES (NEW.id, v_changed_by, 'action_taken_change',
              jsonb_build_object('action_taken', OLD.action_taken),
              jsonb_build_object('action_taken', NEW.action_taken));
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
    VALUES (NEW.id, v_changed_by, 'issue_created', NULL,
            jsonb_build_object('title', NEW.title, 'status', NEW.status, 'priority', NEW.priority));
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_track_issue_changes ON issues;
DROP TRIGGER IF EXISTS trigger_track_comprehensive_issue_changes ON issues;
CREATE TRIGGER trigger_track_comprehensive_issue_changes
  AFTER INSERT OR UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION track_comprehensive_issue_changes();

-- =====================================================
-- PART 4: RLS POLICIES
-- =====================================================

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_interaction_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_change_comments ENABLE ROW LEVEL SECURITY;

-- Login attempts policies
CREATE POLICY "Admins can view login attempts for their org"
  ON login_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND login_attempts.user_id IN (SELECT id FROM users WHERE org_id = u.org_id)
        AND r.name IN ('super_admin', 'client_admin')
    )
  );

CREATE POLICY "System can insert login attempts"
  ON login_attempts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Password audit log policies
CREATE POLICY "Admins can view password audit for their org"
  ON password_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND u.org_id = password_audit_log.org_id
        AND r.name IN ('super_admin', 'client_admin')
    )
  );

CREATE POLICY "Users can view own password audit"
  ON password_audit_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert password audit"
  ON password_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Form interaction tracking policies
CREATE POLICY "Users can view own form interactions"
  ON form_interaction_tracking FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all form interactions in org"
  ON form_interaction_tracking FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND u.org_id = form_interaction_tracking.org_id
        AND r.name IN ('super_admin', 'client_admin', 'regional_manager', 'branch_manager')
    )
  );

CREATE POLICY "Users can create form interactions"
  ON form_interaction_tracking FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own form interactions"
  ON form_interaction_tracking FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Issue statuses policies
CREATE POLICY "Users can view statuses in their org or system defaults"
  ON issue_statuses FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.org_id = issue_statuses.org_id
    )
  );

CREATE POLICY "Admins can insert custom statuses"
  ON issue_statuses FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system = false AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND u.org_id = issue_statuses.org_id
        AND r.name IN ('super_admin', 'client_admin')
    )
  );

CREATE POLICY "Admins can update custom statuses"
  ON issue_statuses FOR UPDATE
  TO authenticated
  USING (
    is_system = false AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND u.org_id = issue_statuses.org_id
        AND r.name IN ('super_admin', 'client_admin')
    )
  );

CREATE POLICY "Admins can delete custom statuses"
  ON issue_statuses FOR DELETE
  TO authenticated
  USING (
    is_system = false AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND u.org_id = issue_statuses.org_id
        AND r.name IN ('super_admin', 'client_admin')
    )
  );

-- Status change comments policies
CREATE POLICY "Users can view status comments on accessible issues"
  ON status_change_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM issues i
      JOIN users u ON u.org_id = i.org_id
      WHERE i.id = status_change_comments.issue_id
        AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can add status comments"
  ON status_change_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    changed_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM issues i
      JOIN users u ON u.org_id = i.org_id
      WHERE i.id = status_change_comments.issue_id
        AND u.id = auth.uid()
    )
  );

-- =====================================================
-- PART 5: HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION check_password_reuse(p_user_id uuid, p_password_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM password_history
    WHERE user_id = p_user_id
      AND password_hash = p_password_hash
      AND created_at > now() - interval '180 days'
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_recent_login_attempts(p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM login_attempts
    WHERE email = p_email
      AND attempt_type = 'failure'
      AND created_at > now() - interval '15 minutes'
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_issue_statuses_for_org(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  display_name text,
  color text,
  icon text,
  sort_order integer,
  is_default boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.display_name,
    s.color,
    s.icon,
    s.sort_order,
    s.is_default
  FROM issue_statuses s
  WHERE (s.org_id = p_org_id OR (s.org_id IS NULL AND s.is_system = true))
    AND s.is_active = true
  ORDER BY s.sort_order;
END;
$$;

CREATE OR REPLACE FUNCTION log_password_audit(
  p_user_id uuid,
  p_org_id uuid,
  p_action text,
  p_performed_by uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO password_audit_log (user_id, org_id, action, performed_by, metadata)
  VALUES (p_user_id, p_org_id, p_action, COALESCE(p_performed_by, p_user_id), p_metadata);
END;
$$;

-- Set existing users to not require password change
UPDATE users SET must_change_password = false WHERE must_change_password IS NULL;
