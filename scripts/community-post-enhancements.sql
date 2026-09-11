-- Community Post Enhancements: add view_count and improve post features

-- Add view_count column to circle_posts
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Add index for trending/popular sorting by view count
CREATE INDEX IF NOT EXISTS idx_circle_posts_view_count ON circle_posts(view_count DESC);
