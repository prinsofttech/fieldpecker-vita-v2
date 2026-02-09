/*
  # Add Organization Logo URL Field

  1. Changes
    - Add `logo_url` column to `organizations` table
      - Stores URL or path to organization's logo image
      - Optional field (nullable)
      - Text type for flexibility with storage solutions

  2. Purpose
    - Allows organizations to display their branding in the dashboard
    - Enhances visual identity and professionalism
    - Supports custom branding per organization
*/

-- Add logo_url column to organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE organizations ADD COLUMN logo_url text;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN organizations.logo_url IS 'URL or path to the organization logo image';
