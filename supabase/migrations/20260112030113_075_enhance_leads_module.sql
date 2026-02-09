/*
  # Enhance Leads Module

  ## Overview
  This migration enhances the leads management system with:
  - Picture/image support for leads
  - Territory and sub-territory assignment using regions table
  - Qualified status tracking
  - Stale lead marking
  - Progress status tracking

  ## Changes

  1. New Columns in `leads` table:
    - `picture_url` (text) - URL to lead's picture/photo
    - `territory_id` (uuid) - Reference to regions table (top-level territory)
    - `sub_territory_id` (uuid) - Reference to regions table (sub-territory)
    - `is_qualified` (boolean) - Whether lead has been qualified
    - `is_stale` (boolean) - Whether lead has been marked as stale
    - `progress_status` (text) - Additional progress tracking (negotiation, won, closed)

  2. Updated Status Values:
    - Primary statuses: new, hot, mild, cold
    - Progress statuses: negotiation, won, closed
    - Stale status: marked via is_stale flag

  3. Security:
    - No RLS changes needed (existing policies cover new columns)
*/

-- Add new columns to leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'picture_url'
  ) THEN
    ALTER TABLE leads ADD COLUMN picture_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'territory_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN territory_id uuid REFERENCES regions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'sub_territory_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN sub_territory_id uuid REFERENCES regions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'is_qualified'
  ) THEN
    ALTER TABLE leads ADD COLUMN is_qualified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'is_stale'
  ) THEN
    ALTER TABLE leads ADD COLUMN is_stale boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'progress_status'
  ) THEN
    ALTER TABLE leads ADD COLUMN progress_status text;
  END IF;
END $$;

-- Add check constraint for progress_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_progress_status_check'
  ) THEN
    ALTER TABLE leads
    ADD CONSTRAINT leads_progress_status_check
    CHECK (progress_status IS NULL OR progress_status IN ('negotiation', 'won', 'closed'));
  END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_leads_territory_id ON leads(territory_id);
CREATE INDEX IF NOT EXISTS idx_leads_sub_territory_id ON leads(sub_territory_id);
CREATE INDEX IF NOT EXISTS idx_leads_is_qualified ON leads(is_qualified);
CREATE INDEX IF NOT EXISTS idx_leads_is_stale ON leads(is_stale);
CREATE INDEX IF NOT EXISTS idx_leads_progress_status ON leads(progress_status) WHERE progress_status IS NOT NULL;

-- Update trigger to track qualified status changes
CREATE OR REPLACE FUNCTION track_lead_qualified_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_qualified IS DISTINCT FROM NEW.is_qualified THEN
    INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by, notes)
    VALUES (
      NEW.id,
      CASE WHEN OLD.is_qualified THEN 'qualified' ELSE 'unqualified' END,
      CASE WHEN NEW.is_qualified THEN 'qualified' ELSE 'unqualified' END,
      auth.uid(),
      'Qualification status changed'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_track_lead_qualified ON leads;
CREATE TRIGGER trigger_track_lead_qualified
  AFTER UPDATE ON leads
  FOR EACH ROW
  WHEN (OLD.is_qualified IS DISTINCT FROM NEW.is_qualified)
  EXECUTE FUNCTION track_lead_qualified_change();

-- Update trigger to track stale status changes
CREATE OR REPLACE FUNCTION track_lead_stale_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_stale IS DISTINCT FROM NEW.is_stale THEN
    INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by, notes)
    VALUES (
      NEW.id,
      CASE WHEN OLD.is_stale THEN 'stale' ELSE 'active' END,
      CASE WHEN NEW.is_stale THEN 'stale' ELSE 'active' END,
      auth.uid(),
      'Stale status changed'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_track_lead_stale ON leads;
CREATE TRIGGER trigger_track_lead_stale
  AFTER UPDATE ON leads
  FOR EACH ROW
  WHEN (OLD.is_stale IS DISTINCT FROM NEW.is_stale)
  EXECUTE FUNCTION track_lead_stale_change();

-- Update trigger to track progress status changes
CREATE OR REPLACE FUNCTION track_lead_progress_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.progress_status IS DISTINCT FROM NEW.progress_status THEN
    INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by, notes)
    VALUES (
      NEW.id,
      COALESCE(OLD.progress_status, 'none'),
      COALESCE(NEW.progress_status, 'none'),
      auth.uid(),
      'Progress status changed'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_track_lead_progress ON leads;
CREATE TRIGGER trigger_track_lead_progress
  AFTER UPDATE ON leads
  FOR EACH ROW
  WHEN (OLD.progress_status IS DISTINCT FROM NEW.progress_status)
  EXECUTE FUNCTION track_lead_progress_change();
