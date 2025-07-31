-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  website TEXT,
  location TEXT,
  loop_coins INTEGER DEFAULT 1000,
  is_premium BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_level TEXT CHECK (verification_level IN ('root', 'influencer')),
  is_admin BOOLEAN DEFAULT FALSE,
  theme_data JSONB,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Create circles table (communities)
CREATE TABLE IF NOT EXISTS circles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  avatar_url TEXT,
  banner_url TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rules TEXT[],
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loops table (main content)
CREATE TABLE IF NOT EXISTS loops (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES loops(id) ON DELETE CASCADE,
  circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
  content JSONB NOT NULL,
  branch_depth INTEGER DEFAULT 0,
  is_reel BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loop_stats table
CREATE TABLE IF NOT EXISTS loop_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  loop_id UUID REFERENCES loops(id) ON DELETE CASCADE UNIQUE NOT NULL,
  likes INTEGER DEFAULT 0,
  branches INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create circle_members table
CREATE TABLE IF NOT EXISTS circle_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'banned')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

-- Create circle_rooms table (chat rooms within circles)
CREATE TABLE IF NOT EXISTS circle_rooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'voice', 'video')),
  is_private BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  loop_id UUID REFERENCES loops(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create likes table
CREATE TABLE IF NOT EXISTS likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, loop_id),
  UNIQUE(user_id, comment_id),
  CHECK ((loop_id IS NOT NULL AND comment_id IS NULL) OR (loop_id IS NULL AND comment_id IS NOT NULL))
);

-- Create saves table (bookmarks)
CREATE TABLE IF NOT EXISTS saves (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  loop_id UUID REFERENCES loops(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, loop_id)
);

-- Create follows table
CREATE TABLE IF NOT EXISTS follows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file', 'gift')),
  file_url TEXT,
  file_name TEXT,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversation_participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Create shop_items table
CREATE TABLE IF NOT EXISTS shop_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL CHECK (category IN ('theme', 'animation', 'effect', 'avatar_frame', 'badge', 'coins')),
  item_type TEXT NOT NULL,
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  premium_only BOOLEAN DEFAULT FALSE,
  preview_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_inventory table
CREATE TABLE IF NOT EXISTS user_inventory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES shop_items(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  purchase_price INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'coins' CHECK (payment_method IN ('coins', 'stripe')),
  UNIQUE(user_id, item_id)
);

-- Create coin_transactions table
CREATE TABLE IF NOT EXISTS coin_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'earned', 'spent', 'weekly_bonus', 'gift_received', 'gift_sent')),
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create circle_events table
CREATE TABLE IF NOT EXISTS circle_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  max_attendees INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create circle_event_attendees table
CREATE TABLE IF NOT EXISTS circle_event_attendees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES circle_events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'attending' CHECK (status IN ('attending', 'maybe', 'not_attending')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_loops_author_id ON loops(author_id);
CREATE INDEX IF NOT EXISTS idx_loops_parent_id ON loops(parent_id);
CREATE INDEX IF NOT EXISTS idx_loops_circle_id ON loops(circle_id);
CREATE INDEX IF NOT EXISTS idx_loops_created_at ON loops(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loops_is_reel ON loops(is_reel);

CREATE INDEX IF NOT EXISTS idx_comments_loop_id ON comments(loop_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id ON comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_loop_id ON likes(loop_id);
CREATE INDEX IF NOT EXISTS idx_likes_comment_id ON likes(comment_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

CREATE INDEX IF NOT EXISTS idx_circle_members_circle_id ON circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user_id ON circle_members(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_item_id ON user_inventory(item_id);

-- Create RPC functions for incrementing stats
CREATE OR REPLACE FUNCTION increment_loop_likes(loop_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO loop_stats (loop_id, likes, branches, comments, saves, views)
  VALUES (loop_id, 1, 0, 0, 0, 0)
  ON CONFLICT (loop_id)
  DO UPDATE SET likes = loop_stats.likes + 1, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_loop_branches(loop_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO loop_stats (loop_id, likes, branches, comments, saves, views)
  VALUES (loop_id, 0, 1, 0, 0, 0)
  ON CONFLICT (loop_id)
  DO UPDATE SET branches = loop_stats.branches + 1, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_loop_comments(loop_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO loop_stats (loop_id, likes, branches, comments, saves, views)
  VALUES (loop_id, 0, 0, 1, 0, 0)
  ON CONFLICT (loop_id)
  DO UPDATE SET comments = loop_stats.comments + 1, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_loop_saves(loop_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO loop_stats (loop_id, likes, branches, comments, saves, views)
  VALUES (loop_id, 0, 0, 0, 1, 0)
  ON CONFLICT (loop_id)
  DO UPDATE SET saves = loop_stats.saves + 1, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_loop_views(loop_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO loop_stats (loop_id, likes, branches, comments, saves, views)
  VALUES (loop_id, 0, 0, 0, 0, 1)
  ON CONFLICT (loop_id)
  DO UPDATE SET views = loop_stats.views + 1, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loops_updated_at BEFORE UPDATE ON loops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_circles_updated_at BEFORE UPDATE ON circles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Create RLS policies
-- Profiles are viewable by everyone, but users can only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Loops are viewable by everyone, users can create their own
CREATE POLICY "Loops are viewable by everyone" ON loops
  FOR SELECT USING (true);

CREATE POLICY "Users can create loops" ON loops
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own loops" ON loops
  FOR UPDATE USING (auth.uid() = author_id);

-- Comments are viewable by everyone, users can create their own
CREATE POLICY "Comments are viewable by everyone" ON comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Users can manage their own likes and saves
CREATE POLICY "Users can manage own likes" ON likes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own saves" ON saves
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own follows" ON follows
  FOR ALL USING (auth.uid() = follower_id);

-- Circle policies
CREATE POLICY "Public circles are viewable by everyone" ON circles
  FOR SELECT USING (NOT is_private OR EXISTS (
    SELECT 1 FROM circle_members 
    WHERE circle_id = circles.id AND user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Users can create circles" ON circles
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Circle members policies
CREATE POLICY "Circle members are viewable by circle members" ON circle_members
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM circle_members cm 
    WHERE cm.circle_id = circle_members.circle_id AND cm.user_id = auth.uid() AND cm.status = 'active'
  ));

-- Messages policies
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can send messages to their conversations" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND EXISTS (
      SELECT 1 FROM conversation_participants 
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );

-- Inventory policies
CREATE POLICY "Users can view own inventory" ON user_inventory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own inventory" ON user_inventory
  FOR UPDATE USING (auth.uid() = user_id);
