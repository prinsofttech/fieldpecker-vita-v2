/*
  # Add 'terminated' to active_type enum

  1. Changes
    - Adds 'terminated' as a new value to the active_type enum used by the customers table
    - This allows customers to be marked as terminated in addition to:
      - active
      - inactive
      - suspended
      - on_leave

  2. Notes
    - Uses ALTER TYPE to add the new enum value
    - This is a safe, non-breaking change that extends the existing enum
*/

-- Add 'terminated' to the active_type enum
ALTER TYPE active_type ADD VALUE IF NOT EXISTS 'terminated';
