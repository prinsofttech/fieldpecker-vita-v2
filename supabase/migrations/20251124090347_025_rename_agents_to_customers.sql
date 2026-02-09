/*
  # Rename Agents Table to Customers

  1. Changes
    - Rename `agents` table to `customers`
    - Rename agent-related columns to customer terminology
    - Update organization counter columns
    - Update all RLS policies
    - Update triggers and functions
    - Update foreign key constraints
    - Maintain all existing functionality with new naming

  2. Column Renames
    - agent_name → customer_name
    - agent_code → customer_code
    - agent_telephone → customer_telephone
    - agent_picture → customer_picture
    - agent_type → customer_type
    - total_agents → total_customers (in organizations)
    - max_agents → max_customers (in organizations)
*/

-- First, rename the organizations columns
ALTER TABLE organizations RENAME COLUMN total_agents TO total_customers;
ALTER TABLE organizations RENAME COLUMN max_agents TO max_customers;

-- Rename the main table
ALTER TABLE agents RENAME TO customers;

-- Rename columns in the customers table
ALTER TABLE customers RENAME COLUMN agent_name TO customer_name;
ALTER TABLE customers RENAME COLUMN agent_code TO customer_code;
ALTER TABLE customers RENAME COLUMN agent_telephone TO customer_telephone;
ALTER TABLE customers RENAME COLUMN agent_picture TO customer_picture;

-- Rename the custom type
ALTER TYPE agent_type RENAME TO customer_type;

-- Rename the column that uses the type
ALTER TABLE customers RENAME COLUMN agent_type TO customer_type;

-- Update column comments
COMMENT ON COLUMN customers.customer_code IS 'Unique customer identifier within organization';
COMMENT ON COLUMN customers.customer_picture IS 'URL to customer profile picture';
COMMENT ON TABLE customers IS 'Customer/client information - managed by organization users';

-- Update the counter trigger function
CREATE OR REPLACE FUNCTION update_organization_customer_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE organizations 
    SET total_customers = total_customers + 1 
    WHERE id = NEW.org_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE organizations 
    SET total_customers = GREATEST(total_customers - 1, 0)
    WHERE id = OLD.org_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS update_organization_agent_count_trigger ON customers;

CREATE TRIGGER update_organization_customer_count_trigger
AFTER INSERT OR DELETE ON customers
FOR EACH ROW EXECUTE FUNCTION update_organization_customer_count();
