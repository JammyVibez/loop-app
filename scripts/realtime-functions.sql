
-- Database functions for real-time statistics and interactions

-- Function to increment loop likes
CREATE OR REPLACE FUNCTION increment_loop_likes(loop_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO loop_stats (loop_id, likes_count, comments_count, shares_count, views_count, branches_count)
  VALUES (loop_id, 1, 0, 0, 0, 0)
  ON CONFLICT (loop_id)
  DO UPDATE SET 
    likes_count = loop_stats.likes_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to decrement loop likes
CREATE OR REPLACE FUNCTION decrement_loop_likes(loop_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE loop_stats 
  SET 
    likes_count = GREATEST(0, likes_count - 1),
    updated_at = NOW()
  WHERE loop_stats.loop_id = decrement_loop_likes.loop_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment loop comments
CREATE OR REPLACE FUNCTION increment_loop_comments(loop_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO loop_stats (loop_id, likes_count, comments_count, shares_count, views_count, branches_count)
  VALUES (loop_id, 0, 1, 0, 0, 0)
  ON CONFLICT (loop_id)
  DO UPDATE SET 
    comments_count = loop_stats.comments_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to increment loop shares
CREATE OR REPLACE FUNCTION increment_loop_shares(loop_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO loop_stats (loop_id, likes_count, comments_count, shares_count, views_count, branches_count)
  VALUES (loop_id, 0, 0, 1, 0, 0)
  ON CONFLICT (loop_id)
  DO UPDATE SET 
    shares_count = loop_stats.shares_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to increment loop views
CREATE OR REPLACE FUNCTION increment_loop_views(loop_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO loop_stats (loop_id, likes_count, comments_count, shares_count, views_count, branches_count)
  VALUES (loop_id, 0, 0, 0, 1, 0)
  ON CONFLICT (loop_id)
  DO UPDATE SET 
    views_count = loop_stats.views_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to increment loop branches
CREATE OR REPLACE FUNCTION increment_loop_branches(loop_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO loop_stats (loop_id, likes_count, comments_count, shares_count, views_count, branches_count)
  VALUES (loop_id, 0, 0, 0, 0, 1)
  ON CONFLICT (loop_id)
  DO UPDATE SET 
    branches_count = loop_stats.branches_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update trending scores
CREATE OR REPLACE FUNCTION update_trending_scores()
RETURNS void AS $$
BEGIN
  UPDATE loops 
  SET trending_score = COALESCE(
    (
      SELECT 
        (COALESCE(ls.likes_count, 0) * 1.0 + 
         COALESCE(ls.comments_count, 0) * 2.0 + 
         COALESCE(ls.shares_count, 0) * 3.0 + 
         COALESCE(ls.views_count, 0) * 0.1 + 
         COALESCE(ls.branches_count, 0) * 5.0) * 
        EXP(-EXTRACT(EPOCH FROM (NOW() - loops.created_at)) / 3600.0 / 24.0)
      FROM loop_stats ls 
      WHERE ls.loop_id = loops.id
    ), 0
  ),
  updated_at = NOW()
  WHERE loops.created_at > NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to get trending loops
CREATE OR REPLACE FUNCTION get_trending_loops(
  time_period TEXT DEFAULT '24h',
  trend_limit INTEGER DEFAULT 20,
  trend_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  content_text TEXT,
  content_media_url TEXT,
  content_type TEXT,
  category TEXT,
  hashtags TEXT[],
  created_at TIMESTAMPTZ,
  trending_score REAL,
  author JSON,
  loop_stats JSON
) AS $$
DECLARE
  time_filter TIMESTAMPTZ;
BEGIN
  -- Set time filter based on period
  CASE time_period
    WHEN '1h' THEN time_filter := NOW() - INTERVAL '1 hour';
    WHEN '24h' THEN time_filter := NOW() - INTERVAL '24 hours';
    WHEN '7d' THEN time_filter := NOW() - INTERVAL '7 days';
    WHEN '30d' THEN time_filter := NOW() - INTERVAL '30 days';
    ELSE time_filter := NOW() - INTERVAL '24 hours';
  END CASE;

  RETURN QUERY
  SELECT 
    l.id,
    l.content_text,
    l.content_media_url,
    l.content_type,
    l.category,
    l.hashtags,
    l.created_at,
    l.trending_score,
    ROW_TO_JSON(p.*) as author,
    ROW_TO_JSON(ls.*) as loop_stats
  FROM loops l
  LEFT JOIN profiles p ON l.author_id = p.id
  LEFT JOIN loop_stats ls ON l.id = ls.loop_id
  WHERE l.created_at >= time_filter
    AND l.is_public = true
    AND l.parent_loop_id IS NULL
  ORDER BY l.trending_score DESC
  LIMIT trend_limit
  OFFSET trend_offset;
END;
$$ LANGUAGE plpgsql;

-- Add media uploads table
CREATE TABLE IF NOT EXISTS media_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  cloudinary_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'audio', 'document')) DEFAULT 'image',
  folder TEXT DEFAULT 'general',
  width INTEGER,
  height INTEGER,
  duration REAL,
  format TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add search analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  search_type TEXT DEFAULT 'all',
  filters JSONB DEFAULT '{}',
  results_count INTEGER DEFAULT 0,
  search_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add hashtags table
CREATE TABLE IF NOT EXISTS hashtags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tag TEXT UNIQUE NOT NULL,
  usage_count INTEGER DEFAULT 1,
  trending_score REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_uploads_user_id ON media_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_media_uploads_media_type ON media_uploads(media_type);
CREATE INDEX IF NOT EXISTS idx_search_analytics_user_id ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query);
CREATE INDEX IF NOT EXISTS idx_hashtags_tag ON hashtags(tag);
CREATE INDEX IF NOT EXISTS idx_hashtags_usage_count ON hashtags(usage_count DESC);

-- Enable RLS
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own media uploads" ON media_uploads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own media uploads" ON media_uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media uploads" ON media_uploads
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own search analytics" ON search_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search analytics" ON search_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Everyone can view hashtags" ON hashtags
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can update hashtags" ON hashtags
  FOR ALL USING (auth.role() = 'authenticated');
