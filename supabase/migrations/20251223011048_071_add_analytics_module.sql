/*
  # Add Analytics Module

  1. Changes
    - Add analytics module to the modules table
    - This enables organizations to activate/deactivate the Analytics dashboard feature
  
  2. Module Details
    - Name: analytics
    - Display Name: Analytics
    - Description: Comprehensive analytics dashboard with trends, charts, and data visualization for all modules
    - Icon: trending-up
    - Is Core: false (optional module that can be enabled/disabled)
  
  3. Notes
    - Analytics module provides detailed insights into:
      - Daily metrics and trends
      - Module performance tracking
      - User activity analytics
      - Regional performance comparison
      - Summary statistics across all modules
    - Includes export capabilities to PDF and Excel with visual charts
*/

-- Insert analytics module
INSERT INTO modules (name, display_name, description, icon, is_core) VALUES
('analytics', 'Analytics', 'Comprehensive analytics dashboard with trends, charts, and data visualization for all modules', 'trending-up', false)
ON CONFLICT (name) DO NOTHING;