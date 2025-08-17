-- Complete Database Schema for Loop Social Platform
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE content_type AS ENUM ('text', 'image', 'video', 'audio', 'file');
CREATE TYPE visibility_type AS ENUM ('public', 'private', 'circle');
CREATE TYPE interaction_type AS ENUM ('like', 'save', 'view', 'share');
CREATE TYPE notification_type AS ENUM ('like', 'comment', 'follow', 'branch', 'mention', 'system');
CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'system');
CREATE TYPE member_role AS ENUM ('member', 'moderator', 'admin');
CREATE TYPE shop_category AS ENUM ('theme', 'animation', 'effect', 'premium');

-- Users/Profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,
    banner_url TEXT,
    bio TEXT,
    loop_coins INTEGER DEFAULT 500,
    is_premium BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    theme_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loops (main content) table
CREATE TABLE loops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    parent_loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
    content_type content_type NOT NULL DEFAULT 'text',
    content_text TEXT,
    content_media_url TEXT,
    content_metadata JSONB,
    content_title TEXT,
    content JSONB,
    visibility visibility_type DEFAULT 'public',
    circle_id UUID,
    tree_depth INTEGER DEFAULT 0,
    hashtags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loop statistics table
CREATE TABLE loop_stats (
    loop_id UUID PRIMARY KEY REFERENCES loops(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    branches_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loop interactions table
CREATE TABLE loop_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    loop_id UUID NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
    interaction_type interaction_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, loop_id, interaction_type)
);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loop_id UUID NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Follows table
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Circles (communities) table
CREATE TABLE circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    member_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circle members table
CREATE TABLE circle_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role member_role DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(circle_id, user_id)
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type message_type DEFAULT 'text',
    file_url TEXT,
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (
        (recipient_id IS NOT NULL AND circle_id IS NULL) OR 
        (recipient_id IS NULL AND circle_id IS NOT NULL)
    )
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shop items table
CREATE TABLE shop_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    price INTEGER DEFAULT 0,
    price_coins INTEGER,
    price_usd DECIMAL(10,2),
    category shop_category NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common',
    premium_only BOOLEAN DEFAULT FALSE,
    item_data JSONB NOT NULL,
    preview_data JSONB,
    metadata JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (price_coins IS NOT NULL OR price_usd IS NOT NULL OR price IS NOT NULL)
);

-- User inventory table
CREATE TABLE user_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT FALSE,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    purchase_price INTEGER,
    payment_method VARCHAR(20),
    UNIQUE(user_id, item_id)
);

-- Create indexes for better performance
CREATE INDEX idx_loops_author_id ON loops(author_id);
CREATE INDEX idx_loops_parent_loop_id ON loops(parent_loop_id);
CREATE INDEX idx_loops_created_at ON loops(created_at DESC);
CREATE INDEX idx_loops_visibility ON loops(visibility);
CREATE INDEX idx_loops_hashtags ON loops USING GIN(hashtags);

CREATE INDEX idx_loop_interactions_user_id ON loop_interactions(user_id);
CREATE INDEX idx_loop_interactions_loop_id ON loop_interactions(loop_id);
CREATE INDEX idx_loop_interactions_type ON loop_interactions(interaction_type);

CREATE INDEX idx_comments_loop_id ON comments(loop_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);
CREATE INDEX idx_comments_parent_comment_id ON comments(parent_comment_id);

CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);

CREATE INDEX idx_circle_members_circle_id ON circle_members(circle_id);
CREATE INDEX idx_circle_members_user_id ON circle_members(user_id);

CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_messages_circle_id ON messages(circle_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loops_updated_at BEFORE UPDATE ON loops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loop_stats_updated_at BEFORE UPDATE ON loop_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_circles_updated_at BEFORE UPDATE ON circles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_items_updated_at BEFORE UPDATE ON shop_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS (Row Level Security) policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE loop_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE loop_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Loops policies
CREATE POLICY "Public loops are viewable by everyone" ON loops
    FOR SELECT USING (visibility = 'public');

CREATE POLICY "Users can view their own loops" ON loops
    FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Users can create loops" ON loops
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own loops" ON loops
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own loops" ON loops
    FOR DELETE USING (auth.uid() = author_id);

-- Loop interactions policies
CREATE POLICY "Users can view all interactions" ON loop_interactions
    FOR SELECT USING (true);

CREATE POLICY "Users can create their own interactions" ON loop_interactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions" ON loop_interactions
    FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" ON comments
    FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON comments
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own comments" ON comments
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own comments" ON comments
    FOR DELETE USING (auth.uid() = author_id);

-- Follows policies
CREATE POLICY "Follows are viewable by everyone" ON follows
    FOR SELECT USING (true);

CREATE POLICY "Users can create follows" ON follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete own follows" ON follows
    FOR DELETE USING (auth.uid() = follower_id);

-- Messages policies
CREATE POLICY "Users can view their own messages" ON messages
    FOR SELECT USING (
        auth.uid() = sender_id OR 
        auth.uid() = recipient_id OR
        auth.uid() IN (
            SELECT user_id FROM circle_members 
            WHERE circle_id = messages.circle_id
        )
    );

CREATE POLICY "Users can send messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Shop items policies
CREATE POLICY "Shop items are viewable by everyone" ON shop_items
    FOR SELECT USING (is_active = true);

-- User inventory policies
CREATE POLICY "Users can view their own inventory" ON user_inventory
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory" ON user_inventory
    FOR UPDATE USING (auth.uid() = user_id);

-- Insert some sample data
INSERT INTO shop_items (name, description, price, price_coins, category, item_type, rarity, premium_only, item_data, preview_data) VALUES
('Neon Cyber Theme', 'Futuristic neon colors with cyberpunk vibes', 500, 500, 'theme', 'profile_theme', 'rare', false, '{"colors": {"primary": "#00ff88", "secondary": "#00ccff"}}', '{"preview": "linear-gradient(45deg, #00ff88, #00ccff)"}'),
('Sunset Dream Theme', 'Warm sunset colors for a dreamy profile', 300, 300, 'theme', 'profile_theme', 'common', false, '{"colors": {"primary": "#ff6b6b", "secondary": "#ffa500"}}', '{"preview": "linear-gradient(45deg, #ff6b6b, #ffa500)"}'),
('Galaxy Explorer Theme', 'Deep space colors with stellar effects', 800, 800, 'theme', 'profile_theme', 'legendary', true, '{"colors": {"primary": "#667eea", "secondary": "#764ba2"}}', '{"preview": "linear-gradient(45deg, #667eea, #764ba2)"}'),
('Rainbow Pulse Animation', 'Animated rainbow effect for your avatar', 750, 750, 'animation', 'avatar_effect', 'epic', false, '{"effect": "rainbow_pulse", "duration": 2000}', '{"preview": "🌈"}'),
('Golden Tree Skin', 'Make your loop trees shine with golden branches', 1000, 1000, 'effect', 'loop_effect', 'legendary', false, '{"effect": "golden_tree", "intensity": 1.0}', '{"preview": "🌳✨"}'),
('1000 Loop Coins', 'Perfect for getting started with customizations', 0, null, 'coins', 'currency', 'common', false, '{"coins_amount": 1000, "bonus": 0}', '{"preview": "💰"}'),
('2500 Loop Coins', 'Great value pack with bonus coins', 0, null, 'coins', 'currency', 'rare', false, '{"coins_amount": 2500, "bonus": 500}', '{"preview": "💎"}');

-- Update the shop_items table to include price_usd for coin packages
UPDATE shop_items SET price_usd = 4.99 WHERE name = '1000 Loop Coins';
UPDATE shop_items SET price_usd = 9.99 WHERE name = '2500 Loop Coins';
