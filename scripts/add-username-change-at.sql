-- Add username_change_at column to track when a user last changed their username
-- Users can only change their username once every 2 weeks.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username_change_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.username_change_at IS 'Timestamp of the last username change. Users may change at most once every 14 days.';
