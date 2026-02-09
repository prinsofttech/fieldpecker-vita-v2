/*
  # Fix User Insert Infinite Recursion

  1. Problem
    - INSERT policies on users table query the users table to check if user is super_admin
    - This creates infinite recursion when the query triggers SELECT policies
    - SELECT policies also query users table, creating circular dependency

  2. Solution
    - Create a SECURITY DEFINER function that bypasses RLS to check user role
    - This function can safely query users table without triggering RLS policies
    - Replace inline queries in policies with this function

  3. Changes
    - Create get_user_role_name() function with SECURITY DEFINER
    - Drop and recreate INSERT policies to use this function
    - Keep existing SELECT policies as they don't cause issues for reads
*/

-- Create a function that bypasses RLS to get the user's role name
CREATE OR REPLACE FUNCTION get_user_role_name(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role_name text;
BEGIN
  SELECT r.name INTO v_role_name
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = p_user_id;
  
  RETURN v_role_name;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_role_name(uuid) TO authenticated, anon;

-- Drop existing INSERT policies that cause recursion
DROP POLICY IF EXISTS "Super admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins and managers can insert users" ON users;

-- Recreate INSERT policies using the SECURITY DEFINER function
CREATE POLICY "Super admins can insert users"
  ON users FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role_name(auth.uid()) = 'super_admin'
  );

CREATE POLICY "Admins and managers can insert users"
  ON users FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.level <= 3
    )
    AND get_user_role_name(auth.uid()) IN ('client_admin', 'manager')
  );

-- Also fix UPDATE policies to prevent similar issues
DROP POLICY IF EXISTS "Super admins can update users" ON users;
DROP POLICY IF EXISTS "Admins and managers can update users" ON users;

CREATE POLICY "Super admins can update users"
  ON users FOR UPDATE TO authenticated
  USING (get_user_role_name(auth.uid()) = 'super_admin')
  WITH CHECK (get_user_role_name(auth.uid()) = 'super_admin');

CREATE POLICY "Admins and managers can update users"
  ON users FOR UPDATE TO authenticated
  USING (
    org_id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.level <= 3
    )
    AND get_user_role_name(auth.uid()) IN ('client_admin', 'manager')
  )
  WITH CHECK (
    org_id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.level <= 3
    )
    AND get_user_role_name(auth.uid()) IN ('client_admin', 'manager')
  );

-- Fix DELETE policies
DROP POLICY IF EXISTS "Super admins can delete users" ON users;
DROP POLICY IF EXISTS "Only admins can delete users" ON users;

CREATE POLICY "Super admins can delete users"
  ON users FOR DELETE TO authenticated
  USING (get_user_role_name(auth.uid()) = 'super_admin');

CREATE POLICY "Only admins can delete users"
  ON users FOR DELETE TO authenticated
  USING (
    org_id IN (
      SELECT u.org_id FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() AND r.name = 'client_admin'
    )
    AND get_user_role_name(auth.uid()) = 'client_admin'
  );
