/*
  # Update Modules List

  1. Changes
    - Remove name check constraint to allow new modules
    - Update supervision module to Forms
    - Remove Performance & KPIs module
    - Add new modules: My Team, Customers, CRM (Leads), Reports, Expenses, Last Mile Delivery, HR Records, Leave Management, Timesheets

  2. New Modules
    - My Team: Team management, assignments, performance tracking
    - Customers: Customer database and relationship management
    - Issue Tracker: (existing) Issue logging, assignment workflows, escalations
    - CRM (Leads): Lead capture, follow-ups, conversion tracking
    - Forms: Custom forms, field data collection, compliance checks
    - Reports: Analytics, dashboards, performance reports
    - Expenses: Expense tracking, approvals, reimbursements
    - Last Mile Delivery: Delivery tracking, route optimization, POD
    - HR Records: Employee records, documents, personnel management
    - Leave Management: Leave requests, approvals, balance tracking
    - Timesheets: Time tracking, attendance, work hours logging
*/

-- Drop the check constraint that limits module names
ALTER TABLE modules DROP CONSTRAINT IF EXISTS modules_name_check;

-- Update supervision to Forms
UPDATE modules
SET 
  name = 'forms',
  display_name = 'Forms',
  description = 'Custom forms, field data collection, compliance checks',
  icon = 'file-text'
WHERE name = 'supervision';

-- Update Leads & Sales to CRM (Leads)
UPDATE modules
SET 
  display_name = 'CRM (Leads)',
  icon = 'trending-up'
WHERE name = 'leads_sales';

-- Delete Performance & KPIs module
DELETE FROM modules WHERE name = 'performance_kpi';

-- Insert new modules
INSERT INTO modules (name, display_name, description, icon, is_core) VALUES
('my_team', 'My Team', 'Team management, assignments, performance tracking', 'users', false),
('customers', 'Customers', 'Customer database and relationship management', 'user-check', false),
('reports', 'Reports', 'Analytics, dashboards, performance reports', 'bar-chart', false),
('expenses', 'Expenses', 'Expense tracking, approvals, reimbursements', 'credit-card', false),
('last_mile_delivery', 'Last Mile Delivery', 'Delivery tracking, route optimization, POD', 'truck', false),
('hr_records', 'HR Records', 'Employee records, documents, personnel management', 'folder', false),
('leave_management', 'Leave Management', 'Leave requests, approvals, balance tracking', 'calendar', false),
('timesheets', 'Timesheets', 'Time tracking, attendance, work hours logging', 'clock', false)
ON CONFLICT (name) DO NOTHING;
