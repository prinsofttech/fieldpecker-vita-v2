/*
  # Create Lead Statuses Configuration Table

  ## Purpose
  Allow organizations to customize their lead status workflow by managing their own lead statuses.

  ## Changes
  
  1. New Tables
    - `lead_statuses`
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations) - Organization this status belongs to
      - `status_key` (text) - Unique identifier for the status (e.g., 'new', 'hot', 'won')
      - `status_label` (text) - Display label for the status
      - `status_color` (text) - Tailwind text color class (e.g., 'text-blue-700')
      - `status_bg_color` (text) - Tailwind background color class (e.g., 'bg-blue-100')
      - `description` (text) - Description of what the status means
      - `display_order` (integer) - Order in which statuses should be displayed
      - `is_active` (boolean) - Whether the status is active and can be used
      - `is_default` (boolean) - Whether this is the default status for new leads
      - `is_system` (boolean) - Whether this is a system-defined status (cannot be deleted)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Indexes
    - Index on org_id for quick lookup
    - Unique constraint on org_id + status_key combination
    - Index on display_order for sorting
  
  3. Security
    - Enable RLS on lead_statuses table
    - Admins can manage lead statuses for their organization
    - All authenticated users can view their organization's lead statuses
  
  4. Default Data
    - Populate default lead statuses for existing organizations
*/

-- Create lead_statuses table
CREATE TABLE IF NOT EXISTS lead_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status_key text NOT NULL,
  status_label text NOT NULL,
  status_color text NOT NULL DEFAULT 'text-slate-700',
  status_bg_color text NOT NULL DEFAULT 'bg-slate-100',
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_org_status_key UNIQUE (org_id, status_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lead_statuses_org_id ON lead_statuses(org_id);
CREATE INDEX IF NOT EXISTS idx_lead_statuses_display_order ON lead_statuses(org_id, display_order);
CREATE INDEX IF NOT EXISTS idx_lead_statuses_is_active ON lead_statuses(org_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE lead_statuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_statuses
CREATE POLICY "Users can view their organization's lead statuses"
  ON lead_statuses FOR SELECT
  TO authenticated
  USING (
    org_id = (auth.jwt()->>'org_id')::uuid
  );

CREATE POLICY "Admins can insert lead statuses"
  ON lead_statuses FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (auth.jwt()->>'org_id')::uuid
    AND (auth.jwt()->>'role')::text IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
  );

CREATE POLICY "Admins can update lead statuses"
  ON lead_statuses FOR UPDATE
  TO authenticated
  USING (
    org_id = (auth.jwt()->>'org_id')::uuid
    AND (auth.jwt()->>'role')::text IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
  )
  WITH CHECK (
    org_id = (auth.jwt()->>'org_id')::uuid
    AND (auth.jwt()->>'role')::text IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
  );

CREATE POLICY "Admins can delete non-system lead statuses"
  ON lead_statuses FOR DELETE
  TO authenticated
  USING (
    org_id = (auth.jwt()->>'org_id')::uuid
    AND (auth.jwt()->>'role')::text IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
    AND is_system = false
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lead_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lead_statuses_updated_at
  BEFORE UPDATE ON lead_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_statuses_updated_at();

-- Function to ensure only one default status per organization
CREATE OR REPLACE FUNCTION ensure_single_default_lead_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE lead_statuses
    SET is_default = false
    WHERE org_id = NEW.org_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_lead_status
  BEFORE INSERT OR UPDATE ON lead_statuses
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_lead_status();

-- Insert default lead statuses for all existing organizations
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    INSERT INTO lead_statuses (org_id, status_key, status_label, status_color, status_bg_color, description, display_order, is_active, is_default, is_system)
    VALUES
      (org.id, 'new', 'New', 'text-blue-700', 'bg-blue-100', 'Newly created lead, not yet contacted', 1, true, true, true),
      (org.id, 'contacted', 'Contacted', 'text-cyan-700', 'bg-cyan-100', 'Initial contact has been made', 2, true, false, true),
      (org.id, 'qualified', 'Qualified', 'text-teal-700', 'bg-teal-100', 'Lead meets qualification criteria', 3, true, false, true),
      (org.id, 'hot', 'Hot', 'text-red-700', 'bg-red-100', 'High-priority lead requiring immediate attention', 4, true, false, false),
      (org.id, 'warm', 'Warm', 'text-orange-700', 'bg-orange-100', 'Interested lead with good potential', 5, true, false, false),
      (org.id, 'cold', 'Cold', 'text-slate-700', 'bg-slate-100', 'Low-priority or unresponsive lead', 6, true, false, false),
      (org.id, 'mild', 'Mild', 'text-amber-700', 'bg-amber-100', 'Medium-priority lead with moderate engagement', 7, true, false, false),
      (org.id, 'negotiation', 'Negotiation', 'text-violet-700', 'bg-violet-100', 'In active sales discussions', 8, true, false, false),
      (org.id, 'proposal_sent', 'Proposal Sent', 'text-indigo-700', 'bg-indigo-100', 'Proposal has been sent, awaiting response', 9, true, false, false),
      (org.id, 'stale', 'Stale', 'text-gray-700', 'bg-gray-100', 'Inactive for an extended period', 10, true, false, true),
      (org.id, 'won', 'Won', 'text-green-700', 'bg-green-100', 'Successfully converted to customer', 11, true, false, true),
      (org.id, 'lost', 'Lost', 'text-red-700', 'bg-red-100', 'Lost to competitor or not interested', 12, true, false, true),
      (org.id, 'disqualified', 'Disqualified', 'text-slate-700', 'bg-slate-100', 'Does not meet qualification criteria', 13, true, false, true)
    ON CONFLICT (org_id, status_key) DO NOTHING;
  END LOOP;
END $$;
