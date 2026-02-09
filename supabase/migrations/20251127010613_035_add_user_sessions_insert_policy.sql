/*
  # Add INSERT policy for user_sessions

  ## Problem
  Users cannot create their own session records due to missing INSERT policy.
  This causes:
  - No sessions created on login
  - Users get logged out immediately (no active session found)
  - Super admins login without session tracking

  ## Solution
  Add INSERT policy to allow authenticated users to create their own sessions.

  ## Changes
  1. Add INSERT policy for user_sessions table
     - Allow authenticated users to insert sessions for themselves
     - Prevent users from creating sessions for other users

  ## Security
  - Policy checks: auth.uid() = user_id
  - Only authenticated users can insert
  - Can only create sessions for themselves
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can create own sessions" ON user_sessions;

-- Allow users to insert their own sessions
CREATE POLICY "Users can create own sessions"
  ON user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Also add UPDATE policy for session activity tracking
DROP POLICY IF EXISTS "Users can update own sessions" ON user_sessions;

CREATE POLICY "Users can update own sessions"
  ON user_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add DELETE policy for users to terminate their own sessions
DROP POLICY IF EXISTS "Users can delete own sessions" ON user_sessions;

CREATE POLICY "Users can delete own sessions"
  ON user_sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
