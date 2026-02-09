/*
  # Add Leads Module to System

  ## Overview
  This migration adds the leads management module to the modules table

  ## Changes
  - Inserts leads module entry
  - Module is initially inactive by default for all organizations
*/

INSERT INTO modules (name, display_name, description, icon, is_core)
VALUES (
  'leads',
  'Leads Management',
  'Track and manage sales leads with configurable forms, status workflows, and assignments',
  'target',
  false
)
ON CONFLICT (name) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon;
