/*
  # Remove idle timeout database functions

  1. Changes
    - Drop `check_session_idle_status` function (from migration 089)
    - Drop `get_org_idle_timeout` function (from migration 088)
    - Drop `update_org_settings` function (from migration 088)

  2. Purpose
    - Remove idle timeout system that was causing immediate logout after login
    - The idle timeout feature had clock skew issues between client and server
    - Session monitoring will continue to work for admin-initiated terminations
*/

DROP FUNCTION IF EXISTS check_session_idle_status(uuid);
DROP FUNCTION IF EXISTS get_org_idle_timeout(uuid);
DROP FUNCTION IF EXISTS update_org_settings(uuid, jsonb);
