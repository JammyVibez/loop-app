-- Community fixes — 2026-09-13
-- 1) Chat: media-only messages failed with
--    'null value in column "content" of relation "circle_room_messages"
--    violates not-null constraint' — image/video sends without a caption
--    insert content = NULL. Drop the NOT NULL so media-only messages work.
ALTER TABLE circle_room_messages ALTER COLUMN content DROP NOT NULL;

-- 2) Post reactions: the card UI offered fire/clap/etc. but the API had no
--    storage for them (action "react" was not implemented server-side).
--    Dedicated table, one row per (post, user, reaction type).
CREATE TABLE IF NOT EXISTS circle_post_reactions (
  id bigserial PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_circle_post_reactions_post
  ON circle_post_reactions(post_id);

CREATE INDEX IF NOT EXISTS idx_circle_post_reactions_user
  ON circle_post_reactions(user_id);

-- 3) Bookmarks tab: speed up the save lookup path.
CREATE INDEX IF NOT EXISTS idx_circle_post_interactions_user_type
  ON circle_post_interactions(user_id, interaction_type);
