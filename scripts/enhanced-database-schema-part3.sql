-- Enhanced Database Schema Part 3: Mini-games, AI, and RLS Policies
-- Continue from enhanced-database-schema-part2.sql

-- =============================================
-- MINI-GAMES SYSTEM
-- =============================================

-- Mini-games
CREATE TABLE IF NOT EXISTS mini_games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    game_type VARCHAR(50) NOT NULL, -- 'puzzle', 'arcade', 'strategy', 'social'
    thumbnail_url TEXT,
    game_data JSONB NOT NULL, -- Game configuration and assets
    max_players INTEGER DEFAULT 1,
    play_count INTEGER DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    xp_reward INTEGER DEFAULT 10,
    coin_reward INTEGER DEFAULT 5,
    is_multiplayer BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game sessions
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES mini_games(id) ON DELETE CASCADE,
    host_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_code VARCHAR(20) UNIQUE,
    max_players INTEGER DEFAULT 1,
    current_players INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'active', 'finished'
    game_state JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game session players
CREATE TABLE IF NOT EXISTS game_session_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    position INTEGER,
    xp_earned INTEGER DEFAULT 0,
    coins_earned INTEGER DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(session_id, user_id)
);

-- =============================================
-- COLLABORATIVE WHITEBOARDS
-- =============================================

-- Whiteboards
CREATE TABLE IF NOT EXISTS whiteboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    canvas_data JSONB NOT NULL, -- Canvas state and objects
    layers_3d JSONB DEFAULT '{}', -- 3D layer configuration
    is_public BOOLEAN DEFAULT false,
    is_collaborative BOOLEAN DEFAULT true,
    max_collaborators INTEGER DEFAULT 10,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Whiteboard collaborators
CREATE TABLE IF NOT EXISTS whiteboard_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whiteboard_id UUID REFERENCES whiteboards(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    permission_level VARCHAR(20) DEFAULT 'edit', -- 'view', 'edit', 'admin'
    invited_by UUID REFERENCES profiles(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(whiteboard_id, user_id)
);

-- =============================================
-- AI RECOMMENDATIONS SYSTEM
-- =============================================

-- AI recommendation logs
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) NOT NULL, -- 'content', 'users', 'themes', 'events'
    recommended_items JSONB NOT NULL, -- Array of recommended item IDs
    algorithm_version VARCHAR(20) DEFAULT 'v1.0',
    confidence_score DECIMAL(3,2) DEFAULT 0,
    interaction_data JSONB DEFAULT '{}', -- User interactions with recommendations
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content moderation flags
CREATE TABLE IF NOT EXISTS content_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type VARCHAR(50) NOT NULL, -- 'loop', 'comment', 'message', 'profile'
    content_id UUID NOT NULL,
    reporter_id UUID REFERENCES profiles(id),
    flag_type VARCHAR(50) NOT NULL, -- 'spam', 'harassment', 'inappropriate', 'copyright'
    description TEXT,
    ai_confidence DECIMAL(3,2), -- AI moderation confidence
    moderator_id UUID REFERENCES profiles(id),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
    action_taken VARCHAR(50), -- 'none', 'warning', 'content_removed', 'user_suspended'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- User reputation logs
CREATE TABLE IF NOT EXISTS reputation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'post_liked', 'helpful_comment', 'reported_content'
    points_change INTEGER NOT NULL,
    reason TEXT,
    related_content_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ENHANCED NOTIFICATIONS
-- =============================================

-- Extend existing notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS animation_type VARCHAR(50) DEFAULT 'slide';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS group_key VARCHAR(100); -- For grouping similar notifications

-- =============================================
-- ENHANCED CIRCLES (COMMUNITIES)
-- =============================================

-- Add new columns to existing circles table
ALTER TABLE circles ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';
ALTER TABLE circles ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE circles ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '{}';
ALTER TABLE circles ADD COLUMN IF NOT EXISTS theme_id UUID;
ALTER TABLE circles ADD COLUMN IF NOT EXISTS voice_channel_enabled BOOLEAN DEFAULT false;
ALTER TABLE circles ADD COLUMN IF NOT EXISTS screen_sharing_enabled BOOLEAN DEFAULT false;
ALTER TABLE circles ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 1000;

-- Circle events
CREATE TABLE IF NOT EXISTS circle_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    organizer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) DEFAULT 'discussion', -- 'discussion', 'voice_chat', 'screen_share', 'game'
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE,
    max_participants INTEGER DEFAULT 50,
    participant_count INTEGER DEFAULT 0,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circle voice channels
CREATE TABLE IF NOT EXISTS circle_voice_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    max_participants INTEGER DEFAULT 10,
    current_participants INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    spatial_audio_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voice channel participants
CREATE TABLE IF NOT EXISTS voice_channel_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES circle_voice_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    is_muted BOOLEAN DEFAULT false,
    is_deafened BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(channel_id, user_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- User-related indexes
CREATE INDEX IF NOT EXISTS idx_profiles_xp_points ON profiles(xp_points DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON profiles(level DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_reputation_score ON profiles(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active DESC);

-- Theme-related indexes
CREATE INDEX IF NOT EXISTS idx_themes_category_id ON themes(category_id);
CREATE INDEX IF NOT EXISTS idx_themes_rarity ON themes(rarity);
CREATE INDEX IF NOT EXISTS idx_themes_rating_average ON themes(rating_average DESC);
CREATE INDEX IF NOT EXISTS idx_themes_download_count ON themes(download_count DESC);
CREATE INDEX IF NOT EXISTS idx_themes_tags ON themes USING GIN(tags);

-- Content indexes
CREATE INDEX IF NOT EXISTS idx_loops_hashtags ON loops USING GIN(hashtags);
CREATE INDEX IF NOT EXISTS idx_loops_tree_depth ON loops(tree_depth);
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_id ON comments(parent_comment_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_is_live ON live_streams(is_live);
CREATE INDEX IF NOT EXISTS idx_virtual_events_starts_at ON virtual_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_nft_items_owner_id ON nft_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_content_flags_status ON content_flags(status);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_themes_search ON themes USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_circles_search ON circles USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
