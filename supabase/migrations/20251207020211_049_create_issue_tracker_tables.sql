/*
  # Create Issue Tracker Module Tables

  1. New Tables
    - `issue_categories`: Issue categories (Bug, Feature Request, Support, etc.)
    - `issues`: Main issues table for tracking tickets/problems
    - `issue_comments`: Comments on issues
    - `issue_attachments`: File attachments for issues
    - `issue_history`: Audit trail for issue changes

  2. Security
    - Enable RLS on all tables
    - Admins can manage all issues in their org
    - Users can create issues and view issues they created or are assigned to
    - Team leads can view issues from their team members

  3. Features
    - Priority levels (low, medium, high, critical)
    - Status workflow (new, assigned, in_progress, resolved, closed)
    - Assignment to users
    - Due dates and SLA tracking
    - Custom categories per organization
*/

-- Create issue categories table
CREATE TABLE IF NOT EXISTS issue_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#6B7280',
  icon text DEFAULT 'tag',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Create issues table
CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  issue_number text NOT NULL,
  title text NOT NULL,
  description text,
  category_id uuid REFERENCES issue_categories(id),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'resolved', 'closed', 'on_hold')),
  
  -- Assignment
  assigned_to uuid REFERENCES users(id),
  assigned_at timestamptz,
  assigned_by uuid REFERENCES users(id),
  
  -- Reporter
  reported_by uuid NOT NULL REFERENCES users(id),
  reported_at timestamptz DEFAULT now(),
  
  -- Customer relation (if issue is related to a customer)
  customer_id uuid REFERENCES customers(id),
  
  -- Dates
  due_date timestamptz,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id),
  closed_at timestamptz,
  closed_by uuid REFERENCES users(id),
  
  -- Additional fields
  tags text[],
  metadata jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(org_id, issue_number)
);

-- Create issue comments table
CREATE TABLE IF NOT EXISTS issue_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  comment_text text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create issue attachments table
CREATE TABLE IF NOT EXISTS issue_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  created_at timestamptz DEFAULT now()
);

-- Create issue history table for audit trail
CREATE TABLE IF NOT EXISTS issue_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES users(id),
  change_type text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_issues_org_id ON issues(org_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_reported_by ON issues(reported_by);
CREATE INDEX IF NOT EXISTS idx_issues_customer_id ON issues(customer_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue_id ON issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue_id ON issue_attachments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_history_issue_id ON issue_history(issue_id);

-- Create function to generate issue numbers
CREATE OR REPLACE FUNCTION generate_issue_number(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
  v_year text;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::text;
  
  SELECT COUNT(*) INTO v_count
  FROM issues
  WHERE org_id = p_org_id;
  
  RETURN 'ISS-' || v_year || '-' || LPAD((v_count + 1)::text, 6, '0');
END;
$$;

-- Create trigger to auto-generate issue numbers
CREATE OR REPLACE FUNCTION set_issue_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.issue_number IS NULL OR NEW.issue_number = '' THEN
    NEW.issue_number := generate_issue_number(NEW.org_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_issue_number
  BEFORE INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION set_issue_number();

-- Create trigger to track issue history
CREATE OR REPLACE FUNCTION track_issue_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Track status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status_change', 
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status));
  END IF;
  
  -- Track assignment changes
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'assignment_change',
            jsonb_build_object('assigned_to', OLD.assigned_to),
            jsonb_build_object('assigned_to', NEW.assigned_to));
  END IF;
  
  -- Track priority changes
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'priority_change',
            jsonb_build_object('priority', OLD.priority),
            jsonb_build_object('priority', NEW.priority));
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_track_issue_changes
  AFTER UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION track_issue_changes();

-- Update timestamps
CREATE TRIGGER update_issue_categories_updated_at
  BEFORE UPDATE ON issue_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_issue_comments_updated_at
  BEFORE UPDATE ON issue_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE issue_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for issue_categories
CREATE POLICY "Users can view categories in their org"
  ON issue_categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.org_id = issue_categories.org_id
    )
  );

CREATE POLICY "Admins can manage categories"
  ON issue_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND u.org_id = issue_categories.org_id
        AND r.name IN ('super_admin', 'client_admin')
    )
  );

-- RLS Policies for issues
CREATE POLICY "Users can view issues in their org"
  ON issues FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.org_id = issues.org_id
    )
  );

CREATE POLICY "Users can create issues"
  ON issues FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.org_id = issues.org_id
    )
  );

CREATE POLICY "Users can update assigned issues"
  ON issues FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    reported_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND u.org_id = issues.org_id
        AND r.name IN ('super_admin', 'client_admin', 'org_admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete issues"
  ON issues FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND u.org_id = issues.org_id
        AND r.name IN ('super_admin', 'client_admin')
    )
  );

-- RLS Policies for issue_comments
CREATE POLICY "Users can view comments on accessible issues"
  ON issue_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM issues i
      JOIN users u ON u.org_id = i.org_id
      WHERE i.id = issue_comments.issue_id
        AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can add comments"
  ON issue_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM issues i
      JOIN users u ON u.org_id = i.org_id
      WHERE i.id = issue_comments.issue_id
        AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can update own comments"
  ON issue_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
  ON issue_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for issue_attachments
CREATE POLICY "Users can view attachments on accessible issues"
  ON issue_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM issues i
      JOIN users u ON u.org_id = i.org_id
      WHERE i.id = issue_attachments.issue_id
        AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can upload attachments"
  ON issue_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM issues i
      JOIN users u ON u.org_id = i.org_id
      WHERE i.id = issue_attachments.issue_id
        AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own attachments"
  ON issue_attachments FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- RLS Policies for issue_history
CREATE POLICY "Users can view history of accessible issues"
  ON issue_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM issues i
      JOIN users u ON u.org_id = i.org_id
      WHERE i.id = issue_history.issue_id
        AND u.id = auth.uid()
    )
  );

-- Insert default issue categories
INSERT INTO issue_categories (org_id, name, description, color, icon)
SELECT 
  o.id,
  category.name,
  category.description,
  category.color,
  category.icon
FROM organizations o
CROSS JOIN (
  VALUES 
    ('Bug', 'Software bugs and defects', '#EF4444', 'bug'),
    ('Feature Request', 'New feature suggestions', '#3B82F6', 'lightbulb'),
    ('Support', 'Customer support requests', '#10B981', 'help-circle'),
    ('Task', 'General tasks and assignments', '#8B5CF6', 'check-square'),
    ('Question', 'Questions and inquiries', '#F59E0B', 'message-circle'),
    ('Incident', 'Critical incidents', '#DC2626', 'alert-triangle')
) AS category(name, description, color, icon)
ON CONFLICT (org_id, name) DO NOTHING;
