-- Discord-style community comments need emoji reactions on replies.
--
-- The reaction map is stored on the comment itself as
--   { "<emoji>": ["<user_id>", …] }
-- the same shape the community room chat and Co-Loop Studio chat already use,
-- so one read renders every surface. One JSONB write per toggle is enough for
-- comment volume (no extra table, no extra round trip on thread load).
--
-- Idempotent: safe to run repeatedly.

ALTER TABLE public.circle_post_comments
  ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.circle_post_comments.reactions IS
  'Emoji reactions keyed by emoji, each holding the user ids that reacted.';
