
-- =============================================
-- ACHIEVEMENTS SYSTEM IMPLEMENTATION
-- =============================================

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('social', 'content', 'engagement', 'special', 'milestone')),
    level TEXT NOT NULL CHECK (level IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
    xp_reward INTEGER DEFAULT 0,
    coins_reward INTEGER DEFAULT 0,
    icon TEXT,
    requirements JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    progress JSONB DEFAULT '{}',
    UNIQUE(user_id, achievement_id)
);

-- Create user stats table for tracking achievement progress
CREATE TABLE IF NOT EXISTS user_stats (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    loops_created INTEGER DEFAULT 0,
    total_likes_received INTEGER DEFAULT 0,
    total_comments_received INTEGER DEFAULT 0,
    total_shares_received INTEGER DEFAULT 0,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    loops_liked INTEGER DEFAULT 0,
    comments_made INTEGER DEFAULT 0,
    consecutive_days_active INTEGER DEFAULT 0,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert achievement levels and rewards
INSERT INTO achievements (name, description, category, level, xp_reward, coins_reward, icon, requirements) VALUES
-- Social Achievements - Bronze Level
('First Follow', 'Follow your first user', 'social', 'bronze', 50, 10, '👥', '{"following_count": 1}'),
('First Follower', 'Get your first follower', 'social', 'bronze', 100, 20, '🌟', '{"followers_count": 1}'),
('Social Starter', 'Reach 10 followers', 'social', 'bronze', 200, 50, '🚀', '{"followers_count": 10}'),

-- Social Achievements - Silver Level  
('Popular User', 'Reach 100 followers', 'social', 'silver', 500, 100, '⭐', '{"followers_count": 100}'),
('Community Builder', 'Follow 50 users', 'social', 'silver', 300, 75, '🏗️', '{"following_count": 50}'),

-- Social Achievements - Gold Level
('Influencer', 'Reach 1000 followers', 'social', 'gold', 1000, 250, '👑', '{"followers_count": 1000}'),
('Super Connector', 'Follow 200 users', 'social', 'gold', 750, 200, '🌐', '{"following_count": 200}'),

-- Social Achievements - Platinum Level
('Celebrity Status', 'Reach 10,000 followers', 'social', 'platinum', 2500, 500, '🎭', '{"followers_count": 10000}'),

-- Social Achievements - Diamond Level
('Legendary Influencer', 'Reach 100,000 followers', 'social', 'diamond', 10000, 2000, '💎', '{"followers_count": 100000}'),

-- Content Achievements - Bronze Level
('First Loop', 'Create your first loop', 'content', 'bronze', 100, 25, '🌱', '{"loops_created": 1}'),
('Loop Creator', 'Create 10 loops', 'content', 'bronze', 250, 50, '📝', '{"loops_created": 10}'),

-- Content Achievements - Silver Level
('Prolific Creator', 'Create 50 loops', 'content', 'silver', 500, 125, '✍️', '{"loops_created": 50}'),
('Content Machine', 'Create 100 loops', 'content', 'silver', 750, 200, '⚡', '{"loops_created": 100}'),

-- Content Achievements - Gold Level
('Master Creator', 'Create 500 loops', 'content', 'gold', 1500, 400, '🎨', '{"loops_created": 500}'),

-- Content Achievements - Platinum Level
('Content Virtuoso', 'Create 1000 loops', 'content', 'platinum', 3000, 750, '🎪', '{"loops_created": 1000}'),

-- Content Achievements - Diamond Level
('Content Deity', 'Create 5000 loops', 'content', 'diamond', 15000, 3000, '👑', '{"loops_created": 5000}'),

-- Engagement Achievements - Bronze Level
('First Like', 'Receive your first like', 'engagement', 'bronze', 50, 10, '❤️', '{"total_likes_received": 1}'),
('Popular Post', 'Get 100 likes on your content', 'engagement', 'bronze', 200, 40, '🔥', '{"total_likes_received": 100}'),

-- Engagement Achievements - Silver Level
('Viral Content', 'Get 1000 likes on your content', 'engagement', 'silver', 500, 100, '🚀', '{"total_likes_received": 1000}'),
('Conversation Starter', 'Receive 100 comments', 'engagement', 'silver', 400, 80, '💬', '{"total_comments_received": 100}'),

-- Engagement Achievements - Gold Level
('Engagement Master', 'Get 10,000 likes on your content', 'engagement', 'gold', 1250, 300, '⚡', '{"total_likes_received": 10000}'),
('Discussion Leader', 'Receive 1000 comments', 'engagement', 'gold', 1000, 250, '🗣️', '{"total_comments_received": 1000}'),

-- Engagement Achievements - Platinum Level
('Viral Sensation', 'Get 100,000 likes on your content', 'engagement', 'platinum', 5000, 1000, '🌟', '{"total_likes_received": 100000}'),

-- Engagement Achievements - Diamond Level
('Internet Legend', 'Get 1,000,000 likes on your content', 'engagement', 'diamond', 25000, 5000, '💎', '{"total_likes_received": 1000000}'),

-- Special Achievements
('Beta Tester', 'Early platform adopter', 'special', 'gold', 1000, 500, '🧪', '{"special": "beta_user"}'),
('Premium Member', 'Subscribe to premium', 'special', 'silver', 500, 100, '👑', '{"special": "premium_user"}'),
('Daily Streaker', 'Active for 30 consecutive days', 'special', 'gold', 1500, 300, '🔥', '{"consecutive_days_active": 30}'),

-- Milestone Achievements
('Level Up', 'Reach level 10', 'milestone', 'bronze', 250, 50, '📈', '{"level": 10}'),
('High Achiever', 'Reach level 25', 'milestone', 'silver', 750, 150, '🎯', '{"level": 25}'),
('Elite Member', 'Reach level 50', 'milestone', 'gold', 2000, 400, '🏆', '{"level": 50}'),
('Master Level', 'Reach level 100', 'milestone', 'platinum', 5000, 1000, '👑', '{"level": 100}')
ON CONFLICT (name) DO NOTHING;

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION check_user_achievements(target_user_id UUID)
RETURNS void AS $$
DECLARE
    achievement_record RECORD;
    user_stat RECORD;
    requirement_key TEXT;
    requirement_value INTEGER;
    meets_requirement BOOLEAN;
BEGIN
    -- Get current user stats
    SELECT * INTO user_stat FROM user_stats WHERE user_id = target_user_id;
    
    -- If no stats record exists, create one
    IF user_stat IS NULL THEN
        INSERT INTO user_stats (user_id) VALUES (target_user_id);
        SELECT * INTO user_stat FROM user_stats WHERE user_id = target_user_id;
    END IF;
    
    -- Check each active achievement
    FOR achievement_record IN 
        SELECT * FROM achievements 
        WHERE is_active = true 
        AND id NOT IN (
            SELECT achievement_id FROM user_achievements 
            WHERE user_id = target_user_id
        )
    LOOP
        meets_requirement := true;
        
        -- Check each requirement in the achievement
        FOR requirement_key, requirement_value IN 
            SELECT * FROM jsonb_each_text(achievement_record.requirements)
        LOOP
            CASE requirement_key
                WHEN 'loops_created' THEN
                    IF user_stat.loops_created < requirement_value::INTEGER THEN
                        meets_requirement := false;
                        EXIT;
                    END IF;
                WHEN 'total_likes_received' THEN
                    IF user_stat.total_likes_received < requirement_value::INTEGER THEN
                        meets_requirement := false;
                        EXIT;
                    END IF;
                WHEN 'total_comments_received' THEN
                    IF user_stat.total_comments_received < requirement_value::INTEGER THEN
                        meets_requirement := false;
                        EXIT;
                    END IF;
                WHEN 'followers_count' THEN
                    IF user_stat.followers_count < requirement_value::INTEGER THEN
                        meets_requirement := false;
                        EXIT;
                    END IF;
                WHEN 'following_count' THEN
                    IF user_stat.following_count < requirement_value::INTEGER THEN
                        meets_requirement := false;
                        EXIT;
                    END IF;
                WHEN 'level' THEN
                    IF user_stat.level < requirement_value::INTEGER THEN
                        meets_requirement := false;
                        EXIT;
                    END IF;
                WHEN 'consecutive_days_active' THEN
                    IF user_stat.consecutive_days_active < requirement_value::INTEGER THEN
                        meets_requirement := false;
                        EXIT;
                    END IF;
            END CASE;
        END LOOP;
        
        -- Award achievement if requirements are met
        IF meets_requirement THEN
            INSERT INTO user_achievements (user_id, achievement_id)
            VALUES (target_user_id, achievement_record.id)
            ON CONFLICT DO NOTHING;
            
            -- Award XP and coins
            UPDATE user_stats 
            SET 
                total_xp = total_xp + achievement_record.xp_reward,
                level = GREATEST(level, (total_xp + achievement_record.xp_reward) / 1000 + 1)
            WHERE user_id = target_user_id;
            
            UPDATE profiles 
            SET loop_coins = loop_coins + achievement_record.coins_reward
            WHERE id = target_user_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update user stats and check achievements
CREATE OR REPLACE FUNCTION update_user_stats_and_check_achievements(
    target_user_id UUID,
    stat_type TEXT,
    increment_value INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
    -- Insert or update user stats
    INSERT INTO user_stats (user_id, loops_created, total_likes_received, total_comments_received, followers_count, following_count)
    VALUES (target_user_id, 0, 0, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Update specific stat
    CASE stat_type
        WHEN 'loops_created' THEN
            UPDATE user_stats SET loops_created = loops_created + increment_value WHERE user_id = target_user_id;
        WHEN 'likes_received' THEN
            UPDATE user_stats SET total_likes_received = total_likes_received + increment_value WHERE user_id = target_user_id;
        WHEN 'comments_received' THEN
            UPDATE user_stats SET total_comments_received = total_comments_received + increment_value WHERE user_id = target_user_id;
        WHEN 'follower_gained' THEN
            UPDATE user_stats SET followers_count = followers_count + increment_value WHERE user_id = target_user_id;
        WHEN 'following_added' THEN
            UPDATE user_stats SET following_count = following_count + increment_value WHERE user_id = target_user_id;
    END CASE;
    
    -- Update timestamp
    UPDATE user_stats SET updated_at = NOW() WHERE user_id = target_user_id;
    
    -- Check for new achievements
    PERFORM check_user_achievements(target_user_id);
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_level ON achievements(level);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
