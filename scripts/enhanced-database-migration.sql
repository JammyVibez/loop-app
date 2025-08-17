-- Enhanced Database Migration for Loop Social Platform
-- This script adds all the new tables and features for the enhanced platform
-- Run this in your Supabase SQL editor after backing up existing data

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "vector" CASCADE;

-- =============================================
-- ENHANCED USER SYSTEM WITH GAMIFICATION
-- =============================================

-- Add new columns to existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xp_points INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skill_points INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_activity_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language_preference VARCHAR(10) DEFAULT 'en';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accessibility_settings JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"profile_visibility": "public", "activity_visibility": "friends", "message_privacy": "friends"}';

-- XP transaction log
CREATE TABLE IF NOT EXISTS xp_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    xp_amount INTEGER NOT NULL,
    multipliers JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User achievements system
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url TEXT,
    category VARCHAR(50) NOT NULL, -- 'social', 'content', 'engagement', 'special'
    rarity VARCHAR(20) DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
    xp_reward INTEGER DEFAULT 0,
    requirements JSONB NOT NULL, -- Conditions to unlock
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User achievement progress
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
    progress JSONB DEFAULT '{}',
    unlocked_at TIMESTAMP WITH TIME ZONE,
    is_displayed BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- User skill trees
CREATE TABLE IF NOT EXISTS skill_trees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'creator', 'social', 'technical', 'community'
    tree_data JSONB NOT NULL, -- Tree structure and nodes
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User skill progress
CREATE TABLE IF NOT EXISTS user_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    skill_tree_id UUID REFERENCES skill_trees(id) ON DELETE CASCADE,
    unlocked_nodes JSONB DEFAULT '[]',
    skill_points INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, skill_tree_id)
);

-- Daily challenges
CREATE TABLE IF NOT EXISTS daily_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    challenge_type VARCHAR(50) NOT NULL,
    target_value INTEGER NOT NULL,
    current_progress INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    xp_reward INTEGER NOT NULL,
    coin_reward INTEGER NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, challenge_type, DATE(created_at))
);

-- Leaderboards cache
CREATE TABLE IF NOT EXISTS leaderboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    leaderboard_type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    previous_rank INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(leaderboard_type, user_id)
);

-- =============================================
-- 3D USER PROFILES AND ROOMS
-- =============================================

-- User 3D rooms/spaces
CREATE TABLE IF NOT EXISTS user_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    room_type VARCHAR(50) DEFAULT 'personal', -- 'personal', 'showcase', 'meeting'
    layout_data JSONB NOT NULL, -- 3D layout configuration
    theme_id UUID, -- References themes table
    is_public BOOLEAN DEFAULT false,
    visit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room visits tracking
CREATE TABLE IF NOT EXISTS room_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES user_rooms(id) ON DELETE CASCADE,
    visitor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    visit_duration INTEGER, -- in seconds
    interactions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guest book entries
CREATE TABLE IF NOT EXISTS room_guestbook (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES user_rooms(id) ON DELETE CASCADE,
    visitor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room furniture and decorations
CREATE TABLE IF NOT EXISTS room_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES user_rooms(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- 'furniture', 'decoration', 'media_display'
    item_data JSONB NOT NULL,
    position JSONB NOT NULL, -- {x, y, z}
    rotation JSONB NOT NULL, -- {x, y, z}
    scale JSONB NOT NULL,    -- {x, y, z}
    is_interactive BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ENHANCED THEMING SYSTEM
-- =============================================

-- Theme categories
CREATE TABLE IF NOT EXISTS theme_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced themes table
CREATE TABLE IF NOT EXISTS themes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES theme_categories(id),
    preview_images TEXT[] DEFAULT '{}',
    preview_video_url TEXT,
    theme_data JSONB NOT NULL, -- Complete theme configuration
    components JSONB NOT NULL, -- Individual component styles
    animations JSONB DEFAULT '{}', -- Animation configurations
    effects_3d JSONB DEFAULT '{}', -- 3D effects and transforms
    price_coins INTEGER DEFAULT 0,
    price_usd DECIMAL(10,2) DEFAULT 0,
    rarity VARCHAR(20) DEFAULT 'common',
    is_premium BOOLEAN DEFAULT false,
    is_seasonal BOOLEAN DEFAULT false,
    season_start DATE,
    season_end DATE,
    download_count INTEGER DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    creator_id UUID REFERENCES profiles(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- GIFTING SYSTEM
-- =============================================

-- Gift items catalog
CREATE TABLE IF NOT EXISTS gift_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common',
    price_coins INTEGER,
    price_usd DECIMAL(10,2),
    gift_multiplier DECIMAL(3,2) DEFAULT 1.0,
    preview_media TEXT[],
    item_data JSONB NOT NULL,
    is_giftable BOOLEAN DEFAULT true,
    is_limited_edition BOOLEAN DEFAULT false,
    availability_start DATE,
    availability_end DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Gift transactions
CREATE TABLE IF NOT EXISTS gift_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    gift_item_id UUID REFERENCES gift_items(id),
    message TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    payment_method VARCHAR(20) NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    gift_wrapping JSONB,
    delivery_config JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    received_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Gift reactions and appreciation
CREATE TABLE IF NOT EXISTS gift_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gift_transaction_id UUID REFERENCES gift_transactions(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL,
    public_message TEXT,
    private_message TEXT,
    media_response_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group gifts
CREATE TABLE IF NOT EXISTS group_gifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    target_gift_id UUID REFERENCES gift_items(id),
    target_amount DECIMAL(10,2) NOT NULL,
    current_amount DECIMAL(10,2) DEFAULT 0,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'collecting',
    group_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group gift contributions
CREATE TABLE IF NOT EXISTS group_gift_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_gift_id UUID REFERENCES group_gifts(id) ON DELETE CASCADE,
    contributor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount_contributed DECIMAL(10,2) NOT NULL,
    contributor_message TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    contributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_gift_id, contributor_id)
);

-- =============================================
-- SEARCH OPTIMIZATION
-- =============================================

-- Add search-related columns to loops table
ALTER TABLE loops ADD COLUMN IF NOT EXISTS content_vector vector(384);
ALTER TABLE loops ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE loops ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20);
ALTER TABLE loops ADD COLUMN IF NOT EXISTS trending_score DECIMAL(10,4) DEFAULT 0;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS engagement_score DECIMAL(10,4) DEFAULT 0;

-- Search analytics
CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    query TEXT NOT NULL,
    filters JSONB,
    results_count INTEGER,
    clicked_results JSONB,
    search_duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ANALYTICS AND TRACKING
-- =============================================

-- Gift analytics
CREATE TABLE IF NOT EXISTS gift_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    gifts_sent_count INTEGER DEFAULT 0,
    gifts_received_count INTEGER DEFAULT 0,
    total_spent_coins INTEGER DEFAULT 0,
    total_spent_usd DECIMAL(10,2) DEFAULT 0,
    total_received_value_coins INTEGER DEFAULT 0,
    analytics_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, period_start, period_end)
);

-- User engagement analytics
CREATE TABLE IF NOT EXISTS user_engagement_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    session_count INTEGER DEFAULT 0,
    session_duration_minutes INTEGER DEFAULT 0,
    loops_created INTEGER DEFAULT 0,
    loops_liked INTEGER DEFAULT 0,
    loops_commented INTEGER DEFAULT 0,
    searches_performed INTEGER DEFAULT 0,
    rooms_visited INTEGER DEFAULT 0,
    gifts_sent INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Gamification indexes
CREATE INDEX IF NOT EXISTS idx_profiles_xp_points ON profiles(xp_points DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON profiles(level DESC);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_created_at ON xp_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_user_id ON daily_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_expires_at ON daily_challenges(expires_at);

-- 3D profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_rooms_user_id ON user_rooms(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rooms_is_public ON user_rooms(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_room_visits_room_id ON room_visits(room_id);
CREATE INDEX IF NOT EXISTS idx_room_visits_visitor_id ON room_visits(visitor_id);

-- Search indexes
CREATE INDEX IF NOT EXISTS idx_loops_content_search ON loops USING GIN(to_tsvector('english', content_text));
CREATE INDEX IF NOT EXISTS idx_loops_category ON loops(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loops_sentiment ON loops(sentiment) WHERE sentiment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loops_trending_score ON loops(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_user_id ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON search_analytics(created_at DESC);

-- Gifting indexes
CREATE INDEX IF NOT EXISTS idx_gift_transactions_sender_id ON gift_transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_recipient_id ON gift_transactions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_status ON gift_transactions(status);
CREATE INDEX IF NOT EXISTS idx_gift_items_category ON gift_items(category);
CREATE INDEX IF NOT EXISTS idx_gift_items_rarity ON gift_items(rarity);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to calculate user level from XP
CREATE OR REPLACE FUNCTION calculate_user_level(total_xp INTEGER)
RETURNS TABLE(level INTEGER, current_xp INTEGER, xp_for_next_level INTEGER) AS $$
DECLARE
    user_level INTEGER := 1;
    xp_required INTEGER := 0;
    level_xp INTEGER;
BEGIN
    WHILE xp_required <= total_xp LOOP
        user_level := user_level + 1;
        level_xp := FLOOR(100 * POWER(user_level, 1.5));
        xp_required := xp_required + level_xp;
    END LOOP;
    
    user_level := user_level - 1;
    level_xp := FLOOR(100 * POWER(user_level + 1, 1.5));
    
    RETURN QUERY SELECT 
        user_level,
        total_xp - (xp_required - level_xp),
        level_xp - (total_xp - (xp_required - level_xp));
END;
$$ LANGUAGE plpgsql;

-- Function to update user level when XP changes
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER AS $$
DECLARE
    level_info RECORD;
BEGIN
    SELECT * INTO level_info FROM calculate_user_level(NEW.xp_points);
    NEW.level := level_info.level;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update level when XP changes
DROP TRIGGER IF EXISTS trigger_update_user_level ON profiles;
CREATE TRIGGER trigger_update_user_level
    BEFORE UPDATE OF xp_points ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_level();

-- Function to update loop stats when interactions change
CREATE OR REPLACE FUNCTION update_loop_trending_score()
RETURNS TRIGGER AS $$
DECLARE
    loop_stats RECORD;
    trending_score DECIMAL(10,4);
    engagement_score DECIMAL(10,4);
    time_decay DECIMAL(10,4);
    hours_since_creation INTEGER;
BEGIN
    -- Get current loop stats
    SELECT 
        likes_count, 
        comments_count, 
        branches_count, 
        shares_count, 
        views_count,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_old
    INTO loop_stats
    FROM loops l
    JOIN loop_stats ls ON l.id = ls.loop_id
    WHERE l.id = COALESCE(NEW.loop_id, OLD.loop_id);
    
    -- Calculate engagement score
    engagement_score := (
        loop_stats.likes_count * 1.0 +
        loop_stats.comments_count * 2.0 +
        loop_stats.branches_count * 3.0 +
        loop_stats.shares_count * 2.5 +
        loop_stats.views_count * 0.1
    );
    
    -- Apply time decay (content gets less trending over time)
    hours_since_creation := GREATEST(loop_stats.hours_old, 1);
    time_decay := 1.0 / POWER(hours_since_creation / 24.0 + 1, 0.8);
    
    trending_score := engagement_score * time_decay;
    
    -- Update the loop with new scores
    UPDATE loops 
    SET 
        trending_score = trending_score,
        engagement_score = engagement_score
    WHERE id = COALESCE(NEW.loop_id, OLD.loop_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update trending scores when interactions change
DROP TRIGGER IF EXISTS trigger_update_trending_score ON loop_interactions;
CREATE TRIGGER trigger_update_trending_score
    AFTER INSERT OR UPDATE OR DELETE ON loop_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_loop_trending_score();

-- =============================================
-- SAMPLE DATA INSERTION
-- =============================================

-- Insert default achievements
INSERT INTO achievements (name, description, category, rarity, xp_reward, requirements, icon_url) VALUES
('First Loop', 'Create your first loop', 'content', 'common', 100, '{"loops_created": 1}', '🌱'),
('Social Butterfly', 'Follow 100 users', 'social', 'rare', 200, '{"following_count": 100}', '🦋'),
('Viral Sensation', 'Get 1000 likes on a single loop', 'content', 'epic', 1000, '{"single_loop_likes": 1000}', '🔥'),
('Community Builder', 'Create your first circle', 'community', 'rare', 250, '{"circles_created": 1}', '🏗️'),
('Early Adopter', 'Join during beta period', 'special', 'legendary', 2000, '{"joined_before": "2024-12-31"}', '🚀'),
('Rising Star', 'Reach level 10', 'milestone', 'rare', 500, '{"level": 10}', '⭐'),
('Conversation Starter', 'Receive 100 comments', 'engagement', 'rare', 300, '{"total_comments_received": 100}', '💬'),
('Generous Giver', 'Send 10 gifts to other users', 'social', 'rare', 400, '{"gifts_sent": 10}', '🎁'),
('Room Designer', 'Customize your 3D profile room', 'content', 'common', 150, '{"room_customized": true}', '🏠'),
('Search Master', 'Perform 100 searches', 'engagement', 'common', 75, '{"searches_performed": 100}', '🔍')
ON CONFLICT DO NOTHING;

-- Insert default skill trees
INSERT INTO skill_trees (name, description, category, tree_data) VALUES
('Creator Path', 'Master the art of content creation', 'creator', '{
  "nodes": [
    {"id": "content_basics", "name": "Content Basics", "cost": 1, "prerequisites": [], "position": {"x": 0, "y": 0}},
    {"id": "visual_storytelling", "name": "Visual Storytelling", "cost": 2, "prerequisites": ["content_basics"], "position": {"x": -1, "y": 1}},
    {"id": "viral_mechanics", "name": "Viral Mechanics", "cost": 3, "prerequisites": ["content_basics"], "position": {"x": 1, "y": 1}}
  ]
}'),
('Social Connector', 'Build meaningful connections', 'social', '{
  "nodes": [
    {"id": "networking_basics", "name": "Networking Basics", "cost": 1, "prerequisites": [], "position": {"x": 0, "y": 0}},
    {"id": "community_building", "name": "Community Building", "cost": 2, "prerequisites": ["networking_basics"], "position": {"x": 0, "y": 1}},
    {"id": "influence_mastery", "name": "Influence Mastery", "cost": 3, "prerequisites": ["community_building"], "position": {"x": 0, "y": 2}}
  ]
}')
ON CONFLICT DO NOTHING;

-- Insert theme categories
INSERT INTO theme_categories (name, description, icon_url, sort_order) VALUES
('Dark Themes', 'Sleek and modern dark themes', '🌙', 1),
('Light Themes', 'Clean and bright light themes', '☀️', 2),
('Colorful', 'Vibrant and energetic themes', '🌈', 3),
('Minimalist', 'Simple and elegant designs', '⚪', 4),
('Gaming', 'Themes for gaming enthusiasts', '🎮', 5),
('Nature', 'Earth-inspired natural themes', '🌿', 6)
ON CONFLICT DO NOTHING;

-- Insert sample gift items
INSERT INTO gift_items (name, description, category, rarity, price_coins, item_data, is_giftable) VALUES
('Golden Theme Pack', 'Luxury golden theme with premium effects', 'themes', 'legendary', 2000, '{"theme_id": "golden_luxury", "effects": ["golden_particles", "luxury_glow"]}', true),
('Rainbow Trail Effect', 'Colorful rainbow cursor trail', 'effects', 'epic', 500, '{"effect_type": "cursor_trail", "colors": ["rainbow"], "duration": 30}', true),
('Premium Month', 'One month of premium features', 'premium_features', 'rare', 1500, '{"duration_days": 30, "features": ["ad_free", "premium_themes", "analytics"]}', true),
('Celebration Confetti', 'Festive confetti animation', 'effects', 'common', 100, '{"effect_type": "celebration", "animation": "confetti_burst"}', true),
('Virtual Flowers', 'Beautiful digital flower bouquet', 'decorations', 'common', 50, '{"decoration_type": "flowers", "style": "bouquet", "colors": ["mixed"]}', true)
ON CONFLICT DO NOTHING;

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Enhanced database migration completed successfully!';
    RAISE NOTICE 'New features added:';
    RAISE NOTICE '- Gamification system (XP, achievements, skill trees)';
    RAISE NOTICE '- 3D user profiles and rooms';
    RAISE NOTICE '- Enhanced theming system';
    RAISE NOTICE '- Virtual gifting system';
    RAISE NOTICE '- Advanced search optimization';
    RAISE NOTICE '- Analytics and tracking';
END $$;
