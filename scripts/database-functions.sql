-- Database functions for Loop Social Platform
-- Run these in your Supabase SQL editor

-- Function to increment loop likes
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

-- Function to decrement loop likes
CREATE OR REPLACE FUNCTION decrement_loop_likes(loop_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE loop_stats 
    SET likes_count = GREATEST(0, likes_count - 1),
        updated_at = NOW()
    WHERE loop_stats.loop_id = decrement_loop_likes.loop_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment loop saves
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

-- Function to decrement loop saves
CREATE OR REPLACE FUNCTION decrement_loop_saves(loop_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE loop_stats 
    SET saves_count = GREATEST(0, saves_count - 1),
        updated_at = NOW()
    WHERE loop_stats.loop_id = decrement_loop_saves.loop_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment loop shares
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

-- Function to increment loop comments
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

-- Function to increment loop branches
CREATE OR REPLACE FUNCTION increment_loop_branches(loop_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO loop_stats (loop_id, branches_count, updated_at)
    VALUES (loop_id, 1, NOW())
    ON CONFLICT (loop_id)
    DO UPDATE SET 
        branches_count = loop_stats.branches_count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to increment loop views
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

-- Function to get user feed with personalization
CREATE OR REPLACE FUNCTION get_user_feed(
    user_id UUID,
    feed_limit INTEGER DEFAULT 20,
    feed_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    loop_id UUID,
    author_id UUID,
    content_type VARCHAR,
    content_text TEXT,
    content_media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    likes_count INTEGER,
    comments_count INTEGER,
    branches_count INTEGER,
    author_username VARCHAR,
    author_display_name VARCHAR,
    author_avatar_url TEXT,
    is_liked BOOLEAN,
    is_saved BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id as loop_id,
        l.author_id,
        l.content_type,
        l.content_text,
        l.content_media_url,
        l.created_at,
        COALESCE(ls.likes_count, 0) as likes_count,
        COALESCE(ls.comments_count, 0) as comments_count,
        COALESCE(ls.branches_count, 0) as branches_count,
        u.username as author_username,
        u.display_name as author_display_name,
        u.avatar_url as author_avatar_url,
        EXISTS(
            SELECT 1 FROM loop_interactions li 
            WHERE li.loop_id = l.id 
            AND li.user_id = get_user_feed.user_id 
            AND li.interaction_type = 'like'
        ) as is_liked,
        EXISTS(
            SELECT 1 FROM loop_interactions li 
            WHERE li.loop_id = l.id 
            AND li.user_id = get_user_feed.user_id 
            AND li.interaction_type = 'save'
        ) as is_saved
    FROM loops l
    LEFT JOIN loop_stats ls ON l.id = ls.loop_id
    LEFT JOIN profiles u ON l.author_id = u.id
    WHERE l.visibility = 'public'
    AND (
        -- User's own loops
        l.author_id = get_user_feed.user_id
        OR
        -- Loops from followed users
        l.author_id IN (
            SELECT f.following_id 
            FROM follows f 
            WHERE f.follower_id = get_user_feed.user_id
        )
        OR
        -- Popular loops (fallback for new users)
        ls.likes_count > 10
    )
    ORDER BY 
        -- Prioritize recent loops from followed users
        CASE 
            WHEN l.author_id IN (
                SELECT f.following_id 
                FROM follows f 
                WHERE f.follower_id = get_user_feed.user_id
            ) THEN l.created_at
            ELSE l.created_at - INTERVAL '1 day'
        END DESC
    LIMIT feed_limit
    OFFSET feed_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get trending loops
CREATE OR REPLACE FUNCTION get_trending_loops(
    time_period VARCHAR DEFAULT '24h',
    trend_limit INTEGER DEFAULT 20,
    trend_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    loop_id UUID,
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
    -- Set time filter based on period
    CASE time_period
        WHEN '1h' THEN time_filter := NOW() - INTERVAL '1 hour';
        WHEN '6h' THEN time_filter := NOW() - INTERVAL '6 hours';
        WHEN '24h' THEN time_filter := NOW() - INTERVAL '24 hours';
        WHEN '7d' THEN time_filter := NOW() - INTERVAL '7 days';
        ELSE time_filter := NOW() - INTERVAL '24 hours';
    END CASE;

    RETURN QUERY
    SELECT 
        l.id as loop_id,
        l.author_id,
        l.content_type,
        l.content_text,
        l.content_media_url,
        l.created_at,
        COALESCE(ls.likes_count, 0) as likes_count,
        COALESCE(ls.comments_count, 0) as comments_count,
        COALESCE(ls.branches_count, 0) as branches_count,
        -- Calculate trend score based on engagement and recency
        (
            COALESCE(ls.likes_count, 0) * 1.0 +
            COALESCE(ls.comments_count, 0) * 2.0 +
            COALESCE(ls.branches_count, 0) * 3.0 +
            COALESCE(ls.shares_count, 0) * 1.5
        ) * 
        -- Decay factor based on age
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
