# Forms Module - Technical Specification

## Executive Summary

This document outlines the technical architecture for a dynamic forms management system with hierarchical access controls, time-based visibility rules, and comprehensive tracking capabilities.

---

## 1. System Architecture Overview

### Core Modules
1. **Forms Management** - Creation, configuration, and lifecycle management
2. **Access Control** - Hierarchical permissions and visibility rules
3. **Logging & Tracking** - Monthly form submission logs with reset mechanism
4. **Export System** - CSV generation for authorized users
5. **Real-time Evaluation Engine** - Dynamic form visibility determination

---

## 2. Database Schema Design

### 2.1 Forms Table
```sql
CREATE TABLE forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  internal_form_id text UNIQUE NOT NULL, -- e.g., "FORM-2024-001"

  -- Basic Information
  title text NOT NULL,
  description text,
  form_schema jsonb NOT NULL, -- Dynamic form fields definition

  -- Assignment
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id),

  -- Configuration Flags
  attach_to_customer boolean DEFAULT false,
  cycles_per_month integer CHECK (cycles_per_month IN (1, 2, 3, 4)),
  enable_freeze boolean DEFAULT false,
  cycle_freeze_duration interval, -- e.g., '3 days', '12 hours'

  -- Status
  is_active boolean DEFAULT true,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Indexes
  CONSTRAINT valid_freeze_config CHECK (
    (enable_freeze = false) OR
    (enable_freeze = true AND cycle_freeze_duration IS NOT NULL)
  )
);

CREATE INDEX idx_forms_org_id ON forms(org_id);
CREATE INDEX idx_forms_department_id ON forms(department_id);
CREATE INDEX idx_forms_active ON forms(is_active) WHERE is_active = true;
```

### 2.2 Form-Customer Attachments
```sql
CREATE TABLE form_customer_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Composite Relationship
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Criteria for visibility
  criteria jsonb NOT NULL, -- Dynamic criteria rules

  -- Status
  is_active boolean DEFAULT true,

  -- Timestamps
  attached_at timestamptz DEFAULT now(),
  attached_by uuid REFERENCES users(id),

  -- Unique constraint: one attachment per form-customer pair
  UNIQUE(form_id, customer_id)
);

CREATE INDEX idx_form_customer_form_id ON form_customer_attachments(form_id);
CREATE INDEX idx_form_customer_customer_id ON form_customer_attachments(customer_id);
CREATE INDEX idx_form_customer_active ON form_customer_attachments(is_active) WHERE is_active = true;
```

### 2.3 Form Submissions Log (Monthly Reset)
```sql
CREATE TABLE form_submissions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Composite Key Components
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE, -- agents = customers

  -- Tracking Period
  tracking_month date NOT NULL, -- First day of month: '2024-11-01'

  -- Submission Tracking
  current_cycle integer DEFAULT 0,
  max_cycles_allowed integer NOT NULL,
  submissions_count integer DEFAULT 0,

  -- Freeze Management
  is_frozen boolean DEFAULT false,
  freeze_expires_at timestamptz,
  last_submission_at timestamptz,

  -- Form Configuration Snapshot (for historical reference)
  config_snapshot jsonb, -- Stores form flags at time of log creation

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Composite unique constraint
  UNIQUE(form_id, agent_id, tracking_month)
);

CREATE INDEX idx_submissions_log_form_agent ON form_submissions_log(form_id, agent_id);
CREATE INDEX idx_submissions_log_month ON form_submissions_log(tracking_month);
CREATE INDEX idx_submissions_log_frozen ON form_submissions_log(is_frozen) WHERE is_frozen = true;
```

### 2.4 Form Submissions (Actual Data)
```sql
CREATE TABLE form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  log_id uuid REFERENCES form_submissions_log(id) ON DELETE SET NULL,

  -- Submission Data
  submission_data jsonb NOT NULL, -- Actual form field values

  -- Metadata
  cycle_number integer NOT NULL,
  submitted_by uuid REFERENCES users(id), -- If submitted on behalf

  -- Geolocation (optional)
  latitude decimal(10, 8),
  longitude decimal(11, 8),

  -- Status
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  review_notes text,

  -- Timestamps
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_submissions_form_id ON form_submissions(form_id);
CREATE INDEX idx_submissions_agent_id ON form_submissions(agent_id);
CREATE INDEX idx_submissions_log_id ON form_submissions(log_id);
CREATE INDEX idx_submissions_submitted_at ON form_submissions(submitted_at);
CREATE INDEX idx_submissions_status ON form_submissions(status);
```

### 2.5 Form Config Change History
```sql
CREATE TABLE form_config_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,

  -- Change Tracking
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz DEFAULT now(),

  -- What Changed
  field_name text NOT NULL,
  old_value text,
  new_value text,

  -- Month Context
  effective_month date NOT NULL -- Which month this change affects
);

CREATE INDEX idx_config_history_form_id ON form_config_history(form_id);
CREATE INDEX idx_config_history_month ON form_config_history(effective_month);
```

---

## 3. Access Control & Hierarchy

### 3.1 Hierarchical Access Rules

**Team Hierarchy Access:**
```sql
-- Function to get all subordinates in hierarchy
CREATE OR REPLACE FUNCTION get_team_hierarchy(p_user_id uuid)
RETURNS TABLE (
  subordinate_id uuid,
  hierarchy_level integer,
  reporting_path uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE team_tree AS (
    -- Base case: direct reports
    SELECT
      id as subordinate_id,
      1 as hierarchy_level,
      ARRAY[p_user_id, id] as reporting_path
    FROM customers
    WHERE supervisor_id = p_user_id

    UNION ALL

    -- Recursive case: reports of reports
    SELECT
      c.id,
      tt.hierarchy_level + 1,
      tt.reporting_path || c.id
    FROM customers c
    INNER JOIN team_tree tt ON c.supervisor_id = tt.subordinate_id
    WHERE NOT c.id = ANY(tt.reporting_path) -- Prevent circular references
  )
  SELECT * FROM team_tree;
END;
$$;
```

### 3.2 Permission Checks

```sql
-- Function to check if user can access form for specific agent
CREATE OR REPLACE FUNCTION can_access_agent_form(
  p_user_id uuid,
  p_agent_id uuid,
  p_form_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
  v_is_subordinate boolean;
  v_same_org boolean;
BEGIN
  -- Get user role
  SELECT r.name INTO v_user_role
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.id = p_user_id;

  -- Admin and client_admin can access all
  IF v_user_role IN ('super_admin', 'client_admin') THEN
    RETURN true;
  END IF;

  -- Check if agent is in user's hierarchy
  SELECT EXISTS(
    SELECT 1 FROM get_team_hierarchy(p_user_id)
    WHERE subordinate_id = p_agent_id
  ) INTO v_is_subordinate;

  -- Check if same organization
  SELECT EXISTS(
    SELECT 1 FROM users u1
    JOIN customers c ON c.id = p_agent_id
    WHERE u1.id = p_user_id
    AND u1.org_id = c.org_id
  ) INTO v_same_org;

  RETURN (v_is_subordinate OR p_user_id::text = p_agent_id::text) AND v_same_org;
END;
$$;
```

---

## 4. Real-time Form Visibility Engine

### 4.1 Visibility Evaluation Function

```sql
CREATE OR REPLACE FUNCTION evaluate_form_visibility(
  p_form_id uuid,
  p_agent_id uuid,
  p_check_time timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_form record;
  v_log record;
  v_attachment record;
  v_result jsonb;
  v_current_month date;
BEGIN
  v_current_month := date_trunc('month', p_check_time)::date;

  -- Get form configuration
  SELECT * INTO v_form
  FROM forms
  WHERE id = p_form_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'visible', false,
      'reason', 'form_not_found_or_inactive'
    );
  END IF;

  -- Check if form is attached to customer
  IF v_form.attach_to_customer THEN
    SELECT * INTO v_attachment
    FROM form_customer_attachments
    WHERE form_id = p_form_id
    AND customer_id = p_agent_id
    AND is_active = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'visible', false,
        'reason', 'not_attached_to_customer'
      );
    END IF;

    -- Evaluate criteria
    -- This would call a separate criteria evaluation function
    IF NOT evaluate_criteria(v_attachment.criteria, p_agent_id) THEN
      RETURN jsonb_build_object(
        'visible', false,
        'reason', 'criteria_not_met',
        'criteria', v_attachment.criteria
      );
    END IF;
  END IF;

  -- Get or create submission log for current month
  SELECT * INTO v_log
  FROM form_submissions_log
  WHERE form_id = p_form_id
  AND agent_id = p_agent_id
  AND tracking_month = v_current_month;

  IF NOT FOUND THEN
    -- Create log entry for this month
    INSERT INTO form_submissions_log (
      form_id,
      agent_id,
      tracking_month,
      max_cycles_allowed,
      config_snapshot
    ) VALUES (
      p_form_id,
      p_agent_id,
      v_current_month,
      v_form.cycles_per_month,
      jsonb_build_object(
        'cycles_per_month', v_form.cycles_per_month,
        'enable_freeze', v_form.enable_freeze,
        'cycle_freeze_duration', v_form.cycle_freeze_duration
      )
    )
    RETURNING * INTO v_log;
  END IF;

  -- Check if frozen
  IF v_log.is_frozen AND v_log.freeze_expires_at > p_check_time THEN
    RETURN jsonb_build_object(
      'visible', false,
      'reason', 'form_frozen',
      'freeze_expires_at', v_log.freeze_expires_at,
      'remaining_seconds', EXTRACT(EPOCH FROM (v_log.freeze_expires_at - p_check_time))
    );
  END IF;

  -- Check if max cycles reached
  IF v_log.current_cycle >= v_log.max_cycles_allowed THEN
    RETURN jsonb_build_object(
      'visible', false,
      'reason', 'max_cycles_reached',
      'current_cycle', v_log.current_cycle,
      'max_cycles', v_log.max_cycles_allowed
    );
  END IF;

  -- Form is visible
  RETURN jsonb_build_object(
    'visible', true,
    'reason', 'accessible',
    'current_cycle', v_log.current_cycle,
    'max_cycles', v_log.max_cycles_allowed,
    'remaining_submissions', v_log.max_cycles_allowed - v_log.current_cycle,
    'log_id', v_log.id
  );
END;
$$;
```

### 4.2 Criteria Evaluation Function

```sql
CREATE OR REPLACE FUNCTION evaluate_criteria(
  p_criteria jsonb,
  p_agent_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rule jsonb;
  v_field text;
  v_operator text;
  v_value text;
  v_agent_value text;
BEGIN
  -- If no criteria, always pass
  IF p_criteria IS NULL OR jsonb_array_length(p_criteria) = 0 THEN
    RETURN true;
  END IF;

  -- Evaluate each rule (AND logic)
  FOR v_rule IN SELECT * FROM jsonb_array_elements(p_criteria)
  LOOP
    v_field := v_rule->>'field';
    v_operator := v_rule->>'operator';
    v_value := v_rule->>'value';

    -- Get agent's field value
    EXECUTE format('SELECT %I::text FROM customers WHERE id = $1', v_field)
    INTO v_agent_value
    USING p_agent_id;

    -- Evaluate based on operator
    CASE v_operator
      WHEN 'equals' THEN
        IF v_agent_value != v_value THEN
          RETURN false;
        END IF;
      WHEN 'not_equals' THEN
        IF v_agent_value = v_value THEN
          RETURN false;
        END IF;
      WHEN 'contains' THEN
        IF v_agent_value NOT LIKE '%' || v_value || '%' THEN
          RETURN false;
        END IF;
      WHEN 'greater_than' THEN
        IF v_agent_value::numeric <= v_value::numeric THEN
          RETURN false;
        END IF;
      WHEN 'less_than' THEN
        IF v_agent_value::numeric >= v_value::numeric THEN
          RETURN false;
        END IF;
      ELSE
        RAISE EXCEPTION 'Unknown operator: %', v_operator;
    END CASE;
  END LOOP;

  RETURN true;
END;
$$;
```

---

## 5. Form Submission Flow

### 5.1 Submit Form Function

```sql
CREATE OR REPLACE FUNCTION submit_form(
  p_form_id uuid,
  p_agent_id uuid,
  p_submission_data jsonb,
  p_submitted_by uuid DEFAULT NULL,
  p_latitude decimal DEFAULT NULL,
  p_longitude decimal DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_visibility jsonb;
  v_log record;
  v_form record;
  v_submission_id uuid;
  v_new_cycle integer;
  v_freeze_expires timestamptz;
BEGIN
  -- Check visibility
  v_visibility := evaluate_form_visibility(p_form_id, p_agent_id);

  IF NOT (v_visibility->>'visible')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'form_not_visible',
      'details', v_visibility
    );
  END IF;

  -- Get log record
  SELECT * INTO v_log
  FROM form_submissions_log
  WHERE id = (v_visibility->>'log_id')::uuid;

  -- Get form config
  SELECT * INTO v_form
  FROM forms
  WHERE id = p_form_id;

  -- Calculate new cycle and freeze time
  v_new_cycle := v_log.current_cycle + 1;

  IF v_form.enable_freeze THEN
    v_freeze_expires := now() + v_form.cycle_freeze_duration;
  END IF;

  -- Insert submission
  INSERT INTO form_submissions (
    form_id,
    agent_id,
    log_id,
    submission_data,
    cycle_number,
    submitted_by,
    latitude,
    longitude
  ) VALUES (
    p_form_id,
    p_agent_id,
    v_log.id,
    p_submission_data,
    v_new_cycle,
    COALESCE(p_submitted_by, p_agent_id),
    p_latitude,
    p_longitude
  )
  RETURNING id INTO v_submission_id;

  -- Update log
  UPDATE form_submissions_log
  SET
    current_cycle = v_new_cycle,
    submissions_count = submissions_count + 1,
    last_submission_at = now(),
    is_frozen = v_form.enable_freeze,
    freeze_expires_at = v_freeze_expires,
    updated_at = now()
  WHERE id = v_log.id;

  RETURN jsonb_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'cycle_number', v_new_cycle,
    'frozen_until', v_freeze_expires
  );
END;
$$;
```

---

## 6. Monthly Reset System

### 6.1 Automated Reset Function

```sql
CREATE OR REPLACE FUNCTION reset_monthly_form_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_month date;
  v_current_month date;
  v_archived_count integer;
BEGIN
  v_current_month := date_trunc('month', now())::date;
  v_last_month := (v_current_month - interval '1 month')::date;

  -- Archive last month's logs (optional: move to archive table)
  -- For now, they stay in the table but new month starts fresh

  -- The next time a form is accessed, a new log will be created
  -- for the current month automatically via evaluate_form_visibility

  -- Log the reset event
  INSERT INTO system_events (
    event_type,
    event_data,
    created_at
  ) VALUES (
    'monthly_form_log_reset',
    jsonb_build_object(
      'reset_month', v_current_month,
      'previous_month', v_last_month
    ),
    now()
  );

  -- Return count of active logs that will be replaced
  SELECT COUNT(*) INTO v_archived_count
  FROM form_submissions_log
  WHERE tracking_month = v_last_month;

  RETURN v_archived_count;
END;
$$;

-- Create system_events table if not exists
CREATE TABLE IF NOT EXISTS system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Schedule monthly reset using pg_cron (if available)
-- SELECT cron.schedule(
--   'monthly-form-log-reset',
--   '0 0 1 * *', -- First day of month at midnight
--   'SELECT reset_monthly_form_logs()'
-- );
```

---

## 7. CSV Export System

### 7.1 Export Function

```sql
CREATE OR REPLACE FUNCTION export_form_submissions_csv(
  p_form_id uuid,
  p_user_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_agent_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  submission_id uuid,
  form_title text,
  agent_name text,
  agent_email text,
  cycle_number integer,
  submitted_at timestamptz,
  status text,
  submission_data jsonb,
  reviewed_by_name text,
  reviewed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Check permissions
  SELECT r.name INTO v_user_role
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.id = p_user_id;

  IF v_user_role NOT IN ('super_admin', 'client_admin', 'supervisor') THEN
    RAISE EXCEPTION 'Insufficient permissions for CSV export';
  END IF;

  RETURN QUERY
  SELECT
    fs.id as submission_id,
    f.title as form_title,
    c.full_name as agent_name,
    c.email as agent_email,
    fs.cycle_number,
    fs.submitted_at,
    fs.status,
    fs.submission_data,
    u.full_name as reviewed_by_name,
    fs.reviewed_at
  FROM form_submissions fs
  JOIN forms f ON f.id = fs.form_id
  JOIN customers c ON c.id = fs.agent_id
  LEFT JOIN users u ON u.id = fs.reviewed_by
  WHERE fs.form_id = p_form_id
    AND (p_start_date IS NULL OR fs.submitted_at >= p_start_date)
    AND (p_end_date IS NULL OR fs.submitted_at <= p_end_date)
    AND (p_agent_ids IS NULL OR fs.agent_id = ANY(p_agent_ids))
    AND (
      v_user_role IN ('super_admin', 'client_admin')
      OR can_access_agent_form(p_user_id, fs.agent_id, p_form_id)
    )
  ORDER BY fs.submitted_at DESC;
END;
$$;
```

---

## 8. API Endpoints Specification

### 8.1 Forms Management

```typescript
// POST /api/forms - Create new form
interface CreateFormRequest {
  title: string;
  description?: string;
  form_schema: FormSchema;
  department_id?: string;
  attach_to_customer: boolean;
  cycles_per_month: 1 | 2 | 3 | 4;
  enable_freeze: boolean;
  cycle_freeze_duration?: string; // e.g., "3 days", "12 hours"
}

// PUT /api/forms/:id - Update form
interface UpdateFormRequest {
  title?: string;
  description?: string;
  form_schema?: FormSchema;
  department_id?: string;
  attach_to_customer?: boolean;
  cycles_per_month?: 1 | 2 | 3 | 4;
  enable_freeze?: boolean;
  cycle_freeze_duration?: string;
  is_active?: boolean;
}

// GET /api/forms - List forms
interface ListFormsQuery {
  org_id?: string;
  department_id?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

// DELETE /api/forms/:id - Soft delete form
```

### 8.2 Form Attachments

```typescript
// POST /api/forms/:id/attachments - Attach form to customers
interface AttachFormRequest {
  customer_ids: string[];
  criteria: CriteriaRule[];
}

interface CriteriaRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: string;
}

// GET /api/forms/:id/attachments - List attachments
// DELETE /api/forms/:id/attachments/:customer_id - Remove attachment
```

### 8.3 Form Visibility & Submission

```typescript
// GET /api/forms/available/:agent_id - Get available forms for agent
interface AvailableFormsResponse {
  forms: Array<{
    form_id: string;
    title: string;
    description: string;
    visibility: VisibilityStatus;
    form_schema: FormSchema;
  }>;
}

interface VisibilityStatus {
  visible: boolean;
  reason: string;
  current_cycle?: number;
  max_cycles?: number;
  remaining_submissions?: number;
  freeze_expires_at?: string;
  remaining_seconds?: number;
}

// POST /api/forms/:id/submit - Submit form
interface SubmitFormRequest {
  agent_id: string;
  submission_data: Record<string, any>;
  latitude?: number;
  longitude?: number;
}

interface SubmitFormResponse {
  success: boolean;
  submission_id?: string;
  cycle_number?: number;
  frozen_until?: string;
  error?: string;
  details?: any;
}
```

### 8.4 Team Productivity View

```typescript
// GET /api/teams/my-team/forms - Get team's form submissions
interface MyTeamFormsQuery {
  form_id?: string;
  start_date?: string;
  end_date?: string;
  status?: 'submitted' | 'reviewed' | 'approved' | 'rejected';
}

interface MyTeamFormsResponse {
  team_members: Array<{
    agent_id: string;
    agent_name: string;
    forms: Array<{
      form_id: string;
      form_title: string;
      submissions_count: number;
      current_cycle: number;
      max_cycles: number;
      completion_rate: number;
      last_submission_at: string;
    }>;
  }>;
}
```

### 8.5 Export

```typescript
// GET /api/forms/:id/export/csv - Export to CSV
interface ExportCSVQuery {
  start_date?: string;
  end_date?: string;
  agent_ids?: string[];
  format?: 'csv' | 'xlsx';
}

// Response: File download
```

---

## 9. Row Level Security (RLS) Policies

### 9.1 Forms Table RLS

```sql
-- Enable RLS
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;

-- Admin can see all forms in their org
CREATE POLICY "Admins can view all forms in org"
ON forms FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM users
    WHERE org_id = forms.org_id
    AND role_id IN (
      SELECT id FROM roles
      WHERE name IN ('super_admin', 'client_admin')
    )
  )
);

-- Supervisors can see forms for their department
CREATE POLICY "Supervisors can view department forms"
ON forms FOR SELECT
TO authenticated
USING (
  department_id IN (
    SELECT department_id FROM customers
    WHERE id IN (
      SELECT subordinate_id FROM get_team_hierarchy(auth.uid())
    )
  )
);

-- Admin can create/update/delete
CREATE POLICY "Admins can manage forms"
ON forms FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM users
    WHERE org_id = forms.org_id
    AND role_id IN (
      SELECT id FROM roles
      WHERE name IN ('super_admin', 'client_admin')
    )
  )
);
```

### 9.2 Form Submissions RLS

```sql
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Users can see their own submissions
CREATE POLICY "Users can view own submissions"
ON form_submissions FOR SELECT
TO authenticated
USING (agent_id::text = auth.uid()::text);

-- Supervisors can see team submissions
CREATE POLICY "Supervisors can view team submissions"
ON form_submissions FOR SELECT
TO authenticated
USING (
  agent_id IN (
    SELECT subordinate_id FROM get_team_hierarchy(auth.uid())
  )
);

-- Admins can see all submissions in org
CREATE POLICY "Admins can view all org submissions"
ON form_submissions FOR SELECT
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms
    WHERE org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Users can submit forms
CREATE POLICY "Users can submit forms"
ON form_submissions FOR INSERT
TO authenticated
WITH CHECK (
  agent_id::text = auth.uid()::text OR
  auth.uid() IN (
    SELECT id FROM users
    WHERE role_id IN (
      SELECT id FROM roles
      WHERE name IN ('super_admin', 'client_admin', 'supervisor')
    )
  )
);
```

---

## 10. Frontend Implementation Guide

### 10.1 Form Builder Component Structure

```typescript
// Form Builder for Admins
interface FormBuilderProps {
  mode: 'create' | 'edit';
  formId?: string;
}

// Components:
// - FormBasicInfo (title, description)
// - FormSchemaBuilder (drag-drop field builder)
// - FormConfigFlags (attach_to_customer, cycles, freeze)
// - DepartmentSelector
// - CriteriaBuilder (if attach_to_customer = true)
```

### 10.2 Agent Form View Component

```typescript
// Form view for agents/customers
interface AgentFormViewProps {
  agentId: string;
}

// Features:
// - Real-time visibility check
// - Countdown timer for freeze period
// - Cycle progress indicator
// - Dynamic form rendering from schema
```

### 10.3 Supervisor Dashboard Component

```typescript
// Team productivity view
interface SupervisorDashboardProps {
  userId: string;
}

// Features:
// - Hierarchical team tree
// - Per-agent form completion status
// - Submission timeline
// - Filter by date range, form, status
// - CSV export button
```

---

## 11. Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- Database schema creation
- RLS policies setup
- Basic CRUD operations for forms
- User hierarchy functions

### Phase 2: Visibility Engine (Week 3-4)
- Form visibility evaluation function
- Criteria evaluation system
- Form attachment management
- Monthly log creation

### Phase 3: Submission System (Week 5-6)
- Form submission flow
- Freeze period management
- Cycle tracking
- Config change history

### Phase 4: Team Features (Week 7-8)
- Team hierarchy queries
- Supervisor dashboard APIs
- My Team view
- Access control checks

### Phase 5: Export & Analytics (Week 9-10)
- CSV export functionality
- Monthly reset automation
- Reporting endpoints
- Performance optimization

### Phase 6: Frontend (Week 11-14)
- Form builder UI
- Agent form view
- Supervisor dashboard
- Real-time updates

---

## 12. Performance Considerations

### Indexing Strategy
```sql
-- Critical indexes already in schema above
-- Additional composite indexes for common queries:

CREATE INDEX idx_submissions_log_agent_month
ON form_submissions_log(agent_id, tracking_month);

CREATE INDEX idx_submissions_form_agent_submitted
ON form_submissions(form_id, agent_id, submitted_at DESC);

CREATE INDEX idx_forms_org_active_dept
ON forms(org_id, is_active, department_id)
WHERE is_active = true;
```

### Caching Strategy
- Cache form schemas (rarely change)
- Cache team hierarchy (rebuild on org structure changes)
- Cache visibility results for 30 seconds per agent-form pair
- Use Redis for freeze expiration countdowns

### Query Optimization
- Use materialized views for team productivity summaries
- Partition form_submissions table by month
- Archive old submissions (>12 months) to cold storage

---

## 13. Security Considerations

### Data Protection
- Encrypt submission_data at rest
- Audit log all form configuration changes
- Rate limiting on submission endpoints
- CSRF protection on all state-changing operations

### Access Control
- Multi-level permission checks (RLS + application layer)
- Supervisor can only access subordinate data
- Agent can only submit for themselves (unless admin override)
- Time-based access restrictions enforced server-side

---

## 14. Monitoring & Alerts

### Key Metrics
- Form submission rate per agent
- Average time to complete forms
- Freeze period effectiveness
- Monthly reset success rate
- API response times for visibility checks

### Alerts
- Failed monthly reset
- Abnormal submission patterns
- Freeze period expiration issues
- High visibility check latency (>500ms)

---

## 15. Testing Strategy

### Unit Tests
- Visibility evaluation function
- Criteria matching logic
- Freeze period calculations
- Cycle increment logic

### Integration Tests
- End-to-end submission flow
- Team hierarchy access control
- Monthly reset process
- CSV export accuracy

### Load Tests
- 1000+ concurrent agents checking form visibility
- 100+ submissions per second
- Export of 100k+ submission records

---

This specification provides a complete technical blueprint for implementing the forms module with all required features including hierarchical access, time-based controls, and comprehensive tracking.
