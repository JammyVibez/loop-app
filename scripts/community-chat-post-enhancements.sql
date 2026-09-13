-- Community chat + post enhancements:
--   1. message_type on circle_room_messages (text / image / gif / file) so the
--      UI can render shared media correctly.
--   2. reactions JSONB already stores { emoji: [user_ids] } — re-asserted as a
--      safety net for environments where it was dropped.
--   3. gifted_at / gift_count on circle_posts: tracks gifts received from the
--      community so cards can show a gift badge.
--   4. Composite index for chat room queries.

ALTER TABLE circle_room_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- Backfill: existing rows with media are images unless marked otherwise.
UPDATE circle_room_messages
SET message_type = 'image'
WHERE media_url IS NOT NULL AND (message_type IS NULL OR message_type = 'text');

-- The reactions column stores { "<emoji>": ["<user_id>", ...] }. If it was
-- dropped in an environment, recreate it.
ALTER TABLE circle_room_messages
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- Gifts received on community posts
ALTER TABLE circle_posts
  ADD COLUMN IF NOT EXISTS gift_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_circle_posts_gifts ON circle_posts (gift_count DESC)
  WHERE gift_count > 0;

-- Chat room fetches filter by room + order by time
CREATE INDEX IF NOT EXISTS idx_circle_room_messages_room_time
  ON circle_room_messages (room_id, created_at);
