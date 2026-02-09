/*
  # Leads Management Module - Database Schema

  ## Overview
  This migration creates a comprehensive leads management system with:
  - Configurable form templates
  - Dynamic field definitions
  - Lead tracking with status workflow
  - Audit trails and assignments

  ## New Tables

  ### 1. `lead_form_templates`
  Stores reusable form templates that admins can configure
  - `id` (uuid, primary key)
  - `org_id` (uuid, references organizations)
  - `name` (text) - Template name
  - `description` (text) - Template description
  - `is_active` (boolean) - Whether template is currently active
  - `is_default` (boolean) - Whether this is the default template
  - `created_by` (uuid, references users)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `lead_form_fields`
  Defines individual fields within form templates

  ### 3. `leads`
  Main leads table storing lead information

  ### 4. `lead_field_values`
  Stores dynamic field values for leads

  ### 5. `lead_status_history`
  Audit trail for lead status changes

  ### 6. `lead_assignments`
  Tracks lead assignments to users

  ## Security
  - Enable RLS on all tables
  - Policies restrict access to organization members
  - Admin roles can manage templates and assignments
  - Users can view and manage assigned leads
*/

-- Create lead_form_templates table
CREATE TABLE IF NOT EXISTS lead_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create partial unique index for default template per org
CREATE UNIQUE INDEX IF NOT EXISTS unique_default_template_per_org 
  ON lead_form_templates(org_id) 
  WHERE is_default = true;

-- Create lead_form_fields table
CREATE TABLE IF NOT EXISTS lead_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES lead_form_templates(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'email', 'phone', 'number', 'select', 'multiselect', 'textarea', 'date', 'datetime', 'checkbox', 'radio', 'url', 'file')),
  field_options jsonb DEFAULT '[]'::jsonb,
  is_required boolean DEFAULT false,
  validation_rules jsonb DEFAULT '{}'::jsonb,
  placeholder text,
  help_text text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_field_name_per_template UNIQUE (template_id, field_name)
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id uuid REFERENCES lead_form_templates(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  company text,
  status text NOT NULL DEFAULT 'new',
  score integer DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  source text,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  region_id uuid REFERENCES regions(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  notes text,
  last_contact_date timestamptz,
  next_followup_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create lead_field_values table
CREATE TABLE IF NOT EXISTS lead_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES lead_form_fields(id) ON DELETE CASCADE,
  field_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_lead_field UNIQUE (lead_id, field_id)
);

-- Create lead_status_history table
CREATE TABLE IF NOT EXISTS lead_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  changed_at timestamptz DEFAULT now()
);

-- Create lead_assignments table
CREATE TABLE IF NOT EXISTS lead_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  unassigned_at timestamptz,
  is_active boolean DEFAULT true,
  notes text
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lead_form_templates_org_id ON lead_form_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_lead_form_fields_template_id ON lead_form_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_field_values_lead_id ON lead_field_values(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_id ON lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead_id ON lead_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_user_id ON lead_assignments(user_id) WHERE is_active = true;

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_lead_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lead_timestamp
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_updated_at();

CREATE TRIGGER trigger_update_template_timestamp
  BEFORE UPDATE ON lead_form_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_updated_at();

-- Create trigger to track status changes
CREATE OR REPLACE FUNCTION track_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_lead_status
  AFTER UPDATE ON leads
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION track_lead_status_change();

-- Enable RLS on all tables
ALTER TABLE lead_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_form_templates
CREATE POLICY "Users can view templates in their organization"
  ON lead_form_templates FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage templates"
  ON lead_form_templates FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
      AND role_id IN (
        SELECT id FROM roles
        WHERE name IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
      )
    )
  );

-- RLS Policies for lead_form_fields
CREATE POLICY "Users can view fields in their organization"
  ON lead_form_fields FOR SELECT
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM lead_form_templates WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage fields"
  ON lead_form_fields FOR ALL
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM lead_form_templates WHERE org_id IN (
        SELECT org_id FROM users
        WHERE id = auth.uid()
        AND role_id IN (
          SELECT id FROM roles
          WHERE name IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
        )
      )
    )
  );

-- RLS Policies for leads
CREATE POLICY "Users can view leads in their organization"
  ON leads FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
    OR assigned_to = auth.uid()
  );

CREATE POLICY "Users can create leads in their organization"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update assigned leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    (
      org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
      AND assigned_to = auth.uid()
    )
    OR
    (
      org_id IN (
        SELECT org_id FROM users
        WHERE id = auth.uid()
        AND role_id IN (
          SELECT id FROM roles
          WHERE name IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
        )
      )
    )
  );

CREATE POLICY "Admins can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
      AND role_id IN (
        SELECT id FROM roles
        WHERE name IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
        )
    )
  );

-- RLS Policies for lead_field_values
CREATE POLICY "Users can view field values for accessible leads"
  ON lead_field_values FOR SELECT
  TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage field values for their leads"
  ON lead_field_values FOR ALL
  TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for lead_status_history
CREATE POLICY "Users can view status history for accessible leads"
  ON lead_status_history FOR SELECT
  TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert status history"
  ON lead_status_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for lead_assignments
CREATE POLICY "Users can view assignments in their organization"
  ON lead_assignments FOR SELECT
  TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE org_id IN (
        SELECT org_id FROM users WHERE id = auth.uid()
      )
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Admins can manage assignments"
  ON lead_assignments FOR ALL
  TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM leads WHERE org_id IN (
        SELECT org_id FROM users
        WHERE id = auth.uid()
        AND role_id IN (
          SELECT id FROM roles
          WHERE name IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
        )
      )
    )
  );

-- Create default form template function
CREATE OR REPLACE FUNCTION create_default_lead_template(p_org_id uuid, p_created_by uuid)
RETURNS uuid AS $$
DECLARE
  v_template_id uuid;
  v_field_order integer := 0;
BEGIN
  INSERT INTO lead_form_templates (org_id, name, description, is_default, created_by)
  VALUES (p_org_id, 'Default Lead Form', 'Standard lead capture form with essential fields', true, p_created_by)
  RETURNING id INTO v_template_id;

  INSERT INTO lead_form_fields (template_id, field_name, field_label, field_type, is_required, display_order)
  VALUES
    (v_template_id, 'full_name', 'Full Name', 'text', true, v_field_order),
    (v_template_id, 'email', 'Email Address', 'email', true, v_field_order + 1),
    (v_template_id, 'phone', 'Phone Number', 'phone', true, v_field_order + 2),
    (v_template_id, 'company', 'Company Name', 'text', false, v_field_order + 3),
    (v_template_id, 'job_title', 'Job Title', 'text', false, v_field_order + 4),
    (v_template_id, 'industry', 'Industry', 'select', false, v_field_order + 5),
    (v_template_id, 'budget', 'Budget Range', 'select', false, v_field_order + 6),
    (v_template_id, 'timeline', 'Purchase Timeline', 'select', false, v_field_order + 7),
    (v_template_id, 'message', 'Message/Requirements', 'textarea', false, v_field_order + 8);

  RETURN v_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
