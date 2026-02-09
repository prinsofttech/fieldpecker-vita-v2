/*
  # Fix Customer Table Triggers and Functions

  1. Changes
    - Drop old agent-related triggers
    - Drop old agent-related functions
    - Create new customer-specific functions
    - Ensure only the correct customer count trigger exists

  2. Purpose
    - Remove references to old agent table/columns
    - Fix the "total_agents does not exist" error
    - Clean up duplicate triggers
*/

-- Drop old agent triggers
DROP TRIGGER IF EXISTS agents_count_delete_trigger ON customers;
DROP TRIGGER IF EXISTS agents_count_insert_trigger ON customers;
DROP TRIGGER IF EXISTS agents_updated_at_trigger ON customers;

-- Drop old agent functions
DROP FUNCTION IF EXISTS update_org_agents_count();
DROP FUNCTION IF EXISTS update_agents_updated_at();

-- Create updated_at trigger function for customers
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger for customers
CREATE TRIGGER customers_updated_at_trigger
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION update_customers_updated_at();

-- Verify the customer count trigger exists (it should from migration 025)
-- If it doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_organization_customer_count_trigger'
  ) THEN
    CREATE TRIGGER update_organization_customer_count_trigger
    AFTER INSERT OR DELETE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_organization_customer_count();
  END IF;
END $$;
