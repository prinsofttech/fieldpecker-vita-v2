/*
  # Consolidate Leads Module

  1. Changes
    - Replace 'leads_sales' (CRM Leads) with 'leads' module in org_modules
    - Remove the duplicate 'leads_sales' module from the system
    - Maintain only one "Leads" module in the system
  
  2. Security
    - No security changes needed
*/

-- Update org_modules to use 'leads' instead of 'leads_sales'
UPDATE org_modules
SET module_id = 'a3e675a2-48f9-4cd7-ae22-803502bad942'
WHERE module_id = 'cd3cee83-9eb4-41ee-8724-bca39f14c25d';

-- Delete the duplicate 'leads_sales' module
DELETE FROM modules
WHERE id = 'cd3cee83-9eb4-41ee-8724-bca39f14c25d';
