
-- Create loops table
CREATE TABLE IF NOT EXISTS loops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content_text TEXT,
  content_media_url TEXT,
  content_type TEXT DEFAULT 'text',
  category TEXT,
  sentiment TEXT,
  trending_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  parent_loop_id UUID REFERENCES loops(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loop stats table
CREATE TABLE IF NOT EXISTS loop_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loop_id UUID REFERENCES loops(id) ON DELETE CASCADE UNIQUE,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  branches_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create media uploads table
CREATE TABLE IF NOT EXISTS media_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  cloudinary_public_id TEXT NOT NULL,
  cloudinary_url TEXT NOT NULL,
  media_type TEXT NOT NULL,
  folder TEXT,
  width INTEGER,
  height INTEGER,
  duration NUMERIC,
  format TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE loop_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public loops are viewable by everyone" ON loops FOR SELECT USING (true);
CREATE POLICY "Users can insert their own loops" ON loops FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update their own loops" ON loops FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete their own loops" ON loops FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Loop stats are viewable by everyone" ON loop_stats FOR SELECT USING (true);
CREATE POLICY "Loop stats can be updated" ON loop_stats FOR ALL USING (true);

CREATE POLICY "Users can view their own media uploads" ON media_uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own media uploads" ON media_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own media uploads" ON media_uploads FOR DELETE USING (auth.uid() = user_id);

-- Create function to auto-create loop stats
CREATE OR REPLACE FUNCTION create_loop_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO loop_stats (loop_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_create_loop_stats
  AFTER INSERT ON loops
  FOR EACH ROW EXECUTE FUNCTION create_loop_stats();
