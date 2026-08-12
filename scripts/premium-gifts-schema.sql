-- Premium Gifts & Coins Schema Alignment for Supabase
-- Supports TikTok-style animated emojis, stickers, coin transfers & premium gifting

-- Ensure loop_coins column exists on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS loop_coins INTEGER DEFAULT 1000;

-- Ensure gift_types / catalog table exists and has necessary columns
CREATE TABLE IF NOT EXISTS gift_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'standard',
    icon_url TEXT,
    emoji VARCHAR(20) DEFAULT '🎁',
    animation_type VARCHAR(50) DEFAULT 'bounce',
    coin_price INTEGER DEFAULT 10 NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common',
    animation_data JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE gift_types ADD COLUMN IF NOT EXISTS emoji VARCHAR(20) DEFAULT '🎁';
ALTER TABLE gift_types ADD COLUMN IF NOT EXISTS animation_type VARCHAR(50) DEFAULT 'bounce';
ALTER TABLE gift_types ADD COLUMN IF NOT EXISTS coin_price INTEGER DEFAULT 10;
ALTER TABLE gift_types ADD COLUMN IF NOT EXISTS rarity VARCHAR(20) DEFAULT 'common';

-- Seed/Upsert Animated Gifts & Stickers & Premium Items
INSERT INTO gift_types (name, category, emoji, animation_type, coin_price, rarity, animation_data) VALUES
-- Standard Animated Emojis & Stickers
('Rose Shower', 'sticker', '🌹', 'particle_rain', 10, 'common', '{"effect": "rose_petals", "sound": "pop", "color": "#ff2d55"}'),
('Heart Pulse', 'sticker', '❤️', 'bounce', 20, 'common', '{"effect": "heart_beat", "sound": "pulse", "color": "#ef4444"}'),
('Fire Hype', 'sticker', '🔥', 'sparkle', 50, 'common', '{"effect": "fireworks", "sound": "whoosh", "color": "#f97316"}'),
('Sparkle Star', 'sticker', '⭐', 'sparkle', 100, 'rare', '{"effect": "starburst", "sound": "chime", "color": "#eab308"}'),
('Party Popper', 'sticker', '🎉', 'explosion', 150, 'rare', '{"effect": "confetti", "sound": "cheer", "color": "#a855f7"}'),

-- Premium Animated Gifts
('Golden Crown', 'premium', '👑', 'neon_glow', 500, 'epic', '{"effect": "golden_aura", "sound": "fanfare", "color": "#f59e0b"}'),
('Diamond Ring', 'premium', '💎', 'sparkle', 1000, 'epic', '{"effect": "diamond_glimmer", "sound": "ting", "color": "#06b6d4"}'),
('Rocket Blast', 'premium', '🚀', 'screen_takeover', 2500, 'legendary', '{"effect": "rocket_launch", "sound": "rocket", "color": "#3b82f6"}'),
('Dragon Roar', 'premium', '🐲', 'screen_takeover', 5000, 'legendary', '{"effect": "dragon_flame", "sound": "roar", "color": "#10b981"}'),
('TikTok Universe', 'super_gift', '🌌', 'screen_takeover', 10000, 'mythic', '{"effect": "galaxy_swirl", "sound": "cosmic", "color": "#8b5cf6"}'),
('Golden Lion', 'super_gift', '🦁', 'screen_takeover', 15000, 'mythic', '{"effect": "lion_roar_3d", "sound": "lion_roar", "color": "#d97706"}'),
('Super Sports Car', 'super_gift', '🏎️', 'screen_takeover', 20000, 'mythic', '{"effect": "car_drift", "sound": "vroom", "color": "#dc2626"}')
ON CONFLICT DO NOTHING;

-- Gift transactions log
CREATE TABLE IF NOT EXISTS gift_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    gift_type_id UUID REFERENCES gift_types(id),
    gift_name VARCHAR(100),
    coin_amount INTEGER DEFAULT 0,
    item_type VARCHAR(50) DEFAULT 'loop', -- 'loop', 'reel', 'live', 'dm'
    target_id UUID, -- loop_id, reel_id, message_id
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coin balance history
CREATE TABLE IF NOT EXISTS coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- positive for purchase/received, negative for gifted/spent
    type VARCHAR(50) NOT NULL, -- 'purchase', 'gift_sent', 'gift_received', 'reward', 'daily_bonus'
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stored function for safe coin gifting
CREATE OR REPLACE FUNCTION send_gift_with_coins(
    p_sender_id UUID,
    p_recipient_id UUID,
    p_gift_type_id UUID,
    p_target_id UUID DEFAULT NULL,
    p_item_type VARCHAR(50) DEFAULT 'loop',
    p_message TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_coin_price INTEGER;
    v_gift_name VARCHAR(100);
    v_sender_coins INTEGER;
    v_res JSONB;
BEGIN
    -- Check gift details
    SELECT coin_price, name INTO v_coin_price, v_gift_name
    FROM gift_types WHERE id = p_gift_type_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive gift item');
    END IF;

    -- Get sender coins
    SELECT loop_coins INTO v_sender_coins FROM profiles WHERE id = p_sender_id FOR UPDATE;

    IF v_sender_coins IS NULL OR v_sender_coins < v_coin_price THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient Loop Coins balance');
    END IF;

    -- Deduct coins from sender
    UPDATE profiles SET loop_coins = loop_coins - v_coin_price WHERE id = p_sender_id;

    -- Add coins to recipient
    UPDATE profiles SET loop_coins = COALESCE(loop_coins, 0) + v_coin_price WHERE id = p_recipient_id;

    -- Record gift transaction
    INSERT INTO gift_transactions (sender_id, recipient_id, gift_type_id, gift_name, coin_amount, item_type, target_id, message)
    VALUES (p_sender_id, p_recipient_id, p_gift_type_id, v_gift_name, v_coin_price, p_item_type, p_target_id, p_message);

    -- Log coin transactions
    INSERT INTO coin_transactions (user_id, amount, type, description)
    VALUES (p_sender_id, -v_coin_price, 'gift_sent', 'Sent gift: ' || v_gift_name);

    INSERT INTO coin_transactions (user_id, amount, type, description)
    VALUES (p_recipient_id, v_coin_price, 'gift_received', 'Received gift: ' || v_gift_name);

    -- Send notification to recipient
    INSERT INTO notifications (user_id, sender_id, type, title, content, link_url)
    VALUES (
        p_recipient_id,
        p_sender_id,
        'gift',
        'Received a Gift!',
        'You received ' || v_gift_name || ' (' || v_coin_price || ' coins)',
        '/profile'
    );

    RETURN jsonb_build_object(
        'success', true,
        'gift_name', v_gift_name,
        'coins_spent', v_coin_price,
        'new_balance', v_sender_coins - v_coin_price
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
