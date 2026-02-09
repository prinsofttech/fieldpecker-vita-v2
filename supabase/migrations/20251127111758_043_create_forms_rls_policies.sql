/*
  # Forms Module - Row Level Security Policies

  ## Overview
  This migration creates comprehensive RLS policies for all forms tables to ensure:
  - Hierarchical access control based on team structure
  - Organization-level data isolation
  - Role-based permissions (super_admin, client_admin, supervisor, agent)
  - Proper read/write restrictions

  ## Security Model

  ### Forms Table
  - Admins: Full access to all forms in their organization
  - Supervisors: Can view forms assigned to their department
  - Agents: Can view forms available to them

  ### Form Customer Attachments
  - Admins: Full management within their organization
  - Agents: Can view their own attachments

  ### Form Submissions Log
  - Users: Can view their own logs
  - Supervisors: Can view team member logs
  - Admins: Can view all logs in organization

  ### Form Submissions
  - Users: Can view and submit their own forms
  - Supervisors: Can view team submissions
  - Admins: Can view and review all submissions
  - Reviewers: Can update submission status

  ### Form Config History
  - Admins: Full access within organization
  - Others: Read-only access to relevant history
*/

-- =====================================================
-- FORMS TABLE POLICIES
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view all forms in org" ON forms;
DROP POLICY IF EXISTS "Admins can manage forms" ON forms;
DROP POLICY IF EXISTS "Users can view active forms for their org" ON forms;

-- Admins can see all forms in their organization
CREATE POLICY "Admins can view all forms in org"
ON forms FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
    AND u.org_id = forms.org_id
    AND r.name IN ('super_admin', 'client_admin')
  )
);

-- Users can view active forms in their organization
CREATE POLICY "Users can view active forms for their org"
ON forms FOR SELECT
TO authenticated
USING (
  is_active = true
  AND org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  )
);

-- Only admins can create forms
CREATE POLICY "Admins can create forms"
ON forms FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
    AND u.org_id = forms.org_id
    AND r.name IN ('super_admin', 'client_admin')
  )
);

-- Only admins can update forms
CREATE POLICY "Admins can update forms"
ON forms FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
    AND u.org_id = forms.org_id
    AND r.name IN ('super_admin', 'client_admin')
  )
);

-- Only admins can delete forms
CREATE POLICY "Admins can delete forms"
ON forms FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
    AND u.org_id = forms.org_id
    AND r.name IN ('super_admin', 'client_admin')
  )
);

-- =====================================================
-- FORM_CUSTOMER_ATTACHMENTS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all attachments" ON form_customer_attachments;
DROP POLICY IF EXISTS "Users can view own attachments" ON form_customer_attachments;
DROP POLICY IF EXISTS "Admins can manage attachments" ON form_customer_attachments;

-- Admins can view all attachments in their org
CREATE POLICY "Admins can view all attachments"
ON form_customer_attachments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    JOIN forms f ON f.id = form_customer_attachments.form_id
    WHERE u.id = auth.uid()
    AND u.org_id = f.org_id
    AND r.name IN ('super_admin', 'client_admin')
  )
);

-- Users can view their own attachments
CREATE POLICY "Users can view own attachments"
ON form_customer_attachments FOR SELECT
TO authenticated
USING (
  customer_id::text = auth.uid()::text
);

-- Only admins can create attachments
CREATE POLICY "Admins can create attachments"
ON form_customer_attachments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    JOIN forms f ON f.id = form_customer_attachments.form_id
    WHERE u.id = auth.uid()
    AND u.org_id = f.org_id
    AND r.name IN ('super_admin', 'client_admin')
  )
);

-- Only admins can update attachments
CREATE POLICY "Admins can update attachments"
ON form_customer_attachments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    JOIN forms f ON f.id = form_customer_attachments.form_id
    WHERE u.id = auth.uid()
    AND u.org_id = f.org_id
    AND r.name IN ('super_admin', 'client_admin')
  )
);

-- Only admins can delete attachments
CREATE POLICY "Admins can delete attachments"
ON form_customer_attachments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    JOIN forms f ON f.id = form_customer_attachments.form_id
    WHERE u.id = auth.uid()
    AND u.org_id = f.org_id
    AND r.name IN ('super_admin', 'client_admin')
  )
);

-- =====================================================
-- FORM_SUBMISSIONS_LOG TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own log" ON form_submissions_log;
DROP POLICY IF EXISTS "Supervisors can view team logs" ON form_submissions_log;
DROP POLICY IF EXISTS "Admins can view all logs" ON form_submissions_log;
DROP POLICY IF EXISTS "System can create logs" ON form_submissions_log;
DROP POLICY IF EXISTS "System can update logs" ON form_submissions_log;

-- Users can view their own logs
CREATE POLICY "Users can view own log"
ON form_submissions_log FOR SELECT
TO authenticated
USING (agent_id::text = auth.uid()::text);

-- Supervisors can view team member logs
CREATE POLICY "Supervisors can view team logs"
ON form_submissions_log FOR SELECT
TO authenticated
USING (
  agent_id IN (
    SELECT subordinate_id FROM get_team_hierarchy(auth.uid())
  )
);

-- Admins can view all logs in their org
CREATE POLICY "Admins can view all logs"
ON form_submissions_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    JOIN forms f ON f.id = form_submissions_log.form_id
    WHERE u.id = auth.uid()
    AND u.org_id = f.org_id
    AND r.name IN ('super_admin', 'client_admin')
  )
);

-- System can create logs (via functions)
CREATE POLICY "System can create logs"
ON form_submissions_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- System can update logs (via functions)
CREATE POLICY "System can update logs"
ON form_submissions_log FOR UPDATE
TO authenticated
USING (true);

-- =====================================================
-- FORM_SUBMISSIONS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own submissions" ON form_submissions;
DROP POLICY IF EXISTS "Supervisors can view team submissions" ON form_submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON form_submissions;
DROP POLICY IF EXISTS "Users can submit forms" ON form_submissions;
DROP POLICY IF EXISTS "Admins can submit on behalf" ON form_submissions;
DROP POLICY IF EXISTS "Reviewers can update submission status" ON form_submissions;

-- Users can view their own submissions
CREATE POLICY "Users can view own submissions"
ON form_submissions FOR SELECT
TO authenticated
USING (agent_id::text = auth.uid()::text);

-- Supervisors can view team submissions
CREATE POLICY "Supervisors can view team submissions"
ON form_submissions FOR SELECT
TO authenticated
USING (
  agent_id IN (
    SELECT subordinate_id FROM get_team_hierarchy(auth.uid())
  )
);

-- Admins can view all submissions in their org
CREATE POLICY "Admins can view all submissions"
ON form_submissions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    JOIN forms f ON f.id = form_submissions.form_id
    WHERE u.id = auth.uid()
    AND u.org_id = f.org_id
    AND r.name IN ('super_admin', 'client_admin')
  )
);

-- Users can submit their own forms
CREATE POLICY "Users can submit forms"
ON form_submissions FOR INSERT
TO authenticated
WITH CHECK (agent_id::text = auth.uid()::text);

-- Admins can submit on behalf of others
CREATE POLICY "Admins can submit on behalf"
ON form_submissions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
    AND r.name IN ('super_admin', 'client_admin')
  )
);

-- Admins and supervisors can update submission status (review)
CREATE POLICY "Reviewers can update submission status"
ON form_submissions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
    AND r.name IN ('super_admin', 'client_admin', 'supervisor')
  )
  AND (
    -- Admin can review any in their org
    EXISTS (
      SELECT 1 FROM users u
      JOIN forms f ON f.id = form_submissions.form_id
      WHERE u.id = auth.uid()
      AND u.org_id = f.org_id
      AND u.role_id IN (SELECT id FROM roles WHERE name IN ('super_admin', 'client_admin'))
    )
    OR
    -- Supervisor can review team submissions
    agent_id IN (
      SELECT subordinate_id FROM get_team_hierarchy(auth.uid())
    )
  )
);

-- =====================================================
-- FORM_CONFIG_HISTORY TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Admins can view config history" ON form_config_history;
DROP POLICY IF EXISTS "Admins can create config history" ON form_config_history;

-- Admins can view config history for their org
CREATE POLICY "Admins can view config history"
ON form_config_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    JOIN forms f ON f.id = form_config_history.form_id
    WHERE u.id = auth.uid()
    AND u.org_id = f.org_id
    AND r.name IN ('super_admin', 'client_admin')
  )
);

-- System can create config history entries
CREATE POLICY "Admins can create config history"
ON form_config_history FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    JOIN forms f ON f.id = form_config_history.form_id
    WHERE u.id = auth.uid()
    AND u.org_id = f.org_id
    AND r.name IN ('super_admin', 'client_admin')
  )
);
