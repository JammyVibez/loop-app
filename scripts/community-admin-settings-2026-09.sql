-- ============================================================
-- Community admin + settings fixes (September 2026)
-- 1. circle_members.is_muted / muted_until — the mute moderation
--    action wrote to columns that didn't exist, so muting silently
--    failed everywhere (chat, admin panel).
-- 2. Performance index for chat queries by room + time.
-- ============================================================

ALTER TABLE circle_members
  ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false;

ALTER TABLE circle_members
  ADD COLUMN IF NOT EXISTS muted_until timestamptz;

-- Chat: messages are always listed per room in chronological order
CREATE INDEX IF NOT EXISTS idx_circle_room_messages_room_created
  ON circle_room_messages (room_id, created_at DESC);

-- ============================================================
-- Done. Verification queries:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='circle_members' AND column_name LIKE '%muted%';
-- ============================================================
