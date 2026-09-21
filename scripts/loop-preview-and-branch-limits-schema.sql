-- Per-post link previews + owner-configurable branch limits.
--
-- 1. link_preview_disabled
--    A post that contains a URL renders a rich preview card under the body.
--    Sometimes the link is the point and the card is noise, so the author can
--    hide it — and hide it for *every* viewer, not just themselves. Because
--    other people's clients also read this flag, the choice has to live on the
--    row rather than in local component state.
--
-- 2. max_branch_depth / max_branches_per_user
--    The branch tree used to stop hard at 10 levels deep with no way for the
--    author to change it. The author now decides how deep their tree may grow
--    and how many branches a single account may add underneath it.
--    NULL (or 0) means "unlimited".
--
-- Idempotent — safe to run against a database that already has these columns.

ALTER TABLE loops ADD COLUMN IF NOT EXISTS link_preview_disabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS max_branch_depth INTEGER;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS max_branches_per_user INTEGER;

COMMENT ON COLUMN loops.link_preview_disabled IS
  'Author hid the rich link-preview card for this post. Applies to every viewer.';
COMMENT ON COLUMN loops.max_branch_depth IS
  'Maximum branch depth below this post. NULL or 0 = unlimited. Inherited from the root post of the tree.';
COMMENT ON COLUMN loops.max_branches_per_user IS
  'Maximum branches a single account may add under this post. NULL or 0 = unlimited. Inherited from the root post of the tree.';

-- Partial indexes keep the flag lookups cheap without indexing the whole table.
CREATE INDEX IF NOT EXISTS idx_loops_link_preview_disabled
  ON loops(link_preview_disabled) WHERE link_preview_disabled = true;
CREATE INDEX IF NOT EXISTS idx_loops_max_branch_depth
  ON loops(max_branch_depth) WHERE max_branch_depth IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loops_max_branches_per_user
  ON loops(max_branches_per_user) WHERE max_branches_per_user IS NOT NULL;
