-- Explore Reels grid: composite indexes for the explore sourcing queries.
--
-- The /api/reels?category=explore endpoint runs two hot-path queries:
--   1. Hot pool:  WHERE visibility='public' AND created_at >= now()-14d
--                 ORDER BY view_count DESC, like_count DESC
--   2. Fresh pool: WHERE visibility='public' ORDER BY created_at DESC
--
-- The single-column indexes (idx_reels_visibility / idx_reels_view_count /
-- idx_reels_created_at) already exist; these composites let Postgres serve
-- each query from one index scan instead of bitmap-intersecting three.

CREATE INDEX IF NOT EXISTS idx_reels_explore_hot
  ON reels (view_count DESC, like_count DESC)
  WHERE visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_reels_explore_fresh
  ON reels (created_at DESC)
  WHERE visibility = 'public';
