/*
  # Fix Form Customer Attachments RLS Policy

  1. Changes
    - Fix "Users can view own attachments" policy that incorrectly compares customer_id with auth.uid()
    - Allow users to view attachments for forms in their organization

  2. Security
    - Maintains security by checking org membership through forms
*/

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Users can view own attachments" ON form_customer_attachments;

-- Create correct policy
CREATE POLICY "Users can view attachments in their org"
  ON form_customer_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM forms f
      JOIN users u ON u.org_id = f.org_id
      WHERE f.id = form_customer_attachments.form_id
        AND u.id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can view attachments in their org" ON form_customer_attachments IS 
  'Allows users to view form-customer attachments for forms in their organization';
