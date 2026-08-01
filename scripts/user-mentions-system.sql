-- User tagging / mentions ledger + optional mentions columns
CREATE TABLE IF NOT EXISTS user_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_id UUID,
  loop_id UUID,
  comment_id UUID,
  circle_id UUID,
  post_id UUID,
  reel_id UUID,
  snippet TEXT,
  href TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_mentions_mentioned_created
  ON user_mentions (mentioned_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_mentions_actor
  ON user_mentions (actor_id, created_at DESC);

ALTER TABLE loops ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}';
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}';

-- Ensure notifications.type can store mention (best-effort)
DO $$
BEGIN
  -- no-op if already an enum value or free text
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'mention';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
