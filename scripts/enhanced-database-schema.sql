-- Enhanced Database Schema for Loop Social Platform with 3D Features, Gifting, and Real-time Chat
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE content_type AS ENUM ('text', 'image', 'video', 'audio', 'file');
CREATE TYPE visibility_type AS ENUM ('public', 'private', 'circle');
CREATE TYPE interaction_type AS ENUM ('like', 'save', 'view', 'share');
CREATE TYPE notification_type AS ENUM ('like', 'comment', 'follow', 'branch', 'mention', 'system', 'gift');
CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'system', 'gift', 'voice');
CREATE TYPE member_role AS ENUM ('member', 'moderator', 'admin', 'owner');
CREATE TYPE shop_category AS ENUM ('theme', 'animation', 'effect', 'premium', 'coins');
CREATE TYPE gift_type AS ENUM ('coins', 'premium', 'theme', 'animation', 'effect', 'badge');
CREATE TYPE gift_status AS ENUM ('sent', 'delivered', 'claimed', 'expired');
CREATE TYPE room_type AS ENUM ('text', 'voice', 'video');

-- Enhanced Users/Profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,
    banner_url TEXT,
    bio TEXT,
    location VARCHAR(100),
    website VARCHAR(255),
    loop_coins INTEGER DEFAULT 500,
    xp_points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    is_premium BOOLEAN DEFAULT FALSE,
    premium_expires_at TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    active_theme VARCHAR(50) DEFAULT 'default',
    theme_data JSONB,
    privacy_settings JSONB DEFAULT '{"profile_visibility": "public", "message_privacy": "everyone"}',
    notification_settings JSONB DEFAULT '{"email": true, "push": true, "in_app": true}',
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profile statistics table
CREATE TABLE profile_stats (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    loops_count INTEGER DEFAULT 0,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    likes_received INTEGER DEFAULT 0,
    profile_views INTEGER DEFAULT 0,
    achievements_count INTEGER DEFAULT 0,
    gifts_sent INTEGER DEFAULT 0,
    gifts_received INTEGER DEFAULT 0,
    total_gift_value INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced Loops table
CREATE TABLE loops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    parent_loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
    content_type content_type NOT NULL DEFAULT 'text',
    content_text TEXT,
    content_media_url TEXT,
    content_metadata JSONB,
    visibility visibility_type DEFAULT 'public',
    circle_id UUID,
    tree_depth INTEGER DEFAULT 0,
    hashtags TEXT[],
    mentions TEXT[],
    is_featured BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    engagement_score INTEGER DEFAULT 0,
    gifts_received INTEGER DEFAULT 0,
    total_gift_value INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced Loop statistics table
CREATE TABLE loop_stats (
    loop_id UUID PRIMARY KEY REFERENCES loops(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    branches_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    gifts_count INTEGER DEFAULT 0,
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
    gifts_received INTEGER DEFAULT 0,
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

-- Enhanced Circles table
CREATE TABLE circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    avatar_url TEXT,
    banner_url TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    member_count INTEGER DEFAULT 1,
    rules TEXT[],
    settings JSONB DEFAULT '{"allow_posts": true, "allow_media": true, "moderation": "auto"}',
    stats JSONB DEFAULT '{"total_posts": 0, "total_comments": 0, "active_members": 0, "weekly_growth": 0}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circle members table
CREATE TABLE circle_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role member_role DEFAULT 'member',
    contribution_score INTEGER DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(circle_id, user_id)
);

-- Circle rooms for enhanced chat
CREATE TABLE circle_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type room_type DEFAULT 'text',
    is_private BOOLEAN DEFAULT FALSE,
    member_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{"max_members": 100, "allow_voice": true, "allow_video": false}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced Messages table for real-time chat
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    room_id UUID REFERENCES circle_rooms(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type message_type DEFAULT 'text',
    file_url TEXT,
    file_metadata JSONB,
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    reactions JSONB DEFAULT '[]',
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (
        (recipient_id IS NOT NULL AND circle_id IS NULL AND room_id IS NULL) OR 
        (recipient_id IS NULL AND (circle_id IS NOT NULL OR room_id IS NOT NULL))
    )
);

-- Message reactions table
CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Enhanced Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    is_pushed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced Shop items table
CREATE TABLE shop_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    price_coins INTEGER,
    price_usd DECIMAL(10,2),
    category shop_category NOT NULL,
    item_data JSONB NOT NULL,
    preview_url TEXT,
    rarity VARCHAR(20) DEFAULT 'common',
    is_premium_only BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    purchase_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (price_coins IS NOT NULL OR price_usd IS NOT NULL)
);

-- Enhanced User inventory table
CREATE TABLE user_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_id UUID REFERENCES shop_items(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    item_data JSONB,
    is_active BOOLEAN DEFAULT FALSE,
    source VARCHAR(20) DEFAULT 'purchase', -- 'purchase', 'gift', 'reward'
    gift_id UUID,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, item_id)
);

-- Comprehensive Gifts table
CREATE TABLE gifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    gift_type gift_type NOT NULL,
    gift_name VARCHAR(100) NOT NULL,
    gift_value JSONB, -- flexible storage for different gift types
    cost INTEGER NOT NULL,
    message TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    status gift_status DEFAULT 'sent',
    context_type VARCHAR(20), -- 'post', 'profile', 'comment', 'reel'
    context_id UUID,
    delivered_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User achievements table
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(10) NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common',
    criteria JSONB NOT NULL,
    reward JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User achievements junction table
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    progress INTEGER DEFAULT 0,
    max_progress INTEGER,
    is_completed BOOLEAN DEFAULT FALSE,
    earned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- User badges table
CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    badge_id VARCHAR(50) NOT NULL,
    badge_name VARCHAR(100) NOT NULL,
    badge_data JSONB,
    source VARCHAR(20) DEFAULT 'achievement', -- 'achievement', 'gift', 'purchase'
    gift_id UUID REFERENCES gifts(id),
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Real-time presence table
CREATE TABLE user_presence (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_activity VARCHAR(100),
    device_info JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation participants for group chats
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    role VARCHAR(20) DEFAULT 'member',
    UNIQUE(conversation_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_last_active ON profiles(last_active);

CREATE INDEX idx_loops_author_id ON loops(author_id);
CREATE INDEX idx_loops_parent_loop_id ON loops(parent_loop_id);
CREATE INDEX idx_loops_created_at ON loops(created_at DESC);
CREATE INDEX idx_loops_visibility ON loops(visibility);
CREATE INDEX idx_loops_hashtags ON loops USING GIN(hashtags);
CREATE INDEX idx_loops_engagement_score ON loops(engagement_score DESC);

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
CREATE INDEX idx_circle_members_role ON circle_members(role);

CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_messages_circle_id ON messages(circle_id);
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

CREATE INDEX idx_gifts_sender_id ON gifts(sender_id);
CREATE INDEX idx_gifts_recipient_id ON gifts(recipient_id);
CREATE INDEX idx_gifts_status ON gifts(status);
CREATE INDEX idx_gifts_created_at ON gifts(created_at DESC);

CREATE INDEX idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX idx_user_inventory_item_type ON user_inventory(item_type);

CREATE INDEX idx_user_presence_is_online ON user_presence(is_online);
CREATE INDEX idx_user_presence_last_seen ON user_presence(last_seen);

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

CREATE TRIGGER update_user_presence_updated_at BEFORE UPDATE ON user_presence
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create functions for statistics updates
CREATE OR REPLACE FUNCTION update_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update profile stats when relevant actions occur
    IF TG_TABLE_NAME = 'loops' THEN
        UPDATE profile_stats 
        SET loops_count = loops_count + 1
        WHERE user_id = NEW.author_id;
    ELSIF TG_TABLE_NAME = 'follows' THEN
        UPDATE profile_stats 
        SET followers_count = followers_count + 1
        WHERE user_id = NEW.following_id;
        
        UPDATE profile_stats 
        SET following_count = following_count + 1
        WHERE user_id = NEW.follower_id;
    ELSIF TG_TABLE_NAME = 'gifts' AND NEW.status = 'delivered' THEN
        UPDATE profile_stats 
        SET gifts_received = gifts_received + 1,
            total_gift_value = total_gift_value + NEW.cost
        WHERE user_id = NEW.recipient_id;
        
        UPDATE profile_stats 
        SET gifts_sent = gifts_sent + 1
        WHERE user_id = NEW.sender_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for statistics
CREATE TRIGGER update_stats_on_loop_insert AFTER INSERT ON loops
    FOR EACH ROW EXECUTE FUNCTION update_profile_stats();

CREATE TRIGGER update_stats_on_follow_insert AFTER INSERT ON follows
    FOR EACH ROW EXECUTE FUNCTION update_profile_stats();

CREATE TRIGGER update_stats_on_gift_update AFTER UPDATE ON gifts
    FOR EACH ROW EXECUTE FUNCTION update_profile_stats();

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
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be expanded based on specific requirements)
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public loops are viewable by everyone" ON loops
    FOR SELECT USING (visibility = 'public');

CREATE POLICY "Users can view their own loops" ON loops
    FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Users can create loops" ON loops
    FOR INSERT WITH CHECK (auth.uid() = author_id);

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

CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own gifts" ON gifts
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send gifts" ON gifts
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Insert sample achievements
INSERT INTO achievements (name, description, icon, rarity, criteria, reward) VALUES
('First Loop', 'Create your first loop', '🌱', 'common', '{"loops_created": 1}', '{"xp": 100, "coins": 50}'),
('Social Butterfly', 'Get 100 followers', '🦋', 'rare', '{"followers": 100}', '{"xp": 500, "coins": 200}'),
('Loop Master', 'Create 100 loops', '🏆', 'epic', '{"loops_created": 100}', '{"xp": 1000, "coins": 500}'),
('Gift Giver', 'Send 10 gifts', '🎁', 'rare', '{"gifts_sent": 10}', '{"xp": 300, "coins": 150}'),
('Popular Creator', 'Get 1000 likes on loops', '⭐', 'epic', '{"likes_received": 1000}', '{"xp": 800, "coins": 400}'),
('Community Leader', 'Create a circle with 50+ members', '👑', 'legendary', '{"circle_members": 50}', '{"xp": 2000, "coins": 1000}');

-- Insert sample shop items
INSERT INTO shop_items (name, description, price_coins, category, item_data, rarity, is_premium_only) VALUES
('Neon Cyber Theme', 'Futuristic neon theme with glow effects', 500, 'theme', '{"colors": {"primary": "#00ff88", "secondary": "#00ccff"}, "effects": {"glow": true, "particles": true}}', 'rare', false),
('Sunset Dream Theme', 'Warm sunset colors for your profile', 300, 'theme', '{"colors": {"primary": "#ff6b6b", "secondary": "#ffa500"}, "effects": {"glow": true}}', 'common', false),
('Galaxy Explorer Theme', 'Deep space theme with stellar effects', 800, 'theme', '{"colors": {"primary": "#667eea", "secondary": "#764ba2"}, "effects": {"glow": true, "particles": true}}', 'epic', true),
('Sparkle Trail Animation', 'Magical sparkles that follow your avatar', 600, 'animation', '{"type": "sparkle_trail", "intensity": 0.8}', 'rare', false),
('Golden Glow Effect', 'Premium golden glow for your posts', 1000, 'effect', '{"type": "golden_glow", "intensity": 1.0}', 'legendary', true),
('Rainbow Border Effect', 'Colorful rainbow border for your profile', 400, 'effect', '{"type": "rainbow_border", "width": 2}', 'common', false);

-- Create initial profile stats for existing users
INSERT INTO profile_stats (user_id) 
SELECT id FROM profiles 
ON CONFLICT (user_id) DO NOTHING;

-- Create initial user presence for existing users
INSERT INTO user_presence (user_id, is_online, last_seen) 
SELECT id, false, NOW() FROM profiles 
ON CONFLICT (user_id) DO NOTHING;
