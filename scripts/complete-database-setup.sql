-- Complete Database Setup for Loop Social Platform Enhanced Features
-- Run this script in your Supabase SQL editor

-- =====================================================
-- STEP 1: CREATE TABLES
-- =====================================================

-- Shop Items Table
CREATE TABLE IF NOT EXISTS shop_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price INTEGER DEFAULT 0,
    price_coins INTEGER,
    price_usd DECIMAL(10,2),
    category VARCHAR(50) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common',
    premium_only BOOLEAN DEFAULT false,
    item_data JSONB DEFAULT '{}',
    preview_data JSONB DEFAULT '{}',
    image_url TEXT,
    animation_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Inventory Table
CREATE TABLE IF NOT EXISTS user_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id UUID REFERENCES shop_items(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    is_equipped BOOLEAN DEFAULT false,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

-- Gift Transactions Table
CREATE TABLE IF NOT EXISTS gift_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    gift_id UUID REFERENCES shop_items(id) ON DELETE CASCADE,
    message TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    context VARCHAR(50),
    context_id UUID,
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video Calls Table
CREATE TABLE IF NOT EXISTS video_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    caller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    callee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    call_type VARCHAR(10) NOT NULL CHECK (call_type IN ('video', 'audio')),
    status VARCHAR(20) DEFAULT 'initiated',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER DEFAULT 0,
    call_data JSONB DEFAULT '{}'
);

-- User Themes Table
CREATE TABLE IF NOT EXISTS user_themes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    theme_id VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, theme_id)
);

-- Admin Settings Table
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PWA Install Tracking Table
CREATE TABLE IF NOT EXISTS pwa_installs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    platform VARCHAR(50),
    user_agent TEXT,
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call Participants Table (for group calls)
CREATE TABLE IF NOT EXISTS call_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID REFERENCES video_calls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    is_muted BOOLEAN DEFAULT false,
    is_video_enabled BOOLEAN DEFAULT true
);

-- =====================================================
-- STEP 2: ADD MISSING COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add columns to profiles table if they don't exist
DO $$ 
BEGIN
    -- Add loop_coins column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'loop_coins') THEN
        ALTER TABLE profiles ADD COLUMN loop_coins INTEGER DEFAULT 500;
    END IF;
    
    -- Add is_admin column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_admin') THEN
        ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;
    END IF;
    
    -- Add premium_until column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'premium_until') THEN
        ALTER TABLE profiles ADD COLUMN premium_until TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add theme_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'theme_id') THEN
        ALTER TABLE profiles ADD COLUMN theme_id VARCHAR(50) DEFAULT 'default';
    END IF;
END $$;

-- =====================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pwa_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 4: CREATE RLS POLICIES
-- =====================================================

-- Shop Items Policies
DROP POLICY IF EXISTS "Shop items are viewable by everyone" ON shop_items;
CREATE POLICY "Shop items are viewable by everyone" ON shop_items FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage shop items" ON shop_items;
CREATE POLICY "Admins can manage shop items" ON shop_items FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- User Inventory Policies
DROP POLICY IF EXISTS "Users can view their own inventory" ON user_inventory;
CREATE POLICY "Users can view their own inventory" ON user_inventory FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own inventory" ON user_inventory;
CREATE POLICY "Users can update their own inventory" ON user_inventory FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert into inventory" ON user_inventory;
CREATE POLICY "System can insert into inventory" ON user_inventory FOR INSERT WITH CHECK (true);

-- Gift Transactions Policies
DROP POLICY IF EXISTS "Users can view gifts they sent or received" ON gift_transactions;
CREATE POLICY "Users can view gifts they sent or received" ON gift_transactions FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
);

DROP POLICY IF EXISTS "Users can send gifts" ON gift_transactions;
CREATE POLICY "Users can send gifts" ON gift_transactions FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Video Calls Policies
DROP POLICY IF EXISTS "Users can view their own calls" ON video_calls;
CREATE POLICY "Users can view their own calls" ON video_calls FOR SELECT USING (
    auth.uid() = caller_id OR auth.uid() = callee_id
);

DROP POLICY IF EXISTS "Users can create calls" ON video_calls;
CREATE POLICY "Users can create calls" ON video_calls FOR INSERT WITH CHECK (auth.uid() = caller_id);

DROP POLICY IF EXISTS "Users can update their calls" ON video_calls;
CREATE POLICY "Users can update their calls" ON video_calls FOR UPDATE USING (
    auth.uid() = caller_id OR auth.uid() = callee_id
);

-- User Themes Policies
DROP POLICY IF EXISTS "Users can view their own themes" ON user_themes;
CREATE POLICY "Users can view their own themes" ON user_themes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their themes" ON user_themes;
CREATE POLICY "Users can manage their themes" ON user_themes FOR ALL USING (auth.uid() = user_id);

-- Admin Settings Policies
DROP POLICY IF EXISTS "Only admins can view settings" ON admin_settings;
CREATE POLICY "Only admins can view settings" ON admin_settings FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

DROP POLICY IF EXISTS "Only admins can manage settings" ON admin_settings;
CREATE POLICY "Only admins can manage settings" ON admin_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- PWA Installs Policies
DROP POLICY IF EXISTS "Users can track their PWA installs" ON pwa_installs;
CREATE POLICY "Users can track their PWA installs" ON pwa_installs FOR ALL USING (auth.uid() = user_id);

-- Call Participants Policies
DROP POLICY IF EXISTS "Users can view call participants" ON call_participants;
CREATE POLICY "Users can view call participants" ON call_participants FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM video_calls 
        WHERE id = call_id AND (caller_id = auth.uid() OR callee_id = auth.uid())
    )
);

-- =====================================================
-- STEP 5: INSERT DEFAULT SHOP ITEMS
-- =====================================================

-- Clear existing items first (optional)
-- DELETE FROM shop_items;

-- Insert Dragon Theme Items
INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, premium_only, item_data, preview_data, animation_url) VALUES
('Baby Dragon', 'A cute baby dragon companion that follows your cursor', 300, 'animation', 'companion', 'rare', false, '{"effects": ["follows_cursor", "breathing_animation"], "size": "128x128"}', '{"preview": "🐉"}', '/assets/gifts/dragons/baby-dragon.gif'),
('Dragon Egg', 'Mysterious dragon egg that hatches over time', 150, 'animation', 'interactive', 'common', false, '{"effects": ["glowing", "hatching_timer"], "hatch_time": 86400}', '{"preview": "🥚"}', '/assets/gifts/dragons/dragon-egg.gif'),
('Fire Breath', 'Breathe fire across your profile', 500, 'animation', 'effect', 'epic', true, '{"effects": ["screen_fire", "burn_effect"], "duration": 5}', '{"preview": "🔥"}', '/assets/gifts/dragons/fire-breath.gif'),
('Dragon Wings', 'Majestic dragon wings for your avatar', 400, 'animation', 'avatar', 'epic', true, '{"effects": ["wing_flap", "wind_particles"], "attachment": "avatar"}', '{"preview": "🪶"}', '/assets/gifts/dragons/dragon-wings.gif'),
('Ancient Dragon', 'Legendary ancient dragon guardian', 1000, 'animation', 'legendary', 'legendary', true, '{"effects": ["screen_takeover", "roar_sound", "treasure_rain"], "duration": 10}', '{"preview": "🐲"}', '/assets/gifts/dragons/ancient-dragon.gif')
ON CONFLICT (name) DO NOTHING;

-- Insert Forest Theme Items
INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, premium_only, item_data, preview_data, animation_url) VALUES
('Growing Tree', 'A magical tree that grows on your profile', 250, 'animation', 'decoration', 'rare', false, '{"effects": ["growth_animation", "seasonal_changes"], "growth_stages": 5}', '{"preview": "🌳"}', '/assets/gifts/forest/growing-tree.gif'),
('Forest Sprite', 'A playful forest sprite companion', 200, 'animation', 'companion', 'rare', false, '{"effects": ["flying_animation", "sparkle_trail"], "flight_pattern": "random"}', '{"preview": "🧚"}', '/assets/gifts/forest/forest-sprite.gif'),
('Flower Bloom', 'Beautiful flowers that bloom across your profile', 150, 'animation', 'effect', 'common', false, '{"effects": ["blooming_animation", "petal_fall"], "flower_types": ["rose", "lily", "daisy"]}', '{"preview": "🌸"}', '/assets/gifts/forest/flower-bloom.gif'),
('Ancient Oak', 'Majestic ancient oak tree guardian', 500, 'animation', 'guardian', 'epic', true, '{"effects": ["wisdom_aura", "bird_nests", "seasonal_foliage"], "seasons": 4}', '{"preview": "🌲"}', '/assets/gifts/forest/ancient-oak.gif'),
('Nature Crown', 'Crown of leaves and flowers for your avatar', 300, 'animation', 'avatar', 'epic', true, '{"effects": ["leaf_crown", "flower_petals", "nature_blessing"], "attachment": "head"}', '{"preview": "👑"}', '/assets/gifts/forest/nature-crown.gif'),
('World Tree', 'Legendary world tree that connects all life', 800, 'animation', 'legendary', 'legendary', true, '{"effects": ["screen_takeover", "life_energy", "cosmic_connection"], "duration": 15}', '{"preview": "🌍"}', '/assets/gifts/forest/world-tree.gif')
ON CONFLICT (name) DO NOTHING;

-- Insert Special Items
INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, premium_only, item_data, preview_data, animation_url) VALUES
('100 Loop Coins', 'Gift 100 Loop Coins to another user', 50, 'coins', 'currency', 'common', false, '{"coin_amount": 100}', '{"preview": "💰"}', NULL),
('500 Loop Coins', 'Gift 500 Loop Coins to another user', 200, 'coins', 'currency', 'rare', false, '{"coin_amount": 500}', '{"preview": "💰"}', NULL),
('1000 Loop Coins', 'Gift 1000 Loop Coins to another user', 350, 'coins', 'currency', 'epic', false, '{"coin_amount": 1000, "bonus": 100}', '{"preview": "💰"}', NULL),
('Birthday Cake', 'Special birthday celebration gift', 100, 'special', 'celebration', 'common', false, '{"occasion": "birthday", "candles": true}', '{"preview": "🎂"}', '/assets/gifts/special/birthday-cake.gif'),
('Diamond Ring', 'Luxury diamond ring gift', 1000, 'special', 'luxury', 'legendary', true, '{"luxury_tier": "diamond", "sparkle_effect": true}', '{"preview": "💎"}', '/assets/gifts/special/diamond-ring.gif'),
('Floating Heart', 'Romantic floating heart animation', 75, 'special', 'emotion', 'common', false, '{"emotion": "love", "float_duration": 3}', '{"preview": "💖"}', '/assets/gifts/special/floating-heart.gif')
ON CONFLICT (name) DO NOTHING;

-- Insert Premium Items
INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, premium_only, item_data, preview_data) VALUES
('Premium Month', 'Gift 1 month of Loop Premium', 500, 'premium', 'subscription', 'epic', false, '{"duration": "1 month", "benefits": ["ad_free", "exclusive_themes", "priority_support"]}', '{"preview": "👑"}'),
('Premium Year', 'Gift 1 year of Loop Premium', 5000, 'premium', 'subscription', 'legendary', false, '{"duration": "1 year", "benefits": ["ad_free", "exclusive_themes", "priority_support", "bonus_coins"], "bonus_coins": 1000}', '{"preview": "👑"}')
ON CONFLICT (name) DO NOTHING;

-- Insert Theme Items
INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, premium_only, item_data, preview_data) VALUES
('Dragon Lord Theme', 'Complete dragon-themed profile makeover', 800, 'theme', 'cosmetic', 'legendary', true, '{"theme_id": "dragon-lord", "includes": ["background", "particles", "sounds", "animations"]}', '{"preview": "🐉", "colors": ["#8B0000", "#FFD700", "#FF4500"]}'),
('Forest Guardian Theme', 'Nature-themed profile with seasonal effects', 600, 'theme', 'cosmetic', 'epic', true, '{"theme_id": "forest-guardian", "includes": ["background", "particles", "sounds", "seasonal"], "seasonal": true}', '{"preview": "🌳", "colors": ["#228B22", "#8FBC8F", "#32CD32"]}'),
('Ocean Depths Theme', 'Deep sea theme with aquatic effects', 500, 'theme', 'cosmetic', 'epic', true, '{"theme_id": "ocean-depths", "includes": ["background", "bubbles", "waves", "sea_creatures"]}', '{"preview": "🌊", "colors": ["#006994", "#4682B4", "#87CEEB"]}'),
('Space Explorer Theme', 'Cosmic theme with stars and planets', 700, 'theme', 'cosmetic', 'legendary', true, '{"theme_id": "space-explorer", "includes": ["background", "stars", "planets", "nebula"]}', '{"preview": "🚀", "colors": ["#191970", "#4B0082", "#8A2BE2"]}')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- STEP 6: INSERT DEFAULT ADMIN SETTINGS
-- =====================================================

INSERT INTO admin_settings (setting_key, setting_value) VALUES
('maintenance_mode', '{"enabled": false, "message": "System maintenance in progress"}'),
('user_registration', '{"enabled": true, "require_email_verification": true}'),
('video_calls', '{"enabled": true, "max_participants": 8, "max_duration": 3600}'),
('gift_system', '{"enabled": true, "daily_gift_limit": 10, "max_gift_value": 1000}'),
('pwa_features', '{"install_prompt": true, "offline_mode": true, "push_notifications": true}'),
('shop_settings', '{"enabled": true, "featured_items": 6, "new_user_coins": 500}'),
('theme_system', '{"enabled": true, "custom_themes": true, "theme_marketplace": true}')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- =====================================================
-- STEP 7: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Shop Items Indexes
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON shop_items(category);
CREATE INDEX IF NOT EXISTS idx_shop_items_rarity ON shop_items(rarity);
CREATE INDEX IF NOT EXISTS idx_shop_items_active ON shop_items(is_active);
CREATE INDEX IF NOT EXISTS idx_shop_items_premium ON shop_items(premium_only);

-- User Inventory Indexes
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_item_id ON user_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_equipped ON user_inventory(is_equipped);

-- Gift Transactions Indexes
CREATE INDEX IF NOT EXISTS idx_gift_transactions_sender ON gift_transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_recipient ON gift_transactions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_created ON gift_transactions(created_at);

-- Video Calls Indexes
CREATE INDEX IF NOT EXISTS idx_video_calls_caller ON video_calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_callee ON video_calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_status ON video_calls(status);

-- User Themes Indexes
CREATE INDEX IF NOT EXISTS idx_user_themes_user_id ON user_themes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_themes_active ON user_themes(is_active);

-- =====================================================
-- STEP 8: CREATE FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_shop_items_updated_at ON shop_items;
CREATE TRIGGER update_shop_items_updated_at BEFORE UPDATE ON shop_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_settings_updated_at ON admin_settings;
CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON admin_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to give new users starting coins
CREATE OR REPLACE FUNCTION give_new_user_coins()
RETURNS TRIGGER AS $$
BEGIN
    -- Give new users 500 starting coins
    UPDATE profiles SET loop_coins = 500 WHERE id = NEW.id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to give coins to new users (if profiles table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        DROP TRIGGER IF EXISTS give_new_user_coins_trigger ON profiles;
        CREATE TRIGGER give_new_user_coins_trigger 
            AFTER INSERT ON profiles 
            FOR EACH ROW 
            EXECUTE FUNCTION give_new_user_coins();
    END IF;
END $$;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Database setup completed successfully!';
    RAISE NOTICE '📊 Tables created: shop_items, user_inventory, gift_transactions, video_calls, user_themes, admin_settings, pwa_installs, call_participants';
    RAISE NOTICE '🛡️ RLS policies enabled and configured';
    RAISE NOTICE '🎁 Default shop items inserted (% items)', (SELECT COUNT(*) FROM shop_items);
    RAISE NOTICE '⚙️ Admin settings configured';
    RAISE NOTICE '🚀 Ready to use enhanced Loop Social Platform features!';
END $$;
