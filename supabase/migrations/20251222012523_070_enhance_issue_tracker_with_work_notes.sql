/*
  # Enhance Issue Tracker with Work Notes and Configurable Statuses

  1. Changes
    - Add status_id column to issues table to reference issue_statuses
    - Add is_work_note column to issue_comments
    - Add is_closed column to issue_statuses
    - Add unique constraint on issue_statuses(org_id, name)
    - Update existing statuses with is_closed flag

  2. Security
    - Existing RLS policies remain in place

  3. Features
    - Work notes vs regular comments
    - Configurable statuses per organization
    - Track closed/open status
*/

-- Add is_closed column to issue_statuses if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issue_statuses' AND column_name = 'is_closed'
  ) THEN
    ALTER TABLE issue_statuses ADD COLUMN is_closed boolean DEFAULT false;
  END IF;
END $$;

-- Add unique constraint on org_id and name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'issue_statuses_org_id_name_key'
  ) THEN
    ALTER TABLE issue_statuses ADD CONSTRAINT issue_statuses_org_id_name_key UNIQUE (org_id, name);
  END IF;
END $$;

-- Add status_id column to issues table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issues' AND column_name = 'status_id'
  ) THEN
    ALTER TABLE issues ADD COLUMN status_id uuid REFERENCES issue_statuses(id);
  END IF;
END $$;

-- Add is_work_note column to issue_comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issue_comments' AND column_name = 'is_work_note'
  ) THEN
    ALTER TABLE issue_comments ADD COLUMN is_work_note boolean DEFAULT true;
  END IF;
END $$;

-- Update existing comments to be work notes by default
UPDATE issue_comments SET is_work_note = true WHERE is_work_note IS NULL;

-- Update existing statuses with is_closed flag
UPDATE issue_statuses SET is_closed = true WHERE name IN ('resolved', 'closed');
UPDATE issue_statuses SET is_closed = false WHERE name NOT IN ('resolved', 'closed') AND is_closed IS NULL;

-- Ensure all organizations have the default statuses
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations LOOP
    -- Insert default statuses if they don't exist
    INSERT INTO issue_statuses (org_id, name, display_name, description, color, is_closed, is_default, sort_order)
    VALUES
      (org_record.id, 'new', 'New', 'Newly created issue', '#3B82F6', false, true, 1),
      (org_record.id, 'assigned', 'Assigned', 'Issue has been assigned', '#8B5CF6', false, false, 2),
      (org_record.id, 'in_progress', 'In Progress', 'Work is in progress', '#F59E0B', false, false, 3),
      (org_record.id, 'pending', 'Pending', 'Waiting for response', '#6B7280', false, false, 4),
      (org_record.id, 'on_hold', 'On Hold', 'Temporarily paused', '#94A3B8', false, false, 5),
      (org_record.id, 'resolved', 'Resolved', 'Issue has been resolved', '#10B981', true, false, 6),
      (org_record.id, 'closed', 'Closed', 'Issue is closed', '#64748B', true, false, 7)
    ON CONFLICT (org_id, name) DO UPDATE SET
      is_closed = EXCLUDED.is_closed,
      sort_order = EXCLUDED.sort_order;
  END LOOP;
END $$;

-- Update existing issues to use status_id based on their text status
UPDATE issues i
SET status_id = (
  SELECT s.id
  FROM issue_statuses s
  WHERE s.org_id = i.org_id
    AND s.name = i.status
  LIMIT 1
)
WHERE status_id IS NULL AND status IS NOT NULL;

-- Create function to track status changes with new status_id
CREATE OR REPLACE FUNCTION track_issue_status_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Track status changes using status_id
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status_change',
            jsonb_build_object('status_id', OLD.status_id),
            jsonb_build_object('status_id', NEW.status_id));
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

  -- Track category changes
  IF OLD.category_id IS DISTINCT FROM NEW.category_id THEN
    INSERT INTO issue_history (issue_id, changed_by, change_type, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'category_change',
            jsonb_build_object('category_id', OLD.category_id),
            jsonb_build_object('category_id', NEW.category_id));
  END IF;

  RETURN NEW;
END;
$$;

-- Replace the trigger
DROP TRIGGER IF EXISTS trigger_track_issue_changes ON issues;
DROP TRIGGER IF EXISTS trigger_track_issue_status_changes ON issues;
CREATE TRIGGER trigger_track_issue_status_changes
  AFTER UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION track_issue_status_changes();
