/*
  # Fix Customer Deletion Foreign Key Constraints

  ## Problem
  When trying to delete a customer that has associated issues, you get this error:
  "update or delete on table 'customers' violates foreign key constraint 'issues_customer_id_fkey' on table 'issues'"

  ## Solution
  This script updates the foreign key constraint on the `issues` table to allow
  customer deletion by setting the customer_id to NULL instead of preventing deletion.

  ## Instructions
  Run this SQL directly in your Supabase SQL Editor or via your database admin tool.

  ## Impact
  - Customer deletion will now succeed even if they have associated issues
  - Issues will have their customer_id set to NULL when the customer is deleted
  - No data loss - issues remain accessible with all other information intact
*/

-- Step 1: Drop the existing foreign key constraint on issues.customer_id
ALTER TABLE issues
  DROP CONSTRAINT IF EXISTS issues_customer_id_fkey;

-- Step 2: Add the constraint back with ON DELETE SET NULL
ALTER TABLE issues
  ADD CONSTRAINT issues_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES customers(id)
  ON DELETE SET NULL;

-- Verify the change
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'issues'
  AND con.contype = 'f'
  AND con.conname = 'issues_customer_id_fkey';
