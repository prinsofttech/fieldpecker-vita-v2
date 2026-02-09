/*
  # Add Operating Field to Departments

  1. Changes
    - Add `operating` field to departments table
    - Can be either 'on_field' or 'in_office'
    - Default to 'in_office'

  2. Purpose
    - Track whether department operates on field or in office
    - Required for department management UI
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'departments' AND column_name = 'operating'
  ) THEN
    ALTER TABLE departments 
    ADD COLUMN operating text DEFAULT 'in_office' CHECK (operating IN ('on_field', 'in_office'));
  END IF;
END $$;