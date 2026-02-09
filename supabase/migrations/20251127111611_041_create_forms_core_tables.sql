/*
  # Forms Module - Core Tables

  ## Overview
  This migration creates the foundational tables for the dynamic forms management system
  with hierarchical access controls and time-based visibility rules.

  ## New Tables

  ### 1. `forms`
  - Core form definitions with configuration flags
  - Fields:
    - `id` (uuid, PK): Unique identifier
    - `org_id` (uuid, FK): Organization reference
    - `internal_form_id` (text): Human-readable form ID (e.g., "FORM-2024-001")
    - `title` (text): Form title
    - `description` (text): Optional description
    - `form_schema` (jsonb): Dynamic form fields definition
    - `department_id` (uuid, FK): Assignment to department
    - `created_by` (uuid, FK): Creator user
    - `attach_to_customer` (boolean): Whether form requires customer attachment
    - `cycles_per_month` (integer): Number of allowed submissions per month (1-4)
    - `enable_freeze` (boolean): Whether to enable freeze period after submission
    - `cycle_freeze_duration` (interval): Duration of freeze period
    - `is_active` (boolean): Form status
    - Timestamps: created_at, updated_at

  ### 2. `form_customer_attachments`
  - Links forms to specific customers (agents) with criteria
  - Fields:
    - `id` (uuid, PK)
    - `form_id` (uuid, FK): Reference to form
    - `customer_id` (uuid, FK): Reference to customer/agent
    - `criteria` (jsonb): Dynamic criteria rules for visibility
    - `is_active` (boolean): Attachment status
    - `attached_at` (timestamptz)
    - `attached_by` (uuid, FK): Who created the attachment
  - Unique constraint: one attachment per form-customer pair

  ### 3. `form_submissions_log`
  - Monthly tracking of form submissions per agent
  - Resets each month automatically
  - Fields:
    - `id` (uuid, PK)
    - `form_id` (uuid, FK)
    - `agent_id` (uuid, FK): Customer/agent reference
    - `tracking_month` (date): First day of tracking month
    - `current_cycle` (integer): Current submission cycle
    - `max_cycles_allowed` (integer): Maximum cycles for this month
    - `submissions_count` (integer): Total submissions this month
    - `is_frozen` (boolean): Whether currently in freeze period
    - `freeze_expires_at` (timestamptz): When freeze period ends
    - `last_submission_at` (timestamptz): Last submission timestamp
    - `config_snapshot` (jsonb): Form configuration at log creation
  - Unique constraint: one log per form-agent-month combination

  ### 4. `form_submissions`
  - Actual form submission data
  - Fields:
    - `id` (uuid, PK)
    - `form_id` (uuid, FK)
    - `agent_id` (uuid, FK)
    - `log_id` (uuid, FK): Reference to tracking log
    - `submission_data` (jsonb): Actual form field values
    - `cycle_number` (integer): Which cycle this submission belongs to
    - `submitted_by` (uuid, FK): Who submitted (if on behalf)
    - `latitude`, `longitude` (decimal): Optional geolocation
    - `status` (text): submitted, reviewed, approved, rejected
    - `reviewed_by` (uuid, FK)
    - `reviewed_at` (timestamptz)
    - `review_notes` (text)
    - Timestamps: submitted_at, updated_at

  ### 5. `form_config_history`
  - Tracks changes to form configuration throughout the month
  - Fields:
    - `id` (uuid, PK)
    - `form_id` (uuid, FK)
    - `changed_by` (uuid, FK)
    - `changed_at` (timestamptz)
    - `field_name` (text): Which field changed
    - `old_value`, `new_value` (text): Change tracking
    - `effective_month` (date): Which month this affects

  ## Security
  - RLS enabled on all tables
  - Policies will be added in subsequent migration
  - All tables have proper foreign key constraints
  - Cascade deletes configured appropriately

  ## Indexes
  - Optimized for common query patterns:
    - Organization and department lookups
    - Active forms filtering
    - Monthly log queries
    - Submission timeline queries
*/

-- 1. FORMS TABLE
CREATE TABLE IF NOT EXISTS forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  internal_form_id text UNIQUE NOT NULL,

  -- Basic Information
  title text NOT NULL,
  description text,
  form_schema jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Assignment
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Configuration Flags
  attach_to_customer boolean DEFAULT false,
  cycles_per_month integer DEFAULT 1 CHECK (cycles_per_month IN (1, 2, 3, 4)),
  enable_freeze boolean DEFAULT false,
  cycle_freeze_duration interval,

  -- Status
  is_active boolean DEFAULT true,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Validation
  CONSTRAINT valid_freeze_config CHECK (
    (enable_freeze = false) OR
    (enable_freeze = true AND cycle_freeze_duration IS NOT NULL)
  )
);

-- Indexes for forms
CREATE INDEX IF NOT EXISTS idx_forms_org_id ON forms(org_id);
CREATE INDEX IF NOT EXISTS idx_forms_department_id ON forms(department_id);
CREATE INDEX IF NOT EXISTS idx_forms_active ON forms(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_forms_org_active_dept ON forms(org_id, is_active, department_id) WHERE is_active = true;

-- 2. FORM_CUSTOMER_ATTACHMENTS TABLE
CREATE TABLE IF NOT EXISTS form_customer_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Composite Relationship
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Criteria for visibility
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Status
  is_active boolean DEFAULT true,

  -- Timestamps
  attached_at timestamptz DEFAULT now(),
  attached_by uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Unique constraint: one attachment per form-customer pair
  UNIQUE(form_id, customer_id)
);

-- Indexes for attachments
CREATE INDEX IF NOT EXISTS idx_form_customer_form_id ON form_customer_attachments(form_id);
CREATE INDEX IF NOT EXISTS idx_form_customer_customer_id ON form_customer_attachments(customer_id);
CREATE INDEX IF NOT EXISTS idx_form_customer_active ON form_customer_attachments(is_active) WHERE is_active = true;

-- 3. FORM_SUBMISSIONS_LOG TABLE
CREATE TABLE IF NOT EXISTS form_submissions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Composite Key Components
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Tracking Period
  tracking_month date NOT NULL,

  -- Submission Tracking
  current_cycle integer DEFAULT 0,
  max_cycles_allowed integer NOT NULL,
  submissions_count integer DEFAULT 0,

  -- Freeze Management
  is_frozen boolean DEFAULT false,
  freeze_expires_at timestamptz,
  last_submission_at timestamptz,

  -- Form Configuration Snapshot
  config_snapshot jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Composite unique constraint
  UNIQUE(form_id, agent_id, tracking_month)
);

-- Indexes for submissions log
CREATE INDEX IF NOT EXISTS idx_submissions_log_form_agent ON form_submissions_log(form_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_submissions_log_month ON form_submissions_log(tracking_month);
CREATE INDEX IF NOT EXISTS idx_submissions_log_frozen ON form_submissions_log(is_frozen) WHERE is_frozen = true;
CREATE INDEX IF NOT EXISTS idx_submissions_log_agent_month ON form_submissions_log(agent_id, tracking_month);

-- 4. FORM_SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  log_id uuid REFERENCES form_submissions_log(id) ON DELETE SET NULL,

  -- Submission Data
  submission_data jsonb NOT NULL,

  -- Metadata
  cycle_number integer NOT NULL,
  submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Geolocation (optional)
  latitude decimal(10, 8),
  longitude decimal(11, 8),

  -- Status
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,

  -- Timestamps
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for submissions
CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_agent_id ON form_submissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_submissions_log_id ON form_submissions(log_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON form_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_form_agent_submitted ON form_submissions(form_id, agent_id, submitted_at DESC);

-- 5. FORM_CONFIG_HISTORY TABLE
CREATE TABLE IF NOT EXISTS form_config_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,

  -- Change Tracking
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now(),

  -- What Changed
  field_name text NOT NULL,
  old_value text,
  new_value text,

  -- Month Context
  effective_month date NOT NULL
);

-- Indexes for config history
CREATE INDEX IF NOT EXISTS idx_config_history_form_id ON form_config_history(form_id);
CREATE INDEX IF NOT EXISTS idx_config_history_month ON form_config_history(effective_month);

-- 6. SYSTEM_EVENTS TABLE (for monthly reset tracking)
CREATE TABLE IF NOT EXISTS system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at);

-- Enable RLS (policies will be added in next migration)
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_customer_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_config_history ENABLE ROW LEVEL SECURITY;
