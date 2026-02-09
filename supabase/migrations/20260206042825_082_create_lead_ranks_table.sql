/*
  # Create Lead Ranks Configuration Table

  ## Purpose
  Allow organizations to configure lead ranking (e.g., Hot, Mild, Cold) separately from lead status.
  Ranks indicate the temperature/priority of a lead, while statuses track the lifecycle stage.

  ## Changes

  1. New Tables
    - `lead_ranks`
      - `id` (uuid, primary key)
      - `org_id` (uuid, references organizations) - Organization this rank belongs to
      - `rank_key` (text) - Unique identifier for the rank (e.g., 'hot', 'mild', 'cold')
      - `rank_label` (text) - Display label for the rank
      - `rank_color` (text) - Tailwind text color class
      - `rank_bg_color` (text) - Tailwind background color class
      - `description` (text) - Description of what the rank means
      - `display_order` (integer) - Order in which ranks should be displayed
      - `is_active` (boolean) - Whether the rank is active
      - `is_default` (boolean) - Whether this is the default rank for new leads
      - `is_system` (boolean) - Whether this is a system-defined rank (cannot be deleted)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `leads` - Add `rank_id` column referencing `lead_ranks`

  3. Indexes
    - Index on org_id for quick lookup
    - Unique constraint on org_id + rank_key combination
    - Index on display_order for sorting

  4. Security
    - Enable RLS on lead_ranks table
    - Admins can manage lead ranks for their organization
    - All authenticated users can view their organization's lead ranks

  5. Default Data
    - Populate default ranks (Hot, Mild, Cold) for all existing organizations
*/

-- Create lead_ranks table
CREATE TABLE IF NOT EXISTS lead_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rank_key text NOT NULL,
  rank_label text NOT NULL,
  rank_color text NOT NULL DEFAULT 'text-slate-700',
  rank_bg_color text NOT NULL DEFAULT 'bg-slate-100',
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_org_rank_key UNIQUE (org_id, rank_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lead_ranks_org_id ON lead_ranks(org_id);
CREATE INDEX IF NOT EXISTS idx_lead_ranks_display_order ON lead_ranks(org_id, display_order);
CREATE INDEX IF NOT EXISTS idx_lead_ranks_is_active ON lead_ranks(org_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE lead_ranks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization lead ranks"
  ON lead_ranks FOR SELECT
  TO authenticated
  USING (
    org_id = (auth.jwt()->>'org_id')::uuid
  );

CREATE POLICY "Admins can insert lead ranks"
  ON lead_ranks FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = (auth.jwt()->>'org_id')::uuid
    AND (auth.jwt()->>'role')::text IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
  );

CREATE POLICY "Admins can update lead ranks"
  ON lead_ranks FOR UPDATE
  TO authenticated
  USING (
    org_id = (auth.jwt()->>'org_id')::uuid
    AND (auth.jwt()->>'role')::text IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
  )
  WITH CHECK (
    org_id = (auth.jwt()->>'org_id')::uuid
    AND (auth.jwt()->>'role')::text IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
  );

CREATE POLICY "Admins can delete non-system lead ranks"
  ON lead_ranks FOR DELETE
  TO authenticated
  USING (
    org_id = (auth.jwt()->>'org_id')::uuid
    AND (auth.jwt()->>'role')::text IN ('super_admin', 'client_admin', 'regional_admin', 'branch_admin')
    AND is_system = false
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lead_ranks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lead_ranks_updated_at
  BEFORE UPDATE ON lead_ranks
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_ranks_updated_at();

-- Ensure only one default rank per organization
CREATE OR REPLACE FUNCTION ensure_single_default_lead_rank()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE lead_ranks
    SET is_default = false
    WHERE org_id = NEW.org_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_lead_rank
  BEFORE INSERT OR UPDATE ON lead_ranks
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_lead_rank();

-- Add rank_id column to leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'rank_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN rank_id uuid REFERENCES lead_ranks(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_rank_id ON leads(rank_id);

-- Insert default lead ranks for all existing organizations
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    INSERT INTO lead_ranks (org_id, rank_key, rank_label, rank_color, rank_bg_color, description, display_order, is_active, is_default, is_system)
    VALUES
      (org.id, 'hot', 'Hot', 'text-red-700', 'bg-red-100', 'High-priority lead requiring immediate attention', 1, true, false, true),
      (org.id, 'mild', 'Mild', 'text-amber-700', 'bg-amber-100', 'Medium-priority lead with moderate engagement', 2, true, true, true),
      (org.id, 'cold', 'Cold', 'text-sky-700', 'bg-sky-100', 'Low-priority or unresponsive lead', 3, true, false, true)
    ON CONFLICT (org_id, rank_key) DO NOTHING;
  END LOOP;
END $$;
