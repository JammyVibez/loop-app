-- ============================================================
-- LOOP COSMETICS CUSTOMIZATION SYSTEM
-- Complete database migration for user cosmetic customization
-- ============================================================

-- 1. COSMETICS CATALOG — Admin-managed inventory of all available cosmetic items
CREATE TABLE IF NOT EXISTS cosmetics_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'profile_decoration',   -- Overlaid transparent PNG/GIF/WebP frames on avatars
    'profile_effect',       -- Animated CSS/SVG backdrops or particle overlays
    'post_decoration',      -- Themed borders/frame graphics on posts
    'post_effect',          -- Background animations/canvas particles behind posts
    'nameplate',            -- Custom background graphics around usernames
    'display_name_theme'    -- Custom web fonts, color hexes, moving gradients
  )),
  item_type TEXT NOT NULL DEFAULT 'standard', -- standard, legendary, epic, rare, common
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  price_coins INTEGER NOT NULL DEFAULT 0,
  price_premium BOOLEAN DEFAULT FALSE, -- requires premium subscription
  preview_url TEXT,                     -- preview image/video URL
  asset_url TEXT,                       -- actual asset URL (image, SVG, CSS, font)
  thumbnail_url TEXT,                   -- small thumbnail for shop grid
  icon_url TEXT,                        -- icon for the item
  color TEXT,                           -- primary color hex
  glow_color TEXT,                      -- glow/accent color hex
  is_active BOOLEAN DEFAULT TRUE,       -- visible in shop
  is_seasonal BOOLEAN DEFAULT FALSE,    -- limited-time item
  is_premium_only BOOLEAN DEFAULT FALSE, -- only for pro users
  item_data JSONB DEFAULT '{}',         -- flexible metadata (font_family, animation_key, etc.)
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. USER COSMETICS INVENTORY — Tracks ownership/unlocks per user
CREATE TABLE IF NOT EXISTS user_cosmetics_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES cosmetics_catalog(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ DEFAULT now(),
  acquired_via TEXT DEFAULT 'purchase', -- purchase, premium_perk, admin_grant, event, achievement
  quantity INTEGER DEFAULT 1,
  UNIQUE(user_id, item_id)
);

-- 3. USER COSMETICS EQUIPPED — Currently equipped items (one per category)
CREATE TABLE IF NOT EXISTS user_cosmetics_equipped (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'profile_decoration',
    'profile_effect',
    'post_decoration',
    'post_effect',
    'nameplate',
    'display_name_theme'
  )),
  item_id UUID REFERENCES cosmetics_catalog(id) ON DELETE SET NULL,
  equipped_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category)
);

-- 4. VIDEO MEDIA — Video PFP/cover photo storage for pro users
CREATE TABLE IF NOT EXISTS video_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('avatar', 'cover')),
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds NUMERIC(5,1),
  file_size_bytes BIGINT,
  mime_type TEXT DEFAULT 'video/mp4',
  width INTEGER,
  height INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ADD VIDEO MEDIA COLUMNS TO PROFILES
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_cover_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_media_id UUID REFERENCES video_media(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_media_id UUID REFERENCES video_media(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cosmetics_catalog_category ON cosmetics_catalog(category, is_active);
CREATE INDEX IF NOT EXISTS idx_cosmetics_catalog_rarity ON cosmetics_catalog(rarity, is_active);
CREATE INDEX IF NOT EXISTS idx_user_cosmetics_inventory_user ON user_cosmetics_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cosmetics_inventory_item ON user_cosmetics_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_user_cosmetics_equipped_user ON user_cosmetics_equipped(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cosmetics_equipped_category ON user_cosmetics_equipped(user_id, category);
CREATE INDEX IF NOT EXISTS idx_video_media_user ON video_media(user_id, media_type);

-- RLS Policies
ALTER TABLE cosmetics_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cosmetics_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cosmetics_equipped ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_media ENABLE ROW LEVEL SECURITY;

-- Catalog: anyone can read active items, only admins can modify
CREATE POLICY "catalog_read" ON cosmetics_catalog
  FOR SELECT USING (is_active = true);

CREATE POLICY "catalog_admin_all" ON cosmetics_catalog
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Inventory: users can read their own, admins can read all
CREATE POLICY "inventory_read_own" ON user_cosmetics_inventory
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "inventory_read_admin" ON user_cosmetics_inventory
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "inventory_insert_own" ON user_cosmetics_inventory
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "inventory_delete_own" ON user_cosmetics_inventory
  FOR DELETE USING (user_id = auth.uid());

-- Equipped: anyone can read, users can modify their own
CREATE POLICY "equipped_read_public" ON user_cosmetics_equipped
  FOR SELECT USING (true);

CREATE POLICY "equipped_upsert_own" ON user_cosmetics_equipped
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "equipped_update_own" ON user_cosmetics_equipped
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "equipped_delete_own" ON user_cosmetics_equipped
  FOR DELETE USING (user_id = auth.uid());

-- Video media: users can read their own, admins can read all
CREATE POLICY "video_media_read_own" ON video_media
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "video_media_read_admin" ON video_media
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "video_media_insert_own" ON video_media
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "video_media_update_own" ON video_media
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "video_media_delete_own" ON video_media
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- SEED DATA: Default cosmetics catalog items
-- ============================================================

-- Profile Decorations (Avatar Frames)
INSERT INTO cosmetics_catalog (name, description, category, item_type, rarity, price_coins, color, glow_color, item_data) VALUES
('Golden Crown Frame', 'A majestic golden frame that sits around your avatar', 'profile_decoration', 'frame', 'legendary', 5000, '#f59e0b', '#fbbf24', '{"frame_variant": "ring_rotate", "border_style": "solid", "border_width": 3, "colors": {"primary": "#f59e0b", "secondary": "#fbbf24"}}'),
('Neon Glow Ring', 'Cyberpunk-inspired neon ring around your avatar', 'profile_decoration', 'frame', 'epic', 3000, '#06b6d4', '#22d3ee', '{"frame_variant": "pulse_glow", "colors": {"primary": "#06b6d4", "secondary": "#22d3ee"}}'),
('Fire Border', 'Animated fire border around your profile picture', 'profile_decoration', 'frame', 'rare', 2000, '#ef4444', '#f97316', '{"frame_variant": "orbit_particles", "colors": {"primary": "#ef4444", "secondary": "#f97316"}}'),
('Rose Gold Frame', 'Elegant rose-gold frame with subtle shimmer', 'profile_decoration', 'frame', 'rare', 2500, '#f472b6', '#ec4899', '{"frame_variant": "shimmer", "colors": {"primary": "#f472b6", "secondary": "#ec4899"}}'),
('Pixel Art Frame', 'Retro pixel art frame for nostalgic vibes', 'profile_decoration', 'frame', 'common', 500, '#8b5cf6', '#a78bfa', '{"frame_variant": "none", "border_style": "pixel", "colors": {"primary": "#8b5cf6", "secondary": "#a78bfa"}}'),

-- Profile Effects (Aura/Particle effects)
('Sparkle Trail', 'Orbiting sparkle particles around your avatar', 'profile_effect', 'aura', 'epic', 3500, '#facc15', '#fde68a', '{"frame_variant": "orbit_particles", "colors": {"primary": "#facc15", "secondary": "#fde68a"}, "glow": true, "particles": true}'),
('Rainbow Orbit', 'Rainbow particles orbiting your profile', 'profile_effect', 'aura', 'legendary', 6000, '#f472b6', '#22d3ee', '{"frame_variant": "orbit_particles", "colors": {"primary": "#f472b6", "secondary": "#22d3ee"}, "glow": true, "particles": true}'),
('Dragon Fire', 'Intense fire particles surrounding your avatar', 'profile_effect', 'aura', 'legendary', 7000, '#f97316', '#ef4444', '{"frame_variant": "orbit_particles", "colors": {"primary": "#f97316", "secondary": "#ef4444"}, "glow": true, "particles": true}'),
('Frost Aura', 'Icy cold aura with snowflake particles', 'profile_effect', 'aura', 'epic', 3000, '#38bdf8', '#e0f2fe', '{"frame_variant": "pulse_glow", "colors": {"primary": "#38bdf8", "secondary": "#e0f2fe"}, "glow": true}'),
('Matrix Rain', 'Green digital rain effect around avatar', 'profile_effect', 'aura', 'rare', 2500, '#10b981', '#00ff88', '{"frame_variant": "pulse_glow", "colors": {"primary": "#10b981", "secondary": "#00ff88"}, "glow": true}'),

-- Post Decorations (Card borders/frames)
('Gradient Border Pro', 'Animated gradient border around your posts', 'post_decoration', 'card_frame', 'epic', 4000, '#8b5cf6', '#ec4899', '{"card_variant": "gradient_border", "colors": {"primary": "#8b5cf6", "secondary": "#ec4899"}}'),
('Neon Pulse Card', 'Pulsing neon border for post cards', 'post_decoration', 'card_frame', 'rare', 2500, '#22d3ee', '#a855f7', '{"card_variant": "neon_edge", "colors": {"primary": "#22d3ee", "secondary": "#a855f7"}}'),
('Aurora Borealis Card', 'Northern lights effect on your posts', 'post_decoration', 'card_frame', 'legendary', 8000, '#22d3ee', '#34d399', '{"card_variant": "aurora", "colors": {"primary": "#22d3ee", "secondary": "#34d399"}}'),
('Ember Card', 'Rising ember particles on post border', 'post_decoration', 'card_frame', 'rare', 2000, '#f97316', '#ef4444', '{"card_variant": "ember", "colors": {"primary": "#f97316", "secondary": "#ef4444"}}'),
('Hologram Card', 'Iridescent holographic effect on posts', 'post_decoration', 'card_frame', 'legendary', 9000, '#f472b6', '#a78bfa', '{"card_variant": "hologram", "colors": {"primary": "#f472b6", "secondary": "#a78bfa"}}'),

-- Post Effects (Background animations)
('Floating Particles', 'Gentle particles floating behind post content', 'post_effect', 'background_fx', 'rare', 2000, '#8b5cf6', '#a78bfa', '{"background_animation": "float", "colors": {"primary": "#8b5cf6", "secondary": "#a78bfa"}}'),
('Starfield', 'Twinkling stars behind your post text', 'post_effect', 'background_fx', 'epic', 3500, '#fbbf24', '#fde68a', '{"background_animation": "stars", "colors": {"primary": "#fbbf24", "secondary": "#fde68a"}}'),
('Wave Motion', 'Subtle ocean waves behind post content', 'post_effect', 'background_fx', 'rare', 2500, '#38bdf8', '#0284c7', '{"background_animation": "wave", "colors": {"primary": "#38bdf8", "secondary": "#0284c7"}}'),

-- Nameplates (Username banners)
('Gold Nameplate', 'Elegant golden banner behind your username', 'nameplate', 'username_banner', 'epic', 3500, '#f59e0b', '#fbbf24', '{"banner_style": "gradient", "colors": {"primary": "#f59e0b", "secondary": "#fbbf24"}, "text_color": "#1c1917"}'),
('Neon Nameplate', 'Cyberpunk neon banner for your username', 'nameplate', 'username_banner', 'rare', 2500, '#22d3ee', '#06b6d4', '{"banner_style": "glow", "colors": {"primary": "#22d3ee", "secondary": "#06b6d4"}, "text_color": "#ffffff"}'),
('Royal Purple Nameplate', 'Regal purple nameplate with gold trim', 'nameplate', 'username_banner', 'legendary', 6000, '#7c3aed', '#fbbf24', '{"banner_style": "gradient", "colors": {"primary": "#7c3aed", "secondary": "#fbbf24"}, "text_color": "#ffffff"}'),
('Crimson Nameplate', 'Deep red banner with subtle animation', 'nameplate', 'username_banner', 'rare', 2000, '#ef4444', '#dc2626', '{"banner_style": "gradient", "colors": {"primary": "#ef4444", "secondary": "#dc2626"}, "text_color": "#ffffff"}'),

-- Display Name Themes (Fonts + colors)
('Cursive Elegance', 'Beautiful cursive font for your display name', 'display_name_theme', 'font_theme', 'rare', 2000, '#8b5cf6', null, '{"font_family": "Dancing Script, cursive", "font_preset": "dancing_script", "text_gradient": ["#8b5cf6", "#ec4899"]}'),
('Tech Mono', 'Clean monospace font for a tech-savvy look', 'display_name_theme', 'font_theme', 'common', 500, '#10b981', null, '{"font_family": "JetBrains Mono, monospace", "font_preset": "jetbrains_mono", "text_gradient": ["#10b981", "#34d399"]}'),
('Bold Impact', 'Thick bold display font that commands attention', 'display_name_theme', 'font_theme', 'epic', 3500, '#ef4444', null, '{"font_family": "Bebas Neue, sans-serif", "font_preset": "bebas", "text_gradient": ["#ef4444", "#f97316"]}'),
('Galaxy Gradient', 'Moving rainbow gradient on your display name', 'display_name_theme', 'font_theme', 'legendary', 8000, '#f472b6', '#22d3ee', '{"font_family": "Poppins, sans-serif", "font_preset": "poppins", "text_gradient": ["#f472b6", "#a78bfa", "#22d3ee", "#34d399"], "gradient_animated": true}')
ON CONFLICT DO NOTHING;

-- Grant all existing pro users all premium cosmetic items
INSERT INTO user_cosmetics_inventory (user_id, item_id, acquired_via)
SELECT p.id, c.id, 'premium_perk'
FROM profiles p
CROSS JOIN cosmetics_catalog c
WHERE p.is_premium = true AND c.is_premium_only = true
ON CONFLICT DO NOTHING;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_cosmetics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER cosmetics_catalog_updated
  BEFORE UPDATE ON cosmetics_catalog
  FOR EACH ROW EXECUTE FUNCTION update_cosmetics_timestamp();

CREATE OR REPLACE TRIGGER user_cosmetics_inventory_updated
  BEFORE UPDATE ON user_cosmetics_inventory
  FOR EACH ROW EXECUTE FUNCTION update_cosmetics_timestamp();
