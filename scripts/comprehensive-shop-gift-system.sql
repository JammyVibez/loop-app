
-- =============================================
-- COMPREHENSIVE SHOP, GIFT & NOTIFICATION SYSTEM
-- =============================================

-- Create enhanced enums
DO $$ BEGIN
    CREATE TYPE shop_category AS ENUM ('theme', 'animation', 'effect', 'coins', 'premium', 'badge', 'avatar', 'banner');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gift_type AS ENUM ('coins', 'premium', 'theme', 'animation', 'effect', 'badge', 'avatar_accessory', 'special');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gift_status AS ENUM ('sent', 'delivered', 'claimed', 'expired', 'declined');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('like', 'comment', 'follow', 'gift_received', 'gift_sent', 'mention', 'system', 'achievement', 'quest_complete', 'weekly_bonus', 'purchase_success', 'premium_granted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enhanced shop items table
CREATE TABLE IF NOT EXISTS shop_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    price_coins INTEGER,
    price_usd DECIMAL(10,2),
    category shop_category NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    premium_only BOOLEAN DEFAULT FALSE,
    item_data JSONB NOT NULL DEFAULT '{}',
    preview_data JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    purchase_count INTEGER DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0.0,
    rating_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (price_coins IS NOT NULL OR price_usd IS NOT NULL)
);

-- Enhanced user inventory table
CREATE TABLE IF NOT EXISTS user_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_id UUID REFERENCES shop_items(id) ON DELETE CASCADE,
    item_name VARCHAR(100) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    item_data JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT FALSE,
    is_equipped BOOLEAN DEFAULT FALSE,
    source VARCHAR(20) DEFAULT 'purchase' CHECK (source IN ('purchase', 'gift', 'reward', 'achievement')),
    gift_id UUID,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    UNIQUE(user_id, item_id)
);

-- Enhanced gifts table
CREATE TABLE IF NOT EXISTS gifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    gift_type gift_type NOT NULL,
    gift_name VARCHAR(100) NOT NULL,
    gift_value JSONB NOT NULL DEFAULT '{}',
    cost INTEGER NOT NULL,
    message TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    status gift_status DEFAULT 'sent',
    context_type VARCHAR(20) CHECK (context_type IN ('post', 'profile', 'comment', 'reel', 'loop')),
    context_id UUID,
    effects JSONB DEFAULT '{}',
    delivered_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    declined_at TIMESTAMP WITH TIME ZONE,
    decline_reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    is_pushed BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
    expires_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quest rewards table
CREATE TABLE IF NOT EXISTS quest_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    quest_type VARCHAR(50) NOT NULL,
    reward_amount INTEGER NOT NULL,
    reward_type VARCHAR(20) DEFAULT 'coins' CHECK (reward_type IN ('coins', 'xp', 'premium_days')),
    is_redeemed BOOLEAN DEFAULT FALSE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    redeemed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- Weekly bonus claims table
CREATE TABLE IF NOT EXISTS weekly_bonus_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    bonus_amount INTEGER NOT NULL DEFAULT 500,
    week_start DATE NOT NULL DEFAULT DATE_TRUNC('week', NOW()),
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

-- Coin transactions table for tracking
CREATE TABLE IF NOT EXISTS coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('purchase', 'gift_sent', 'gift_received', 'quest_reward', 'weekly_bonus', 'admin_grant', 'premium_purchase', 'refund')),
    description TEXT,
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert comprehensive shop items
INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, item_data, preview_data) VALUES
-- Themes
('Cyberpunk Neon', 'Futuristic neon cyberpunk theme with glowing effects', 800, 'theme', 'profile_theme', 'epic', '{"colors": {"primary": "#00ff88", "secondary": "#ff0080", "accent": "#00ccff"}, "effects": ["neon_glow", "matrix_rain"]}', '{"preview": "linear-gradient(45deg, #00ff88, #ff0080)"}'),
('Dragon Lord', 'Majestic dragon-inspired theme with fire effects', 1200, 'theme', 'profile_theme', 'legendary', '{"colors": {"primary": "#ff4500", "secondary": "#8b0000", "accent": "#ffd700"}, "effects": ["fire_particles", "dragon_roar"]}', '{"preview": "linear-gradient(45deg, #ff4500, #8b0000)"}'),
('Forest Guardian', 'Nature-inspired theme with earth tones', 600, 'theme', 'profile_theme', 'rare', '{"colors": {"primary": "#228b22", "secondary": "#32cd32", "accent": "#98fb98"}, "effects": ["leaf_fall", "nature_sounds"]}', '{"preview": "linear-gradient(45deg, #228b22, #32cd32)"}'),
('Ocean Depths', 'Deep sea theme with wave animations', 500, 'theme', 'profile_theme', 'rare', '{"colors": {"primary": "#0066cc", "secondary": "#4169e1", "accent": "#87ceeb"}, "effects": ["wave_motion", "bubble_stream"]}', '{"preview": "linear-gradient(45deg, #0066cc, #4169e1)"}'),
('Royal Purple', 'Elegant royal theme with gold accents', 400, 'theme', 'profile_theme', 'common', '{"colors": {"primary": "#6a0dad", "secondary": "#9370db", "accent": "#ffd700"}, "effects": ["sparkle_trail"]}', '{"preview": "linear-gradient(45deg, #6a0dad, #9370db)"}'),

-- Animations & Effects
('Sparkle Trail', 'Magical sparkles follow your cursor', 300, 'animation', 'cursor_effect', 'common', '{"effect": "sparkle_trail", "duration": "infinite", "color": "#ffd700"}', '{"preview": "✨"}'),
('Fire Wings', 'Flaming wings animation for avatars', 800, 'animation', 'avatar_effect', 'epic', '{"effect": "fire_wings", "duration": "3s", "intensity": "high"}', '{"preview": "🔥"}'),
('Lightning Aura', 'Electric lightning surrounding effect', 600, 'effect', 'aura_effect', 'rare', '{"effect": "lightning_aura", "color": "#00ffff", "intensity": "medium"}', '{"preview": "⚡"}'),
('Rainbow Trail', 'Colorful rainbow following effect', 250, 'animation', 'movement_effect', 'common', '{"effect": "rainbow_trail", "colors": ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#8b00ff"]}', '{"preview": "🌈"}'),

-- Badges
('Early Adopter', 'Special badge for early platform users', 1000, 'badge', 'achievement_badge', 'legendary', '{"badge_text": "Early Adopter", "icon": "star", "color": "#ffd700"}', '{"preview": "⭐"}'),
('Content Creator', 'Badge for active content creators', 500, 'badge', 'role_badge', 'rare', '{"badge_text": "Creator", "icon": "edit", "color": "#ff6b35"}', '{"preview": "🎨"}'),
('Super Supporter', 'Badge for users who support others', 300, 'badge', 'social_badge', 'common', '{"badge_text": "Supporter", "icon": "heart", "color": "#ff1493"}', '{"preview": "❤️"}'),

-- Avatar Accessories
('Golden Crown', 'Majestic golden crown for avatars', 1500, 'avatar', 'accessory', 'legendary', '{"accessory_type": "crown", "material": "gold", "glow": true}', '{"preview": "👑"}'),
('Wizard Hat', 'Magical wizard hat with stars', 600, 'avatar', 'accessory', 'rare', '{"accessory_type": "hat", "design": "wizard", "effects": ["star_particles"]}', '{"preview": "🧙"}'),
('Cool Sunglasses', 'Stylish sunglasses for avatars', 200, 'avatar', 'accessory', 'common', '{"accessory_type": "glasses", "style": "cool", "tint": "dark"}', '{"preview": "😎"}'),

-- Coin Packages
('Starter Pack', '1000 Loop Coins + 200 bonus', 0, 'coins', 'currency', 'common', '{"coins_amount": 1000, "bonus": 200}', '{"preview": "💰"}'),
('Popular Pack', '2500 Loop Coins + 750 bonus', 0, 'coins', 'currency', 'rare', '{"coins_amount": 2500, "bonus": 750}', '{"preview": "💎"}'),
('Mega Pack', '5000 Loop Coins + 2000 bonus', 0, 'coins', 'currency', 'epic', '{"coins_amount": 5000, "bonus": 2000}', '{"preview": "🏆"}'),
('Ultimate Pack', '10000 Loop Coins + 5000 bonus', 0, 'coins', 'currency', 'legendary', '{"coins_amount": 10000, "bonus": 5000}', '{"preview": "💠"}'),

-- Premium Packages
('Premium 1 Month', 'One month of premium access', 1500, 'premium', 'subscription', 'rare', '{"duration": "1 month", "features": ["ad_free", "exclusive_themes", "priority_support"]}', '{"preview": "👑"}'),
('Premium 3 Months', 'Three months of premium access', 4000, 'premium', 'subscription', 'epic', '{"duration": "3 months", "features": ["ad_free", "exclusive_themes", "priority_support", "exclusive_badges"]}', '{"preview": "💫"}'),
('Premium 1 Year', 'Full year of premium access', 12000, 'premium', 'subscription', 'legendary', '{"duration": "1 year", "features": ["ad_free", "exclusive_themes", "priority_support", "exclusive_badges", "custom_animations"]}', '{"preview": "🌟"}')

ON CONFLICT (name) DO NOTHING;

-- Update coin packages with USD prices
UPDATE shop_items SET price_usd = 4.99 WHERE name = 'Starter Pack';
UPDATE shop_items SET price_usd = 9.99 WHERE name = 'Popular Pack';
UPDATE shop_items SET price_usd = 19.99 WHERE name = 'Mega Pack';
UPDATE shop_items SET price_usd = 39.99 WHERE name = 'Ultimate Pack';

UPDATE shop_items SET price_usd = 14.99 WHERE name = 'Premium 1 Month';
UPDATE shop_items SET price_usd = 39.99 WHERE name = 'Premium 3 Months';
UPDATE shop_items SET price_usd = 119.99 WHERE name = 'Premium 1 Year';

-- Create comprehensive gift catalog
INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, item_data, preview_data) VALUES
-- Giftable Items
('Gift: 100 Coins', 'Send 100 Loop Coins as a gift', 100, 'coins', 'gift_currency', 'common', '{"coins_amount": 100, "is_giftable": true}', '{"preview": "🪙"}'),
('Gift: 500 Coins', 'Send 500 Loop Coins as a gift', 500, 'coins', 'gift_currency', 'common', '{"coins_amount": 500, "is_giftable": true}', '{"preview": "💰"}'),
('Gift: 1000 Coins', 'Send 1000 Loop Coins as a gift', 1000, 'coins', 'gift_currency', 'rare', '{"coins_amount": 1000, "is_giftable": true}', '{"preview": "💎"}'),

('Gift: Rose Bouquet', 'Beautiful digital rose bouquet', 200, 'badge', 'gift_item', 'common', '{"gift_type": "rose_bouquet", "animation": "petal_fall", "is_giftable": true}', '{"preview": "🌹"}'),
('Gift: Chocolate Box', 'Sweet chocolate gift box', 150, 'badge', 'gift_item', 'common', '{"gift_type": "chocolate", "animation": "sweet_sparkle", "is_giftable": true}', '{"preview": "🍫"}'),
('Gift: Golden Trophy', 'Prestigious golden trophy', 800, 'badge', 'gift_item', 'epic', '{"gift_type": "trophy", "material": "gold", "animation": "victory_glow", "is_giftable": true}', '{"preview": "🏆"}'),
('Gift: Rainbow Unicorn', 'Magical rainbow unicorn', 1200, 'badge', 'gift_item', 'legendary', '{"gift_type": "unicorn", "animation": "rainbow_trail", "rarity": "legendary", "is_giftable": true}', '{"preview": "🦄"}')

ON CONFLICT (name) DO NOTHING;

-- Create comprehensive functions for gift system
CREATE OR REPLACE FUNCTION send_gift(
    p_sender_id UUID,
    p_recipient_id UUID,
    p_gift_type gift_type,
    p_gift_name TEXT,
    p_gift_value JSONB,
    p_cost INTEGER,
    p_message TEXT DEFAULT NULL,
    p_is_anonymous BOOLEAN DEFAULT FALSE,
    p_context_type TEXT DEFAULT NULL,
    p_context_id UUID DEFAULT NULL,
    p_effects JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    gift_id UUID;
    sender_balance INTEGER;
BEGIN
    -- Check sender's balance
    SELECT loop_coins INTO sender_balance FROM profiles WHERE id = p_sender_id;
    
    IF sender_balance < p_cost THEN
        RAISE EXCEPTION 'Insufficient Loop Coins balance';
    END IF;
    
    -- Deduct cost from sender
    UPDATE profiles 
    SET loop_coins = loop_coins - p_cost 
    WHERE id = p_sender_id;
    
    -- Create gift record
    INSERT INTO gifts (
        sender_id, recipient_id, gift_type, gift_name, gift_value, 
        cost, message, is_anonymous, context_type, context_id, effects
    ) VALUES (
        p_sender_id, p_recipient_id, p_gift_type, p_gift_name, p_gift_value,
        p_cost, p_message, p_is_anonymous, p_context_type, p_context_id, p_effects
    ) RETURNING id INTO gift_id;
    
    -- Create notification for recipient
    INSERT INTO notifications (user_id, type, title, message, data) VALUES (
        p_recipient_id,
        'gift_received',
        'You received a gift!',
        CASE 
            WHEN p_is_anonymous THEN 'Someone sent you ' || p_gift_name
            ELSE (SELECT display_name FROM profiles WHERE id = p_sender_id) || ' sent you ' || p_gift_name
        END,
        jsonb_build_object(
            'gift_id', gift_id,
            'gift_type', p_gift_type,
            'gift_name', p_gift_name,
            'sender_id', CASE WHEN p_is_anonymous THEN NULL ELSE p_sender_id END,
            'is_anonymous', p_is_anonymous,
            'effects', p_effects
        )
    );
    
    -- Record transaction
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
    VALUES (p_sender_id, -p_cost, 'gift_sent', 'Sent ' || p_gift_name || ' gift', gift_id);
    
    RETURN gift_id;
END;
$$ LANGUAGE plpgsql;

-- Function to claim/accept gift
CREATE OR REPLACE FUNCTION claim_gift(
    p_gift_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    gift_record gifts;
    gift_value JSONB;
    coins_amount INTEGER;
BEGIN
    -- Get gift details
    SELECT * INTO gift_record FROM gifts 
    WHERE id = p_gift_id AND recipient_id = p_user_id AND status = 'sent';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gift not found or already processed';
    END IF;
    
    -- Check if gift is expired
    IF gift_record.expires_at < NOW() THEN
        UPDATE gifts SET status = 'expired' WHERE id = p_gift_id;
        RAISE EXCEPTION 'Gift has expired';
    END IF;
    
    -- Process gift based on type
    CASE gift_record.gift_type
        WHEN 'coins' THEN
            coins_amount := (gift_record.gift_value->>'coins_amount')::INTEGER;
            UPDATE profiles SET loop_coins = loop_coins + coins_amount WHERE id = p_user_id;
            
            -- Record transaction
            INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
            VALUES (p_user_id, coins_amount, 'gift_received', 'Received ' || gift_record.gift_name || ' gift', p_gift_id);
            
        WHEN 'premium' THEN
            -- Grant premium access
            UPDATE profiles 
            SET is_premium = TRUE,
                premium_until = COALESCE(premium_until, NOW()) + 
                    CASE 
                        WHEN gift_record.gift_value->>'duration' = '1 month' THEN INTERVAL '1 month'
                        WHEN gift_record.gift_value->>'duration' = '3 months' THEN INTERVAL '3 months'
                        WHEN gift_record.gift_value->>'duration' = '1 year' THEN INTERVAL '1 year'
                        ELSE INTERVAL '1 month'
                    END
            WHERE id = p_user_id;
            
        WHEN 'theme', 'animation', 'effect', 'badge', 'avatar_accessory' THEN
            -- Add to user inventory
            INSERT INTO user_inventory (
                user_id, item_name, item_type, item_data, source, gift_id
            ) VALUES (
                p_user_id, gift_record.gift_name, gift_record.gift_type::TEXT, 
                gift_record.gift_value, 'gift', p_gift_id
            ) ON CONFLICT DO NOTHING;
    END CASE;
    
    -- Update gift status
    UPDATE gifts 
    SET status = 'claimed', claimed_at = NOW() 
    WHERE id = p_gift_id;
    
    -- Create notification for successful claim
    INSERT INTO notifications (user_id, type, title, message, data) VALUES (
        p_user_id,
        'system',
        'Gift Claimed!',
        'You successfully claimed your ' || gift_record.gift_name || ' gift!',
        jsonb_build_object('gift_id', p_gift_id, 'gift_name', gift_record.gift_name)
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to decline gift
CREATE OR REPLACE FUNCTION decline_gift(
    p_gift_id UUID,
    p_user_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    gift_record gifts;
BEGIN
    -- Get gift details
    SELECT * INTO gift_record FROM gifts 
    WHERE id = p_gift_id AND recipient_id = p_user_id AND status = 'sent';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gift not found or already processed';
    END IF;
    
    -- Update gift status
    UPDATE gifts 
    SET status = 'declined', declined_at = NOW(), decline_reason = p_reason
    WHERE id = p_gift_id;
    
    -- Refund sender
    UPDATE profiles 
    SET loop_coins = loop_coins + gift_record.cost 
    WHERE id = gift_record.sender_id;
    
    -- Record refund transaction
    INSERT INTO coin_transactions (user_id, amount, transaction_type, description, reference_id)
    VALUES (gift_record.sender_id, gift_record.cost, 'refund', 'Gift declined: ' || gift_record.gift_name, p_gift_id);
    
    -- Notify sender (if not anonymous)
    IF NOT gift_record.is_anonymous THEN
        INSERT INTO notifications (user_id, type, title, message, data) VALUES (
            gift_record.sender_id,
            'system',
            'Gift Declined',
            'Your ' || gift_record.gift_name || ' gift was declined and refunded.',
            jsonb_build_object('gift_id', p_gift_id, 'refund_amount', gift_record.cost)
        );
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function for weekly bonus distribution
CREATE OR REPLACE FUNCTION distribute_weekly_bonus() RETURNS INTEGER AS $$
DECLARE
    user_count INTEGER := 0;
    user_record RECORD;
    current_week DATE := DATE_TRUNC('week', NOW());
BEGIN
    -- Distribute to users who haven't claimed this week and were active in last 30 days
    FOR user_record IN 
        SELECT p.id, p.loop_coins 
        FROM profiles p
        WHERE p.last_login >= NOW() - INTERVAL '30 days'
        AND NOT EXISTS (
            SELECT 1 FROM weekly_bonus_claims wbc 
            WHERE wbc.user_id = p.id AND wbc.week_start = current_week
        )
    LOOP
        -- Update user coins
        UPDATE profiles 
        SET loop_coins = loop_coins + 500 
        WHERE id = user_record.id;
        
        -- Record the claim
        INSERT INTO weekly_bonus_claims (user_id, bonus_amount, week_start)
        VALUES (user_record.id, 500, current_week);
        
        -- Record transaction
        INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
        VALUES (user_record.id, 500, 'weekly_bonus', 'Weekly bonus coins');
        
        -- Create notification
        INSERT INTO notifications (user_id, type, title, message, data) VALUES (
            user_record.id,
            'weekly_bonus',
            'Weekly Bonus!',
            'You received 500 Loop Coins as your weekly bonus!',
            jsonb_build_object('amount', 500, 'week', current_week)
        );
        
        user_count := user_count + 1;
    END LOOP;
    
    RETURN user_count;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON shop_items(category);
CREATE INDEX IF NOT EXISTS idx_shop_items_rarity ON shop_items(rarity);
CREATE INDEX IF NOT EXISTS idx_shop_items_active ON shop_items(is_active);
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_active ON user_inventory(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_gifts_recipient ON gifts(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_gifts_sender ON gifts(sender_id);
CREATE INDEX IF NOT EXISTS idx_gifts_status ON gifts(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_bonus_user_week ON weekly_bonus_claims(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id, created_at DESC);
