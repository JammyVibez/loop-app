-- Function to get trending hashtags
CREATE OR REPLACE FUNCTION get_trending_hashtags(days_back INTEGER DEFAULT 7, result_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  hashtag TEXT,
  usage_count BIGINT,
  recent_usage_count BIGINT,
  trending_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hu.hashtag,
    COUNT(*) as usage_count,
    COUNT(CASE WHEN hu.created_at >= NOW() - INTERVAL '1 day' * days_back THEN 1 END) as recent_usage_count,
    -- Trending score: recent usage weighted by total usage
    (COUNT(CASE WHEN hu.created_at >= NOW() - INTERVAL '1 day' * days_back THEN 1 END)::NUMERIC * 2 + 
     COUNT(*)::NUMERIC * 0.5) as trending_score
  FROM hashtag_usage hu
  WHERE hu.created_at >= NOW() - INTERVAL '1 day' * days_back * 2
  GROUP BY hu.hashtag
  HAVING COUNT(CASE WHEN hu.created_at >= NOW() - INTERVAL '1 day' * days_back THEN 1 END) > 0
  ORDER BY trending_score DESC, recent_usage_count DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Create hashtag_usage table if it doesn't exist
CREATE TABLE IF NOT EXISTS hashtag_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hashtag TEXT NOT NULL,
  loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hashtag_usage_hashtag ON hashtag_usage(hashtag);
CREATE INDEX IF NOT EXISTS idx_hashtag_usage_created_at ON hashtag_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_hashtag_usage_loop_id ON hashtag_usage(loop_id);
CREATE INDEX IF NOT EXISTS idx_hashtag_usage_user_id ON hashtag_usage(user_id);

-- RLS policies for hashtag_usage
ALTER TABLE hashtag_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all hashtag usage" ON hashtag_usage
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own hashtag usage" ON hashtag_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hashtag usage" ON hashtag_usage
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hashtag usage" ON hashtag_usage
  FOR DELETE USING (auth.uid() = user_id);

-- Create a view for trending hashtags (alternative to function)
CREATE OR REPLACE VIEW trending_hashtags AS
SELECT 
  hashtag,
  COUNT(*) as total_usage,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_usage,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 END) as daily_usage,
  (COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::NUMERIC * 2 + 
   COUNT(*)::NUMERIC * 0.5) as trending_score
FROM hashtag_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY hashtag
HAVING COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) > 0
ORDER BY trending_score DESC, recent_usage DESC;

-- Grant permissions
GRANT SELECT ON trending_hashtags TO authenticated;
GRANT EXECUTE ON FUNCTION get_trending_hashtags(INTEGER, INTEGER) TO authenticated;
