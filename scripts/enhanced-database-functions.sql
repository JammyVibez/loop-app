-- Enhanced Database Functions for 3D Social Platform
-- Run this after creating all tables and RLS policies

-- =============================================
-- USER LEVEL AND XP FUNCTIONS
-- =============================================

-- Function to calculate user level based on XP
CREATE OR REPLACE FUNCTION calculate_user_level(user_xp INTEGER)
RETURNS TABLE(level INTEGER, next_level_xp INTEGER) AS $$
DECLARE
    calculated_level INTEGER;
    next_xp INTEGER;
BEGIN
    -- Level calculation: Level = floor(sqrt(XP / 100))
    calculated_level := GREATEST(1, FLOOR(SQRT(user_xp / 100.0))::INTEGER);
    
    -- XP needed for next level
    next_xp := POWER(calculated_level + 1, 2) * 100;
    
    RETURN QUERY SELECT calculated_level, next_xp;
END;
$$ LANGUAGE plpgsql;

-- Function to award XP and update user level
CREATE OR REPLACE FUNCTION award_user_xp(
    target_user_id UUID,
    xp_amount INTEGER,
    reason TEXT DEFAULT 'Activity reward'
)
RETURNS void AS $$
DECLARE
    current_xp INTEGER;
    new_xp INTEGER;
    new_level INTEGER;
    old_level INTEGER;
BEGIN
    -- Get current XP and level
    SELECT xp_points, level INTO current_xp, old_level
    FROM profiles WHERE id = target_user_id;
    
    -- Calculate new XP
    new_xp := current_xp + xp_amount;
    
    -- Calculate new level
    SELECT level INTO new_level FROM calculate_user_level(new_xp);
    
    -- Update user profile
    UPDATE profiles 
    SET xp_points = new_xp, 
        level = new_level,
        updated_at = NOW()
    WHERE id = target_user_id;
    
    -- Log reputation change
    INSERT INTO reputation_logs (user_id, action_type, points_change, reason)
    VALUES (target_user_id, 'xp_awarded', xp_amount, reason);
    
    -- If level increased, create notification
    IF new_level > old_level THEN
        INSERT INTO notifications (
            user_id, type, title, message, data, animation_type, priority
        ) VALUES (
            target_user_id,
            'system',
            'Level Up!',
            'Congratulations! You reached level ' || new_level || '!',
            jsonb_build_object('old_level', old_level, 'new_level', new_level),
            'bounce',
            'high'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- THEME FUNCTIONS
-- =============================================

-- Function to get trending themes
CREATE OR REPLACE FUNCTION get_trending_themes(
    time_period VARCHAR DEFAULT '7d',
    theme_limit INTEGER DEFAULT 20,
    theme_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    theme_id UUID,
    name VARCHAR,
    download_count INTEGER,
    rating_average DECIMAL,
    trend_score DECIMAL
) AS $$
DECLARE
    time_filter TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Set time filter based on period
    CASE time_period
        WHEN '1d' THEN time_filter := NOW() - INTERVAL '1 day';
        WHEN '7d' THEN time_filter := NOW() - INTERVAL '7 days';
        WHEN '30d' THEN time_filter := NOW() - INTERVAL '30 days';
        ELSE time_filter := NOW() - INTERVAL '7 days';
    END CASE;

    RETURN QUERY
    SELECT 
        t.id as theme_id,
        t.name,
        t.download_count,
        t.rating_average,
        -- Calculate trend score based on downloads, ratings, and recency
        (
            t.download_count * 1.0 +
            t.rating_average * 20.0 +
            t.rating_count * 5.0
        ) * 
        -- Decay factor based on age
        GREATEST(0.1, 1.0 - EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 2592000.0) -- 30 days
        as trend_score
    FROM themes t
    WHERE t.is_active = true
    AND t.created_at >= time_filter
    ORDER BY trend_score DESC
    LIMIT theme_limit
    OFFSET theme_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to apply theme to user
CREATE OR REPLACE FUNCTION apply_user_theme(
    target_user_id UUID,
    target_theme_id UUID
)
RETURNS boolean AS $$
DECLARE
    theme_data JSONB;
    has_theme BOOLEAN := false;
BEGIN
    -- Check if user owns the theme
    SELECT EXISTS(
        SELECT 1 FROM user_inventory ui
        JOIN shop_items si ON ui.item_id = si.id
        WHERE ui.user_id = target_user_id 
        AND si.category = 'theme'
        AND ui.item_id = target_theme_id
    ) INTO has_theme;
    
    -- If user doesn't own theme, check if it's free
    IF NOT has_theme THEN
        SELECT EXISTS(
            SELECT 1 FROM themes 
            WHERE id = target_theme_id 
            AND price_coins = 0 
            AND price_usd = 0
        ) INTO has_theme;
    END IF;
    
    IF has_theme THEN
        -- Get theme data
        SELECT themes.theme_data INTO theme_data
        FROM themes WHERE id = target_theme_id;
        
        -- Update user's theme
        UPDATE profiles 
        SET theme_data = theme_data,
            updated_at = NOW()
        WHERE id = target_user_id;
        
        -- Deactivate previous theme in inventory
        UPDATE user_inventory 
        SET is_active = false 
        WHERE user_id = target_user_id 
        AND item_id IN (
            SELECT id FROM shop_items WHERE category = 'theme'
        );
        
        -- Activate new theme in inventory
        UPDATE user_inventory 
        SET is_active = true 
        WHERE user_id = target_user_id 
        AND item_id = target_theme_id;
        
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ACHIEVEMENT FUNCTIONS
-- =============================================

-- Function to check and unlock achievements
CREATE OR REPLACE FUNCTION check_user_achievements(target_user_id UUID)
RETURNS void AS $$
DECLARE
    achievement_record RECORD;
    user_stats RECORD;
    progress_data JSONB;
    is_unlocked BOOLEAN;
BEGIN
    -- Get user statistics
    SELECT 
        p.xp_points,
        p.level,
        p.loop_coins,
        (SELECT COUNT(*) FROM loops WHERE author_id = target_user_id) as loops_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = target_user_id) as following_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = target_user_id) as followers_count,
        (SELECT COUNT(*) FROM loop_interactions WHERE user_id = target_user_id AND interaction_type = 'like') as likes_given,
        (SELECT COUNT(*) FROM comments WHERE author_id = target_user_id) as comments_count
    INTO user_stats
    FROM profiles p WHERE p.id = target_user_id;
    
    -- Check each achievement
    FOR achievement_record IN 
        SELECT * FROM achievements WHERE is_active = true
    LOOP
        is_unlocked := false;
        progress_data := '{}';
        
        -- Check achievement requirements based on category
        CASE achievement_record.category
            WHEN 'social' THEN
                -- Example: "First Follow" achievement
                IF achievement_record.name = 'First Follow' AND user_stats.following_count >= 1 THEN
                    is_unlocked := true;
                    progress_data := jsonb_build_object('following_count', user_stats.following_count);
                END IF;
                
            WHEN 'content' THEN
                -- Example: "First Loop" achievement
                IF achievement_record.name = 'First Loop' AND user_stats.loops_count >= 1 THEN
                    is_unlocked := true;
                    progress_data := jsonb_build_object('loops_count', user_stats.loops_count);
                END IF;
                
            WHEN 'engagement' THEN
                -- Example: "Like Giver" achievement
                IF achievement_record.name = 'Like Giver' AND user_stats.likes_given >= 100 THEN
                    is_unlocked := true;
                    progress_data := jsonb_build_object('likes_given', user_stats.likes_given);
                END IF;
        END CASE;
        
        -- Insert or update achievement progress
        INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked_at)
        VALUES (target_user_id, achievement_record.id, progress_data, 
                CASE WHEN is_unlocked THEN NOW() ELSE NULL END)
        ON CONFLICT (user_id, achievement_id) 
        DO UPDATE SET 
            progress = EXCLUDED.progress,
            unlocked_at = CASE 
                WHEN user_achievements.unlocked_at IS NULL AND is_unlocked 
                THEN NOW() 
                ELSE user_achievements.unlocked_at 
            END;
        
        -- Award XP if newly unlocked
        IF is_unlocked AND NOT EXISTS(
            SELECT 1 FROM user_achievements 
            WHERE user_id = target_user_id 
            AND achievement_id = achievement_record.id 
            AND unlocked_at IS NOT NULL
        ) THEN
            PERFORM award_user_xp(
                target_user_id, 
                achievement_record.xp_reward, 
                'Achievement: ' || achievement_record.name
            );
            
            -- Create notification
            INSERT INTO notifications (
                user_id, type, title, message, data, animation_type, priority
            ) VALUES (
                target_user_id,
                'system',
                'Achievement Unlocked!',
                'You unlocked: ' || achievement_record.name,
                jsonb_build_object(
                    'achievement_id', achievement_record.id,
                    'achievement_name', achievement_record.name,
                    'xp_reward', achievement_record.xp_reward
                ),
                'bounce',
                'high'
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- CONTENT INTERACTION FUNCTIONS
-- =============================================

-- Enhanced function to handle loop interactions with achievements
CREATE OR REPLACE FUNCTION handle_loop_interaction(
    target_user_id UUID,
    target_loop_id UUID,
    interaction_type VARCHAR,
    is_adding BOOLEAN DEFAULT true
)
RETURNS void AS $$
BEGIN
    IF is_adding THEN
        -- Add interaction
        INSERT INTO loop_interactions (user_id, loop_id, interaction_type)
        VALUES (target_user_id, target_loop_id, interaction_type)
        ON CONFLICT (user_id, loop_id, interaction_type) DO NOTHING;
        
        -- Update stats
        CASE interaction_type
            WHEN 'like' THEN
                PERFORM increment_loop_likes(target_loop_id);
            WHEN 'save' THEN
                PERFORM increment_loop_saves(target_loop_id);
            WHEN 'share' THEN
                PERFORM increment_loop_shares(target_loop_id);
            WHEN 'view' THEN
                PERFORM increment_loop_views(target_loop_id);
        END CASE;
        
    ELSE
        -- Remove interaction
        DELETE FROM loop_interactions 
        WHERE user_id = target_user_id 
        AND loop_id = target_loop_id 
        AND interaction_type = interaction_type;
        
        -- Update stats
        CASE interaction_type
            WHEN 'like' THEN
                PERFORM decrement_loop_likes(target_loop_id);
            WHEN 'save' THEN
                PERFORM decrement_loop_saves(target_loop_id);
        END CASE;
    END IF;
    
    -- Check achievements after interaction
    PERFORM check_user_achievements(target_user_id);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- NOTIFICATION FUNCTIONS
-- =============================================

-- Function to create 3D notification
CREATE OR REPLACE FUNCTION create_3d_notification(
    target_user_id UUID,
    notification_type VARCHAR,
    title TEXT,
    message TEXT,
    data JSONB DEFAULT '{}',
    animation_type VARCHAR DEFAULT 'slide',
    priority VARCHAR DEFAULT 'normal',
    expires_hours INTEGER DEFAULT 168 -- 7 days
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO notifications (
        user_id, type, title, message, data, 
        animation_type, priority, expires_at
    ) VALUES (
        target_user_id, notification_type, title, message, data,
        animation_type, priority, NOW() + (expires_hours || ' hours')::INTERVAL
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger to automatically check achievements when user stats change
CREATE OR REPLACE FUNCTION trigger_achievement_check()
RETURNS TRIGGER AS $$
BEGIN
    -- Check achievements for the affected user
    PERFORM check_user_achievements(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS profiles_achievement_check ON profiles;
CREATE TRIGGER profiles_achievement_check
    AFTER UPDATE ON profiles
    FOR EACH ROW
    WHEN (OLD.xp_points != NEW.xp_points OR OLD.level != NEW.level)
    EXECUTE FUNCTION trigger_achievement_check();

-- Trigger to update user's last_active timestamp
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles 
    SET last_active = NOW() 
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for activity tracking
DROP TRIGGER IF EXISTS loops_activity_trigger ON loops;
CREATE TRIGGER loops_activity_trigger
    AFTER INSERT ON loops
    FOR EACH ROW
    EXECUTE FUNCTION update_last_active();

DROP TRIGGER IF EXISTS comments_activity_trigger ON comments;
CREATE TRIGGER comments_activity_trigger
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_last_active();

DROP TRIGGER IF EXISTS interactions_activity_trigger ON loop_interactions;
CREATE TRIGGER interactions_activity_trigger
    AFTER INSERT ON loop_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_last_active();
