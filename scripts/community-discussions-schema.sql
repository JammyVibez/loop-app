-- ============================================================
-- LOOP COMMUNITIES — DISCUSSION-FIRST HOME
-- The community home is now a list of persistent discussions. This migration
-- adds only what that needs, on top of the tables the engine already uses:
--
--   * circle_posts.post_type        discussion | coloop | duel | poll | …
--   * circle_posts.content_metadata extra context (co-loop session, duel id)
--   * circle_posts.last_activity_at reply activity, so "Most active" is real
--   * circle_posts.feed_loop_id     set once a discussion is deliberately
--                                   shared to the Loop feed
--   * circle_coloop_sessions.discussion_post_id  the discussion a room belongs to
--
-- Everything is idempotent. Community content defaults to community-only:
-- nothing here ever writes to the global feed by itself.
-- ============================================================

-- ------------------------------------------------------------
-- 1. circle_posts — discussion shape + feed link
-- ------------------------------------------------------------
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'discussion';
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS content_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
-- The Loop a community post was explicitly shared as, stored as text so it
-- does not depend on the id type of loops/circle_posts in this database.
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS feed_loop_id TEXT;

-- Existing rows predate post_type: a post with a poll is a poll, a post that
-- came from a legacy announcement room stays a discussion.
UPDATE circle_posts SET post_type = 'discussion' WHERE post_type IS NULL OR post_type = '';
UPDATE circle_posts SET last_activity_at = COALESCE(last_activity_at, updated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_circle_posts_discussions
  ON circle_posts (circle_id, is_pinned DESC, last_activity_at DESC);

-- ------------------------------------------------------------
-- 2. Co-Loop rooms remember the discussion they belong to
-- ------------------------------------------------------------
ALTER TABLE circle_coloop_sessions ADD COLUMN IF NOT EXISTS discussion_post_id TEXT;
ALTER TABLE circle_coloop_sessions ADD COLUMN IF NOT EXISTS published_loop_id TEXT;

-- ------------------------------------------------------------
-- 3. Duels launched from a community link back to their discussion
-- ------------------------------------------------------------
ALTER TABLE loop_duels ADD COLUMN IF NOT EXISTS circle_post_id TEXT;

-- ------------------------------------------------------------
-- 4. Reply activity keeps the discussion list honest
--    A comment on a post stamps the post, so "Most active" is computed from
--    real replies rather than a column nobody updates.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION bump_discussion_activity() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    UPDATE circle_posts
       SET last_activity_at = NOW()
     WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bump_discussion_activity ON circle_post_comments;
CREATE TRIGGER trg_bump_discussion_activity
  AFTER INSERT ON circle_post_comments
  FOR EACH ROW EXECUTE FUNCTION bump_discussion_activity();
