/*
  # Add INSERT, UPDATE, DELETE RLS policies to roles table

  1. Security Changes
    - Add INSERT policy for super_admin and client_admin roles
    - Add UPDATE policy for super_admin and client_admin roles
    - Add DELETE policy for super_admin and client_admin roles
  
  2. Notes
    - The roles table previously only had a SELECT policy
    - Client admins and super admins need to be able to create, edit, and delete roles
    - Role is determined from JWT app_metadata to avoid recursive lookups
*/

CREATE POLICY "Admins can insert roles"
  ON roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coalesce(
      current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
      ''
    ) IN ('super_admin', 'client_admin')
  );

CREATE POLICY "Admins can update roles"
  ON roles
  FOR UPDATE
  TO authenticated
  USING (
    coalesce(
      current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
      ''
    ) IN ('super_admin', 'client_admin')
  )
  WITH CHECK (
    coalesce(
      current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
      ''
    ) IN ('super_admin', 'client_admin')
  );

CREATE POLICY "Admins can delete roles"
  ON roles
  FOR DELETE
  TO authenticated
  USING (
    coalesce(
      current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
      ''
    ) IN ('super_admin', 'client_admin')
  );
