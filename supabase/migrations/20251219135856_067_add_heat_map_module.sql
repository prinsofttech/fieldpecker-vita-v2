/*
  # Add Heat Map Module

  1. Changes
    - Add heat_map module to the modules table
    - This enables organizations to activate/deactivate the Heat Map feature
  
  2. Module Details
    - Name: heat_map
    - Display Name: Heat Map
    - Description: Interactive world map showing agent locations, last visits, and unresolved issues
    - Icon: map
    - Is Core: false (optional module that can be enabled/disabled)
*/

-- Insert heat_map module
INSERT INTO modules (name, display_name, description, icon, is_core) VALUES
('heat_map', 'Heat Map', 'Interactive world map showing agent locations, last visits, and unresolved issues', 'map', false)
ON CONFLICT (name) DO NOTHING;
