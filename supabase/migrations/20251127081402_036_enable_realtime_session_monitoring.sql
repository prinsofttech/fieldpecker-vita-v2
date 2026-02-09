/*
  # Enable Realtime for Session Monitoring

  1. Changes
    - Enable realtime replication for user_sessions table
    - This allows frontend to listen for session changes in real-time
    - When a session is terminated, the user will be logged out immediately

  2. Security
    - Realtime honors existing RLS policies
    - Users can only receive updates for their own sessions
*/

-- Enable realtime for user_sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE user_sessions;
