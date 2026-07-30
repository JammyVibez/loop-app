-- Loop Social Media Platform Database Schema v2
-- Complete schema with all features
-- Run this in your Supabase SQL editor or PostgreSQL database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    profile_theme JSONB DEFAULT '{}',
    is_verified BOOLEAN DEFAULT FALSE,
    verification_level VARCHAR(20) CHECK (verification_level IN ('root', 'influencer')),
    is_premium BOOLEAN DEFAULT FALSE,
    premium_expires_at TIMESTAMP,
    loop_coins INTEGER DEFAULT 0,
    location VARCHAR(100),
    website VARCHAR(255),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Loops table with tree structure
CREATE TABLE loops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    parent_loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('text', 'image', 'video', 'audio')),
    content JSONB NOT NULL,
    hashtags TEXT[],
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'circle')),
    circle_id UUID,
    is_root BOOLEAN DEFAULT TRUE,
    tree_depth INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Loop statistics
CREATE TABLE loop_stats (
    loop_id UUID PRIMARY KEY REFERENCES loops(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    branches_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User interactions with loops
CREATE TABLE loop_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('like', 'save', 'view', 'share')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, loop_id, interaction_type)
);

-- Comments on loops
CREATE TABLE loop_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES loop_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Circles (communities)
CREATE TABLE circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    category VARCHAR(50),
    is_private BOOLEAN DEFAULT FALSE,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    member_count INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Circle memberships
CREATE TABLE circle_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'banned')),
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(circle_id, user_id)
);

-- Circle challenges
CREATE TABLE circle_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    rules TEXT,
    starts_at TIMESTAMP DEFAULT NOW(),
    ends_at TIMESTAMP,
    prize_description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Messages and conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    title VARCHAR(100),
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversation participants
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    last_read_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'loop_share')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User follows
CREATE TABLE user_follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Shop items
CREATE TABLE shop_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    price INTEGER NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    item_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User purchases
CREATE TABLE user_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    shop_item_id UUID REFERENCES shop_items(id) ON DELETE CASCADE,
    price_paid INTEGER NOT NULL,
    purchased_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, shop_item_id)
);

-- Trending hashtags
CREATE TABLE trending_hashtags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hashtag VARCHAR(100) NOT NULL,
    usage_count INTEGER DEFAULT 0,
    growth_rate DECIMAL(5,2) DEFAULT 0,
    timeframe VARCHAR(10) NOT NULL CHECK (timeframe IN ('1h', '24h', '7d', '30d')),
    calculated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(hashtag, timeframe)
);

-- Developer projects
CREATE TABLE developer_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    language VARCHAR(50),
    framework VARCHAR(50),
    tags TEXT[],
    code_snippet TEXT NOT NULL,
    repository_url TEXT,
    demo_url TEXT,
    stars_count INTEGER DEFAULT 0,
    forks_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Project interactions
CREATE TABLE project_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES developer_projects(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('star', 'fork', 'view')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, project_id, interaction_type)
);

-- Indexes for performance
CREATE INDEX idx_loops_author_id ON loops(author_id);
CREATE INDEX idx_loops_parent_loop_id ON loops(parent_loop_id);
CREATE INDEX idx_loops_created_at ON loops(created_at DESC);
CREATE INDEX idx_loops_hashtags ON loops USING GIN(hashtags);
CREATE INDEX idx_loop_interactions_user_id ON loop_interactions(user_id);
CREATE INDEX idx_loop_interactions_loop_id ON loop_interactions(loop_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following_id ON user_follows(following_id);

-- Functions to update statistics
CREATE OR REPLACE FUNCTION update_loop_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Update parent loop branch count
        IF NEW.parent_loop_id IS NOT NULL THEN
            UPDATE loop_stats 
            SET branches_count = branches_count + 1,
                updated_at = NOW()
            WHERE loop_id = NEW.parent_loop_id;
        END IF;
        
        -- Create stats record for new loop
        INSERT INTO loop_stats (loop_id) VALUES (NEW.id);
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Update parent loop branch count
        IF OLD.parent_loop_id IS NOT NULL THEN
            UPDATE loop_stats 
            SET branches_count = branches_count - 1,
                updated_at = NOW()
            WHERE loop_id = OLD.parent_loop_id;
        END IF;
        
        -- Delete stats record
        DELETE FROM loop_stats WHERE loop_id = OLD.id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for loop statistics
CREATE TRIGGER trigger_update_loop_stats
    AFTER INSERT OR DELETE ON loops
    FOR EACH ROW
    EXECUTE FUNCTION update_loop_stats();

-- Function to update interaction counts
CREATE OR REPLACE FUNCTION update_interaction_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        CASE NEW.interaction_type
            WHEN 'like' THEN
                UPDATE loop_stats SET likes_count = likes_count + 1, updated_at = NOW() WHERE loop_id = NEW.loop_id;
            WHEN 'save' THEN
                UPDATE loop_stats SET saves_count = saves_count + 1, updated_at = NOW() WHERE loop_id = NEW.loop_id;
            WHEN 'view' THEN
                UPDATE loop_stats SET views_count = views_count + 1, updated_at = NOW() WHERE loop_id = NEW.loop_id;
            WHEN 'share' THEN
                UPDATE loop_stats SET shares_count = shares_count + 1, updated_at = NOW() WHERE loop_id = NEW.loop_id;
        END CASE;
    ELSIF TG_OP = 'DELETE' THEN
        CASE OLD.interaction_type
            WHEN 'like' THEN
                UPDATE loop_stats SET likes_count = likes_count - 1, updated_at = NOW() WHERE loop_id = OLD.loop_id;
            WHEN 'save' THEN
                UPDATE loop_stats SET saves_count = saves_count - 1, updated_at = NOW() WHERE loop_id = OLD.loop_id;
            WHEN 'share' THEN
                UPDATE loop_stats SET shares_count = shares_count - 1, updated_at = NOW() WHERE loop_id = OLD.loop_id;
        END CASE;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for interaction statistics
CREATE TRIGGER trigger_update_interaction_stats
    AFTER INSERT OR DELETE ON loop_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_interaction_stats();

-- Function to update circle member count
CREATE OR REPLACE FUNCTION update_circle_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        UPDATE circles SET member_count = member_count + 1 WHERE id = NEW.circle_id;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
        UPDATE circles SET member_count = member_count - 1 WHERE id = OLD.circle_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != 'active' AND NEW.status = 'active' THEN
            UPDATE circles SET member_count = member_count + 1 WHERE id = NEW.circle_id;
        ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
            UPDATE circles SET member_count = member_count - 1 WHERE id = NEW.circle_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for circle member count
CREATE TRIGGER trigger_update_circle_member_count
    AFTER INSERT OR UPDATE OR DELETE ON circle_members
    FOR EACH ROW
    EXECUTE FUNCTION update_circle_member_count();
