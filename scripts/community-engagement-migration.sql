-- Community engagement migration:
--  1. Per-member welcome/interests prefs (post-join onboarding)
--  2. Post approval flow (moderation: status + moderation_note)

ALTER TABLE circle_members
  ADD COLUMN IF NOT EXISTS interests jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS followed_spaces jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS welcome_completed_at timestamptz;

ALTER TABLE circle_posts
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS moderation_note text;

CREATE INDEX IF NOT EXISTS idx_circle_posts_status ON circle_posts (circle_id, status);
CREATE INDEX IF NOT EXISTS idx_circle_members_welcome ON circle_members (circle_id, welcome_completed_at);
