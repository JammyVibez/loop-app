-- Enhanced Loop Social Media Platform Database Schema
-- Version 3.0 with full feature support

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table with enhanced features
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    location VARCHAR(100),
    website VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_level VARCHAR(20) CHECK (verification_level IN ('influencer', 'root')),
    is_premium BOOLEAN DEFAULT FALSE,
    premium_expires_at TIMESTAMP WITH TIME ZONE,
    loop_coins INTEGER DEFAULT 100,
    theme_preferences JSONB DEFAULT '{}',
    privacy_settings JSONB DEFAULT '{"profile_visibility": "public", "show_activity": true, "allow_messages": true, "show_online_status": true}',
    notification_settings JSONB DEFAULT '{"email_loops": true, "email_branches": true, "email_messages": true, "push_loops": true, "push_branches": true, "push_messages": true, "marketing": false}',
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_online BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loops table with enhanced content types
CREATE TABLE loops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES loops(id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('text', 'image', 'video', 'audio')),
    content_text TEXT,
    content_media_url TEXT,
    content_title VARCHAR(255),
    content_duration INTEGER, -- for audio/video in seconds
    content_caption TEXT,
    hashtags TEXT[], -- Array of hashtags
    circle_id UUID REFERENCES circles(id),
    is_challenge_entry BOOLEAN DEFAULT FALSE,
    challenge_id UUID REFERENCES challenges(id),
    tree_depth INTEGER DEFAULT 0,
    branch_path TEXT, -- Path from root to this node
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'circle', 'private')),
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loop statistics table
CREATE TABLE loop_stats (
    loop_id UUID PRIMARY KEY REFERENCES loops(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    branches_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    creativity_score DECIMAL(5,2) DEFAULT 0.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loop interactions (likes, saves, etc.)
CREATE TABLE loop_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    loop_id UUID NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('like', 'save', 'share', 'view')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, loop_id, interaction_type)
);

-- Comments table with threading support
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loop_id UUID NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comment likes
CREATE TABLE comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, comment_id)
);

-- Circles (Communities) table
CREATE TABLE circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    category VARCHAR(50),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_private BOOLEAN DEFAULT FALSE,
    member_count INTEGER DEFAULT 1,
    rules TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circle memberships
CREATE TABLE circle_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(circle_id, user_id)
);

-- Challenges table
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    prize TEXT,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    participant_count INTEGER DEFAULT 0,
    winner_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Challenge participations
CREATE TABLE challenge_participations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_loop_id UUID REFERENCES loops(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(challenge_id, user_id)
);

-- Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    attendee_count INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event attendances
CREATE TABLE event_attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Messages table for chat system
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    name VARCHAR(100), -- For group chats
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation participants
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'audio', 'loop_invite')),
    media_url TEXT,
    loop_id UUID REFERENCES loops(id), -- For loop invitations
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hashtags table for trending
CREATE TABLE hashtags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag VARCHAR(100) UNIQUE NOT NULL,
    usage_count INTEGER DEFAULT 1,
    trending_score DECIMAL(10,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loop hashtags junction table
CREATE TABLE loop_hashtags (
    loop_id UUID NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
    hashtag_id UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
    PRIMARY KEY (loop_id, hashtag_id)
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    data JSONB, -- Additional data for the notification
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User follows
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK(follower_id != following_id)
);

-- Shop items
CREATE TABLE shop_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price INTEGER NOT NULL, -- Price in Loop Coins
    category VARCHAR(50),
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('theme', 'avatar_frame', 'badge', 'animation')),
    item_data JSONB, -- Theme colors, animation data, etc.
    is_premium_only BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User purchases
CREATE TABLE user_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_item_id UUID NOT NULL REFERENCES shop_items(id),
    price_paid INTEGER NOT NULL,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, shop_item_id)
);

-- Indexes for performance
CREATE INDEX idx_loops_author_id ON loops(author_id);
CREATE INDEX idx_loops_parent_id ON loops(parent_id);
CREATE INDEX idx_loops_created_at ON loops(created_at DESC);
CREATE INDEX idx_loops_hashtags ON loops USING GIN(hashtags);
CREATE INDEX idx_loop_interactions_user_loop ON loop_interactions(user_id, loop_id);
CREATE INDEX idx_comments_loop_id ON comments(loop_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_hashtags_trending_score ON hashtags(trending_score DESC);
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);

-- Functions for updating statistics
CREATE OR REPLACE FUNCTION update_loop_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Update parent loop branch count
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE loop_stats 
            SET branches_count = branches_count + 1,
                updated_at = NOW()
            WHERE loop_id = NEW.parent_id;
        END IF;
        
        -- Insert initial stats for new loop
        INSERT INTO loop_stats (loop_id) VALUES (NEW.id)
        ON CONFLICT (loop_id) DO NOTHING;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Update parent loop branch count
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE loop_stats 
            SET branches_count = branches_count - 1,
                updated_at = NOW()
            WHERE loop_id = OLD.parent_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for loop statistics
CREATE TRIGGER trigger_update_loop_stats
    AFTER INSERT OR DELETE ON loops
    FOR EACH ROW
    EXECUTE FUNCTION update_loop_stats();

-- Function to update hashtag usage
CREATE OR REPLACE FUNCTION update_hashtag_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Extract hashtags from content and update usage
        IF NEW.hashtags IS NOT NULL THEN
            -- This would be implemented with proper hashtag extraction logic
            -- For now, we'll update based on the hashtags array
            UPDATE hashtags 
            SET usage_count = usage_count + 1,
                trending_score = trending_score + 1.0,
                updated_at = NOW()
            WHERE tag = ANY(NEW.hashtags);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for hashtag usage
CREATE TRIGGER trigger_update_hashtag_usage
    AFTER INSERT ON loops
    FOR EACH ROW
    EXECUTE FUNCTION update_hashtag_usage();

-- Function to update user online status
CREATE OR REPLACE FUNCTION update_user_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET last_seen = NOW(),
        is_online = TRUE
    WHERE id = NEW.user_id OR id = NEW.author_id OR id = NEW.sender_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Views for common queries
CREATE VIEW user_stats AS
SELECT 
    u.id,
    u.username,
    u.display_name,
    COUNT(DISTINCT l.id) as loops_count,
    COUNT(DISTINCT f1.id) as followers_count,
    COUNT(DISTINCT f2.id) as following_count,
    COALESCE(SUM(ls.likes_count), 0) as total_likes_received
FROM users u
LEFT JOIN loops l ON u.id = l.author_id
LEFT JOIN follows f1 ON u.id = f1.following_id
LEFT JOIN follows f2 ON u.id = f2.follower_id
LEFT JOIN loop_stats ls ON l.id = ls.loop_id
GROUP BY u.id, u.username, u.display_name;

-- View for trending hashtags
CREATE VIEW trending_hashtags AS
SELECT 
    tag,
    usage_count,
    trending_score,
    CASE 
        WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 
            (usage_count * 2.0 + trending_score) 
        ELSE trending_score 
    END as current_trend_score
FROM hashtags
ORDER BY current_trend_score DESC;

-- View for loop trees with depth
CREATE VIEW loop_trees AS
WITH RECURSIVE tree AS (
    -- Base case: root loops
    SELECT 
        id, 
        author_id, 
        parent_id, 
        content_text,
        0 as depth,
        ARRAY[id] as path,
        id::text as sort_path
    FROM loops 
    WHERE parent_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child loops
    SELECT 
        l.id, 
        l.author_id, 
        l.parent_id, 
        l.content_text,
        t.depth + 1,
        t.path || l.id,
        t.sort_path || '.' || l.id::text
    FROM loops l
    JOIN tree t ON l.parent_id = t.id
)
SELECT * FROM tree ORDER BY sort_path;
