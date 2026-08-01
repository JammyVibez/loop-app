
-- Create interests table
CREATE TABLE IF NOT EXISTS interests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profile themes table
CREATE TABLE IF NOT EXISTS profile_themes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  animation TEXT DEFAULT 'pulse-glow',
  preview_class TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  price_coins INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add interests column to profiles if not exists
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';

-- Insert default interests
INSERT INTO interests (name, category) VALUES
('Art & Design', 'creative'),
('Technology', 'tech'),
('Writing', 'creative'),
('Music', 'creative'),
('Photography', 'creative'),
('Gaming', 'entertainment'),
('Science', 'education'),
('Business', 'professional'),
('Education', 'education'),
('Health', 'lifestyle'),
('Travel', 'lifestyle'),
('Food', 'lifestyle'),
('Fashion', 'lifestyle'),
('Sports', 'lifestyle'),
('Movies', 'entertainment'),
('Books', 'education'),
('Nature', 'lifestyle'),
('DIY', 'creative')
ON CONFLICT (name) DO NOTHING;

-- Insert default themes
INSERT INTO profile_themes (name, primary_color, secondary_color, preview_class) VALUES
('Purple Dream', '#8B5CF6', '#06B6D4', 'bg-gradient-to-r from-purple-500 to-blue-500'),
('Ocean Breeze', '#0EA5E9', '#10B981', 'bg-gradient-to-r from-blue-500 to-emerald-500'),
('Sunset Glow', '#F59E0B', '#EF4444', 'bg-gradient-to-r from-amber-500 to-red-500'),
('Forest Green', '#10B981', '#059669', 'bg-gradient-to-r from-emerald-500 to-green-600'),
('Rose Gold', '#EC4899', '#F97316', 'bg-gradient-to-r from-pink-500 to-orange-500'),
('Midnight', '#6366F1', '#8B5CF6', 'bg-gradient-to-r from-indigo-500 to-purple-500')
ON CONFLICT DO NOTHING;
