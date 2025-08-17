
-- Complete Database Setup for Loop Social Platform
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE content_type AS ENUM ('text', 'image', 'video', 'audio', 'file');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE visibility_type AS ENUM ('public', 'private', 'circle');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE interaction_type AS ENUM ('like', 'save', 'view', 'share');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('like', 'comment', 'follow', 'branch', 'mention', 'system', 'gift', 'achievement');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE member_role AS ENUM ('member', 'moderator', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE shop_category AS ENUM ('theme', 'animation', 'effect', 'premium', 'coins');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create profiles table (main user table)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,
    banner_url TEXT,
    bio TEXT,
    loop_coins INTEGER DEFAULT 500,
    xp_points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    is_premium BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    theme_data JSONB DEFAULT '{}',
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loops table (main content)
CREATE TABLE IF NOT EXISTS loops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    parent_loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
    content_type content_type NOT NULL DEFAULT 'text',
    content_text TEXT,
    content_media_url TEXT,
    content_metadata JSONB DEFAULT '{}',
    content_title TEXT,
    content JSONB DEFAULT '{}',
    visibility visibility_type DEFAULT 'public',
    circle_id UUID,
    tree_depth INTEGER DEFAULT 0,
    hashtags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loop statistics table
CREATE TABLE IF NOT EXISTS loop_stats (
    loop_id UUID PRIMARY KEY REFERENCES loops(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    branches_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loop interactions table
CREATE TABLE IF NOT EXISTS loop_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    loop_id UUID NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
    interaction_type interaction_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, loop_id, interaction_type)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loop_id UUID NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create follows table
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Create circles table (communities)
CREATE TABLE IF NOT EXISTS circles (
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

-- Create circle members table
CREATE TABLE IF NOT EXISTS circle_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role member_role DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(circle_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
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

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    animation_type VARCHAR(50) DEFAULT 'slide',
    priority VARCHAR(20) DEFAULT 'normal',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shop items table
CREATE TABLE IF NOT EXISTS shop_items (
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
    item_data JSONB NOT NULL DEFAULT '{}',
    preview_data JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    download_count INTEGER DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0.0,
    rating_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user inventory table
CREATE TABLE IF NOT EXISTS user_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT FALSE,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    purchase_price INTEGER,
    payment_method VARCHAR(20),
    UNIQUE(user_id, item_id)
);

-- Create themes table
CREATE TABLE IF NOT EXISTS themes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    theme_data JSONB NOT NULL DEFAULT '{}',
    preview_url TEXT,
    price_coins INTEGER DEFAULT 0,
    price_usd DECIMAL(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    download_count INTEGER DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0.0,
    rating_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gifts table
CREATE TABLE IF NOT EXISTS gifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_coins INTEGER NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    rarity VARCHAR(20) DEFAULT 'common',
    animation_url TEXT,
    sound_url TEXT,
    effect_data JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gift transactions table
CREATE TABLE IF NOT EXISTS gift_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    gift_id UUID NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
    loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    total_cost INTEGER NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    icon_url TEXT,
    xp_reward INTEGER DEFAULT 0,
    coin_reward INTEGER DEFAULT 0,
    requirements JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    rarity VARCHAR(20) DEFAULT 'common',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    progress JSONB DEFAULT '{}',
    unlocked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- Create reputation logs table
CREATE TABLE IF NOT EXISTS reputation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    points_change INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert essential admin settings
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
('maintenance_mode', '{"enabled": false, "message": "Under maintenance"}', 'Maintenance mode settings'),
('app_update_mode', '{"enabled": false, "message": "App update in progress"}', 'App update mode settings'),
('premium_features', '{"enabled": true, "price": 9.99}', 'Premium subscription settings'),
('coin_packages', '{"enabled": true, "packages": [{"coins": 1000, "price": 4.99}, {"coins": 2500, "price": 9.99}]}', 'Loop coin packages')
ON CONFLICT (setting_key) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_loops_author_id ON loops(author_id);
CREATE INDEX IF NOT EXISTS idx_loops_parent_loop_id ON loops(parent_loop_id);
CREATE INDEX IF NOT EXISTS idx_loops_created_at ON loops(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loops_visibility ON loops(visibility);
CREATE INDEX IF NOT EXISTS idx_loops_hashtags ON loops USING GIN(hashtags);

CREATE INDEX IF NOT EXISTS idx_loop_interactions_user_id ON loop_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loop_interactions_loop_id ON loop_interactions(loop_id);
CREATE INDEX IF NOT EXISTS idx_loop_interactions_type ON loop_interactions(interaction_type);

CREATE INDEX IF NOT EXISTS idx_comments_loop_id ON comments(loop_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loops_updated_at ON loops;
CREATE TRIGGER update_loops_updated_at BEFORE UPDATE ON loops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loop_stats_updated_at ON loop_stats;
CREATE TRIGGER update_loop_stats_updated_at BEFORE UPDATE ON loop_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Database functions for interactions
CREATE OR REPLACE FUNCTION increment_loop_likes(loop_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO loop_stats (loop_id, likes_count, updated_at)
    VALUES (loop_id, 1, NOW())
    ON CONFLICT (loop_id)
    DO UPDATE SET 
        likes_count = loop_stats.likes_count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_loop_likes(loop_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE loop_stats 
    SET likes_count = GREATEST(0, likes_count - 1),
        updated_at = NOW()
    WHERE loop_stats.loop_id = decrement_loop_likes.loop_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_loop_saves(loop_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO loop_stats (loop_id, saves_count, updated_at)
    VALUES (loop_id, 1, NOW())
    ON CONFLICT (loop_id)
    DO UPDATE SET 
        saves_count = loop_stats.saves_count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_loop_saves(loop_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE loop_stats 
    SET saves_count = GREATEST(0, saves_count - 1),
        updated_at = NOW()
    WHERE loop_stats.loop_id = decrement_loop_saves.loop_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_loop_shares(loop_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO loop_stats (loop_id, shares_count, updated_at)
    VALUES (loop_id, 1, NOW())
    ON CONFLICT (loop_id)
    DO UPDATE SET 
        shares_count = loop_stats.shares_count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_loop_comments(loop_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO loop_stats (loop_id, comments_count, updated_at)
    VALUES (loop_id, 1, NOW())
    ON CONFLICT (loop_id)
    DO UPDATE SET 
        comments_count = loop_stats.comments_count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_loop_views(loop_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO loop_stats (loop_id, views_count, updated_at)
    VALUES (loop_id, 1, NOW())
    ON CONFLICT (loop_id)
    DO UPDATE SET 
        views_count = loop_stats.views_count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get trending loops
CREATE OR REPLACE FUNCTION get_trending_loops(
    time_period VARCHAR DEFAULT '24h',
    trend_limit INTEGER DEFAULT 20,
    trend_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    author_id UUID,
    content_type VARCHAR,
    content_text TEXT,
    content_media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    likes_count INTEGER,
    comments_count INTEGER,
    branches_count INTEGER,
    trend_score DECIMAL
) AS $$
DECLARE
    time_filter TIMESTAMP WITH TIME ZONE;
BEGIN
    CASE time_period
        WHEN '1h' THEN time_filter := NOW() - INTERVAL '1 hour';
        WHEN '6h' THEN time_filter := NOW() - INTERVAL '6 hours';
        WHEN '24h' THEN time_filter := NOW() - INTERVAL '24 hours';
        WHEN '7d' THEN time_filter := NOW() - INTERVAL '7 days';
        ELSE time_filter := NOW() - INTERVAL '24 hours';
    END CASE;

    RETURN QUERY
    SELECT 
        l.id,
        l.author_id,
        l.content_type::VARCHAR,
        l.content_text,
        l.content_media_url,
        l.created_at,
        COALESCE(ls.likes_count, 0) as likes_count,
        COALESCE(ls.comments_count, 0) as comments_count,
        COALESCE(ls.branches_count, 0) as branches_count,
        (
            COALESCE(ls.likes_count, 0) * 1.0 +
            COALESCE(ls.comments_count, 0) * 2.0 +
            COALESCE(ls.branches_count, 0) * 3.0 +
            COALESCE(ls.shares_count, 0) * 1.5
        ) * 
        GREATEST(0.1, 1.0 - EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 86400.0)
        as trend_score
    FROM loops l
    LEFT JOIN loop_stats ls ON l.id = ls.loop_id
    WHERE l.created_at >= time_filter
    AND l.visibility = 'public'
    ORDER BY trend_score DESC
    LIMIT trend_limit
    OFFSET trend_offset;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
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
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public profiles viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public loops viewable by everyone" ON loops
    FOR SELECT USING (visibility = 'public');

CREATE POLICY "Users can view their own loops" ON loops
    FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Users can create loops" ON loops
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own loops" ON loops
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Loop interactions viewable by everyone" ON loop_interactions
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own interactions" ON loop_interactions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Comments viewable by everyone" ON comments
    FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON comments
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own comments" ON comments
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Follows viewable by everyone" ON follows
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON follows
    FOR ALL USING (auth.uid() = follower_id);

CREATE POLICY "Shop items viewable by everyone" ON shop_items
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view their own inventory" ON user_inventory
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own inventory" ON user_inventory
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own notifications" ON notifications
    FOR ALL USING (auth.uid() = user_id);

-- Insert sample data
INSERT INTO gifts (name, description, price_coins, category, rarity, animation_url, effect_data) VALUES
('Heart', 'Show some love!', 10, 'emotion', 'common', '/assets/gifts/heart.gif', '{"color": "#ff69b4", "duration": 2000}'),
('Star', 'You''re a star!', 25, 'achievement', 'common', '/assets/gifts/star.gif', '{"sparkle": true, "duration": 3000}'),
('Dragon Fire', 'Epic dragon power!', 100, 'fantasy', 'epic', '/assets/gifts/dragon-fire.gif', '{"fire": true, "sound": true, "duration": 5000}'),
('Forest Spirit', 'Nature''s blessing', 150, 'nature', 'legendary', '/assets/gifts/forest-spirit.gif', '{"nature": true, "healing": true, "duration": 6000}')
ON CONFLICT DO NOTHING;

INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, item_data, preview_data) VALUES
('Neon Cyber Theme', 'Futuristic neon colors with cyberpunk vibes', 500, 'theme', 'profile_theme', 'rare', '{"colors": {"primary": "#00ff88", "secondary": "#00ccff"}}', '{"preview": "linear-gradient(45deg, #00ff88, #00ccff)"}'),
('Dragon Lord Theme', 'Majestic dragon-inspired theme', 800, 'theme', 'profile_theme', 'legendary', '{"colors": {"primary": "#ff6b35", "secondary": "#f7931e"}}', '{"preview": "linear-gradient(45deg, #ff6b35, #f7931e)"}'),
('Forest Guardian Theme', 'Nature-inspired theme with earth tones', 600, 'theme', 'profile_theme', 'epic', '{"colors": {"primary": "#228b22", "secondary": "#32cd32"}}', '{"preview": "linear-gradient(45deg, #228b22, #32cd32)"}'),
('1000 Loop Coins', 'Perfect starter pack', 0, 'coins', 'currency', 'common', '{"coins_amount": 1000}', '{"preview": "💰"}'),
('2500 Loop Coins', 'Great value pack', 0, 'coins', 'currency', 'rare', '{"coins_amount": 2500, "bonus": 500}', '{"preview": "💎"}')
ON CONFLICT DO NOTHING;

-- Update coin packages with USD prices
UPDATE shop_items SET price_usd = 4.99 WHERE name = '1000 Loop Coins';
UPDATE shop_items SET price_usd = 9.99 WHERE name = '2500 Loop Coins';

-- Insert sample achievements
INSERT INTO achievements (name, description, category, xp_reward, coin_reward, requirements) VALUES
('First Loop', 'Create your first loop', 'content', 100, 50, '{"loops_created": 1}'),
('Social Butterfly', 'Follow 10 users', 'social', 150, 75, '{"following_count": 10}'),
('Popular Creator', 'Get 100 likes on your loops', 'engagement', 300, 100, '{"total_likes_received": 100}'),
('Gift Giver', 'Send 5 gifts to other users', 'social', 200, 50, '{"gifts_sent": 5}')
ON CONFLICT DO NOTHING;

RAISE NOTICE '✅ Database setup completed successfully!';
RAISE NOTICE '📊 All tables, functions, and policies have been created';
RAISE NOTICE '🎁 Sample data inserted for gifts, shop items, and achievements';
RAISE NOTICE '🛡️ Row Level Security policies enabled';
RAISE NOTICE '⚡ Database functions for interactions created';
