-- ============================================================
-- LOOP COMMUNITIES — CONTENT MODERATION
-- The community management panel lets authorized moderators hide, restore,
-- remove, pin and lock discussions and replies. Hiding reuses the existing
-- `status` column ('hidden'); locking a discussion needs its own flag so the
-- thread stays visible while replies are closed.
--
-- Idempotent. Nothing here changes existing rows.
-- ============================================================

-- Discussions
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS comments_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Replies
ALTER TABLE circle_post_comments ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE circle_post_comments ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_circle_posts_hidden
  ON circle_posts (circle_id, hidden_at)
  WHERE hidden_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_circle_comments_hidden
  ON circle_post_comments (post_id, hidden_at)
  WHERE hidden_at IS NOT NULL;
