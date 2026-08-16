-- ============================================================================
-- Premium Shop Catalog — full item set with unique per-item traits.
--
-- Every row is pure data. The render layer (lib/cosmetics.ts + the avatar /
-- card / badge components) reads `item_data` to decide what the item
-- actually does when equipped:
--
--   frame_variant     ring_rotate | orbit_particles | pulse_glow | tilt_3d
--   card_variant      gradient_border | shimmer | pulse_edge
--   pfp_interaction   burst | bounce | pulse
--   accessory_type    crown | hat | glasses | wings | cat | heart | trophy ...
--   font_family       custom display-name font
--   colors            {primary, secondary, accent, ...}
--   effects           {glow, particles}
--   is_giftable       true → shows in the gift picker + plays send animation
--
-- Idempotent: existing rows by name are never touched; re-run any time.
-- ============================================================================

-- Categories used by this catalog that may be missing from older enum eras.
-- Each statement runs in its own implicit transaction (safe for ALTER TYPE).
ALTER TYPE shop_category ADD VALUE IF NOT EXISTS 'badge';
ALTER TYPE shop_category ADD VALUE IF NOT EXISTS 'avatar';
ALTER TYPE shop_category ADD VALUE IF NOT EXISTS 'banner';
ALTER TYPE shop_category ADD VALUE IF NOT EXISTS 'font';
ALTER TYPE shop_category ADD VALUE IF NOT EXISTS 'card_effect';
ALTER TYPE shop_category ADD VALUE IF NOT EXISTS 'gift';
ALTER TYPE shop_category ADD VALUE IF NOT EXISTS 'coins';
ALTER TYPE shop_category ADD VALUE IF NOT EXISTS 'premium';

DO $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements($catalog$[
    {
      "name": "Coin Master Animation",
      "description": "Premium UI animation that plays coin-collect / reward sequences with particle bursts and a satisfying scale-bounce over your avatar.",
      "category": "animation", "item_type": "ui_animation", "rarity": "legendary", "price_coins": 0, "premium_only": true,
      "item_data": {"frame_variant": "orbit_particles", "pfp_interaction": "burst", "trigger_event": "coins_received", "colors": {"primary": "#fbbf24", "secondary": "#f59e0b"}, "effects": {"glow": true, "particles": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #fbbf24, #f59e0b)", "colors": {"primary": "#fbbf24", "secondary": "#f59e0b"}}
    },
    {
      "name": "Premium Unlock Theme",
      "description": "A distinct gold-and-violet palette with an accent glow — unlocked after a premium purchase. Applies across your profile and live presence.",
      "category": "theme", "item_type": "profile_theme", "rarity": "legendary", "price_coins": 0, "premium_only": true,
      "item_data": {"theme_id": "premium_unlock", "colors": {"primary": "#a78bfa", "secondary": "#fbbf24", "accent": "#f0abfc", "background": "#141026", "surface": "#1e1b33", "text": "#f8fafc"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #a78bfa, #fbbf24)", "colors": {"primary": "#a78bfa", "secondary": "#fbbf24"}}
    },
    {
      "name": "Quest Master Theme",
      "description": "Epic theme awarded for completing major quests — quest-styled icons, progress-bar styling, and a warm golden palette.",
      "category": "theme", "item_type": "profile_theme", "rarity": "epic", "price_coins": 0, "premium_only": true,
      "item_data": {"theme_id": "quest_master", "colors": {"primary": "#f59e0b", "secondary": "#fbbf24", "accent": "#ef4444", "background": "#1c1917", "surface": "#292524", "text": "#fef3c7"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #f59e0b, #fbbf24)", "colors": {"primary": "#f59e0b", "secondary": "#fbbf24"}}
    },
    {
      "name": "Daily Streak Effect",
      "description": "Particle effect that fires when you keep a daily streak — floating fire-and-stars particles around your avatar on milestone days.",
      "category": "effect", "item_type": "particle_effect", "rarity": "rare", "price_coins": 0, "premium_only": true,
      "item_data": {"frame_variant": "orbit_particles", "trigger_event": "streak", "colors": {"primary": "#fb923c", "secondary": "#fbbf24"}, "effects": {"glow": true, "particles": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #fb923c, #fbbf24)", "colors": {"primary": "#fb923c", "secondary": "#fbbf24"}}
    },
    {
      "name": "Rainbow Trail",
      "description": "Colorful rainbow trail that follows your cursor or avatar movement — a cycling hue orbit around the avatar.",
      "category": "animation", "item_type": "movement_effect", "rarity": "common", "price_coins": 250,
      "item_data": {"frame_variant": "orbit_particles", "colors": {"primary": "#f472b6", "secondary": "#22d3ee"}, "effects": {"glow": true, "particles": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #f472b6, #22d3ee)", "colors": {"primary": "#f472b6", "secondary": "#22d3ee"}}
    },
    {
      "name": "Lightning Aura",
      "description": "Electric lightning aura that surrounds your avatar — a crackling cyan-violet glow.",
      "category": "effect", "item_type": "aura_effect", "rarity": "rare", "price_coins": 600,
      "item_data": {"frame_variant": "pulse_glow", "colors": {"primary": "#00e5ff", "secondary": "#60a5fa"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #00e5ff, #60a5fa)", "colors": {"primary": "#00e5ff", "secondary": "#60a5fa"}}
    },
    {
      "name": "Royal Purple",
      "description": "Elegant purple profile theme — purple palette for your header, cards, and accents.",
      "category": "theme", "item_type": "profile_theme", "rarity": "common", "price_coins": 400,
      "item_data": {"theme_id": "royal_purple", "colors": {"primary": "#7c3aed", "secondary": "#a78bfa", "accent": "#c084fc", "background": "#150f24", "surface": "#201736", "text": "#ede9fe"}, "effects": {"glow": false}},
      "preview_data": {"preview": "linear-gradient(135deg, #7c3aed, #a78bfa)", "colors": {"primary": "#7c3aed", "secondary": "#a78bfa"}}
    },
    {
      "name": "Gift: Rainbow Unicorn",
      "description": "Legendary gift badge featuring a rainbow unicorn. Sends with a rainbow animation and stays on the recipient's profile.",
      "category": "badge", "item_type": "gift_item", "rarity": "legendary", "price_coins": 1200,
      "item_data": {"icon": "🦄", "is_giftable": true, "gift_animation": {"type": "overlay", "duration_ms": 2500}, "colors": {"primary": "#f472b6", "secondary": "#a78bfa"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #f472b6, #a78bfa)", "colors": {"primary": "#f472b6", "secondary": "#a78bfa"}}
    },
    {
      "name": "Sparkle Trail",
      "description": "Sparkling particle trail that follows your cursor — a gentle star orbit around the avatar.",
      "category": "animation", "item_type": "cursor_effect", "rarity": "common", "price_coins": 300,
      "item_data": {"frame_variant": "orbit_particles", "colors": {"primary": "#fde68a", "secondary": "#facc15"}, "effects": {"glow": true, "particles": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #fde68a, #facc15)", "colors": {"primary": "#fde68a", "secondary": "#facc15"}}
    },
    {
      "name": "Gift: Rose Bouquet",
      "description": "Romantic rose bouquet gift badge — plays a small rose animation when sent.",
      "category": "badge", "item_type": "gift_item", "rarity": "common", "price_coins": 200,
      "item_data": {"icon": "🌹", "is_giftable": true, "gift_animation": {"type": "overlay", "duration_ms": 1800}, "colors": {"primary": "#f43f5e", "secondary": "#fb7185"}},
      "preview_data": {"preview": "linear-gradient(135deg, #f43f5e, #fb7185)", "colors": {"primary": "#f43f5e", "secondary": "#fb7185"}}
    },
    {
      "name": "Cool Sunglasses",
      "description": "Sunglasses accessory that overlays on your avatar, visible to everyone.",
      "category": "avatar", "item_type": "accessory", "rarity": "common", "price_coins": 200,
      "item_data": {"accessory_type": "glasses", "accessory_glyph": "🕶️", "colors": {"primary": "#1e293b"}},
      "preview_data": {"preview": "linear-gradient(135deg, #334155, #0f172a)", "colors": {"primary": "#334155"}}
    },
    {
      "name": "Wizard Hat",
      "description": "Magical wizard hat accessory with a subtle star shimmer.",
      "category": "avatar", "item_type": "accessory", "rarity": "rare", "price_coins": 600,
      "item_data": {"accessory_type": "hat", "accessory_glyph": "🧙", "colors": {"primary": "#6366f1", "secondary": "#a78bfa"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #6366f1, #a78bfa)", "colors": {"primary": "#6366f1", "secondary": "#a78bfa"}}
    },
    {
      "name": "Golden Crown",
      "description": "Prestigious golden crown for top users — avatar overlay with sparkles.",
      "category": "avatar", "item_type": "accessory", "rarity": "legendary", "price_coins": 1500,
      "item_data": {"accessory_type": "crown", "accessory_glyph": "👑", "frame_variant": "orbit_particles", "colors": {"primary": "#fbbf24", "secondary": "#fde68a"}, "effects": {"glow": true, "particles": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #fbbf24, #fde68a)", "colors": {"primary": "#fbbf24", "secondary": "#fde68a"}}
    },
    {
      "name": "Cyberpunk Neon",
      "description": "Neon cyberpunk profile theme with glowing edges and a dark synthwave palette.",
      "category": "theme", "item_type": "profile_theme", "rarity": "epic", "price_coins": 800,
      "item_data": {"theme_id": "cyberpunk_neon", "colors": {"primary": "#22d3ee", "secondary": "#a855f7", "accent": "#f0abfc", "background": "#0a0a1a", "surface": "#14142b", "text": "#e0f2fe"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #22d3ee, #a855f7)", "colors": {"primary": "#22d3ee", "secondary": "#a855f7"}}
    },
    {
      "name": "Dragon Lord",
      "description": "Epic dragon-themed profile with fiery accents and a dark crimson palette.",
      "category": "theme", "item_type": "profile_theme", "rarity": "legendary", "price_coins": 1200,
      "item_data": {"theme_id": "dragon-lord", "colors": {"primary": "#b91c1c", "secondary": "#f59e0b", "accent": "#ef4444", "background": "#1a0000", "surface": "#2d0a0a", "text": "#fde68a"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #b91c1c, #f59e0b)", "colors": {"primary": "#b91c1c", "secondary": "#f59e0b"}}
    },
    {
      "name": "Gift: 24K Rose Garden",
      "description": "Ultra-premium golden rose garden gift — elaborate animation on send plus a badge on the recipient's profile.",
      "category": "badge", "item_type": "gift_item", "rarity": "legendary", "price_coins": 8000,
      "item_data": {"icon": "🌹", "is_giftable": true, "gift_animation": {"type": "fullscreen", "duration_ms": 5000}, "colors": {"primary": "#fbbf24", "secondary": "#f43f5e"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #fbbf24, #f43f5e)", "colors": {"primary": "#fbbf24", "secondary": "#f43f5e"}}
    },
    {
      "name": "Gift: Supercar",
      "description": "Luxury supercar gift — a large animation drives across the screen when gifted.",
      "category": "animation", "item_type": "gift_animation", "rarity": "legendary", "price_coins": 6500,
      "item_data": {"icon": "🏎️", "is_giftable": true, "gift_animation": {"type": "fullscreen", "duration_ms": 4000}, "colors": {"primary": "#ef4444", "secondary": "#f97316"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #ef4444, #f97316)", "colors": {"primary": "#ef4444", "secondary": "#f97316"}}
    },
    {
      "name": "Gift: Galaxy Blast",
      "description": "Cosmic galaxy explosion gift — a spectacular full-screen particle burst when gifted.",
      "category": "animation", "item_type": "gift_animation", "rarity": "legendary", "price_coins": 5000,
      "item_data": {"icon": "🌌", "is_giftable": true, "gift_animation": {"type": "fullscreen", "duration_ms": 4500}, "colors": {"primary": "#a855f7", "secondary": "#22d3ee"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #a855f7, #22d3ee)", "colors": {"primary": "#a855f7", "secondary": "#22d3ee"}}
    },
    {
      "name": "Gift: Diamond Ring",
      "description": "Shiny diamond ring gift badge with a sparkle animation on send.",
      "category": "badge", "item_type": "gift_item", "rarity": "epic", "price_coins": 2500,
      "item_data": {"icon": "💍", "is_giftable": true, "gift_animation": {"type": "overlay", "duration_ms": 2200}, "colors": {"primary": "#bae6fd", "secondary": "#e0f2fe"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #bae6fd, #e0f2fe)", "colors": {"primary": "#bae6fd", "secondary": "#e0f2fe"}}
    },
    {
      "name": "Gift: Royal Crown",
      "description": "Royal crown gift badge — the crown appears on the recipient's avatar.",
      "category": "badge", "item_type": "gift_item", "rarity": "epic", "price_coins": 2000,
      "item_data": {"icon": "👑", "is_giftable": true, "gift_animation": {"type": "overlay", "duration_ms": 2200}, "accessory_type": "crown", "colors": {"primary": "#fbbf24", "secondary": "#a78bfa"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #fbbf24, #a78bfa)", "colors": {"primary": "#fbbf24", "secondary": "#a78bfa"}}
    },
    {
      "name": "Gift: Shooting Star",
      "description": "Shooting star effect gift — a star crosses the screen for everyone in the room.",
      "category": "effect", "item_type": "gift_effect", "rarity": "rare", "price_coins": 1200,
      "item_data": {"icon": "⭐", "is_giftable": true, "gift_animation": {"type": "overlay", "duration_ms": 3000}, "colors": {"primary": "#fde68a", "secondary": "#a78bfa"}, "effects": {"glow": true, "particles": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #fde68a, #a78bfa)", "colors": {"primary": "#fde68a", "secondary": "#a78bfa"}}
    },
    {
      "name": "Gift: Dragon Flame",
      "description": "Dragon flame gift animation — a fire burst plays when gifted.",
      "category": "animation", "item_type": "gift_animation", "rarity": "rare", "price_coins": 900,
      "item_data": {"icon": "🐉", "is_giftable": true, "gift_animation": {"type": "overlay", "duration_ms": 2600}, "colors": {"primary": "#ef4444", "secondary": "#f97316"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #ef4444, #f97316)", "colors": {"primary": "#ef4444", "secondary": "#f97316"}}
    },
    {
      "name": "Gift: Golden Rocket",
      "description": "Golden rocket launch gift — a rocket flies across the screen when gifted.",
      "category": "animation", "item_type": "gift_animation", "rarity": "rare", "price_coins": 600,
      "item_data": {"icon": "🚀", "is_giftable": true, "gift_animation": {"type": "overlay", "duration_ms": 2800}, "colors": {"primary": "#fbbf24", "secondary": "#fb923c"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #fbbf24, #fb923c)", "colors": {"primary": "#fbbf24", "secondary": "#fb923c"}}
    },
    {
      "name": "Gift: Cute Cat",
      "description": "Adorable cat gift badge — purrs onto the recipient's profile.",
      "category": "badge", "item_type": "gift_item", "rarity": "common", "price_coins": 300,
      "item_data": {"icon": "🐱", "is_giftable": true, "gift_animation": {"type": "overlay", "duration_ms": 1600}, "colors": {"primary": "#fb923c", "secondary": "#fbbf24"}},
      "preview_data": {"preview": "linear-gradient(135deg, #fb923c, #fbbf24)", "colors": {"primary": "#fb923c", "secondary": "#fbbf24"}}
    },
    {
      "name": "Gift: Pixel Heart",
      "description": "Pixel-art heart gift badge.",
      "category": "badge", "item_type": "gift_item", "rarity": "common", "price_coins": 250,
      "item_data": {"icon": "❤️", "is_giftable": true, "gift_animation": {"type": "overlay", "duration_ms": 1500}, "colors": {"primary": "#f43f5e", "secondary": "#fb7185"}},
      "preview_data": {"preview": "linear-gradient(135deg, #f43f5e, #fb7185)", "colors": {"primary": "#f43f5e", "secondary": "#fb7185"}}
    },
    {
      "name": "Prism Ring",
      "description": "A rotating prism ring orbits your avatar — continuous, pure CSS.",
      "category": "animation", "item_type": "avatar_effect", "rarity": "legendary", "price_coins": 5000,
      "item_data": {"frame_variant": "ring_rotate", "colors": {"primary": "#f472b6", "secondary": "#a78bfa"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #f472b6, #a78bfa)", "colors": {"primary": "#f472b6", "secondary": "#a78bfa"}}
    },
    {
      "name": "Bounce Pop",
      "description": "Playful bounce-and-pop aura around your avatar — it bounces on hover and tap.",
      "category": "effect", "item_type": "aura_effect", "rarity": "common", "price_coins": 500,
      "item_data": {"frame_variant": "pulse_glow", "pfp_interaction": "bounce", "colors": {"primary": "#34d399", "secondary": "#22d3ee"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #34d399, #22d3ee)", "colors": {"primary": "#34d399", "secondary": "#22d3ee"}}
    },
    {
      "name": "Glow Tap",
      "description": "A soft glow pulse fires every time you tap or hover your avatar.",
      "category": "effect", "item_type": "aura_effect", "rarity": "common", "price_coins": 450,
      "item_data": {"frame_variant": "pulse_glow", "pfp_interaction": "pulse", "colors": {"primary": "#c084fc", "secondary": "#e879f9"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #c084fc, #e879f9)", "colors": {"primary": "#c084fc", "secondary": "#e879f9"}}
    },
    {
      "name": "Gift: Golden Trophy",
      "description": "Golden trophy gift badge — achievement-style badge on the recipient's profile.",
      "category": "badge", "item_type": "gift_item", "rarity": "epic", "price_coins": 800,
      "item_data": {"icon": "🏆", "is_giftable": true, "gift_animation": {"type": "overlay", "duration_ms": 2000}, "colors": {"primary": "#fbbf24", "secondary": "#fde68a"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #fbbf24, #fde68a)", "colors": {"primary": "#fbbf24", "secondary": "#fde68a"}}
    },
    {
      "name": "Gift: Chocolate Box",
      "description": "Sweet chocolate box gift.",
      "category": "badge", "item_type": "gift_item", "rarity": "common", "price_coins": 150,
      "item_data": {"icon": "🍫", "is_giftable": true, "gift_animation": {"type": "overlay", "duration_ms": 1500}, "colors": {"primary": "#92400e", "secondary": "#b45309"}},
      "preview_data": {"preview": "linear-gradient(135deg, #92400e, #b45309)", "colors": {"primary": "#92400e", "secondary": "#b45309"}}
    },
    {
      "name": "Super Supporter",
      "description": "Badge for active supporters — shown on your profile and next to your name in chat.",
      "category": "badge", "item_type": "social_badge", "rarity": "common", "price_coins": 300,
      "item_data": {"icon": "💪", "colors": {"primary": "#38bdf8", "secondary": "#818cf8"}, "effects": {"glow": false}},
      "preview_data": {"preview": "linear-gradient(135deg, #38bdf8, #818cf8)", "colors": {"primary": "#38bdf8", "secondary": "#818cf8"}}
    },
    {
      "name": "Early Adopter",
      "description": "Exclusive badge for early users — a rare founder-era mark of honor.",
      "category": "badge", "item_type": "achievement_badge", "rarity": "legendary", "price_coins": 1000,
      "item_data": {"icon": "🌅", "colors": {"primary": "#fbbf24", "secondary": "#fb923c"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #fbbf24, #fb923c)", "colors": {"primary": "#fbbf24", "secondary": "#fb923c"}}
    },
    {
      "name": "Content Creator",
      "description": "Badge for verified content creators — role indicator on your profile and in rooms.",
      "category": "badge", "item_type": "role_badge", "rarity": "rare", "price_coins": 500,
      "item_data": {"icon": "🎬", "colors": {"primary": "#a78bfa", "secondary": "#22d3ee"}, "effects": {"glow": false}},
      "preview_data": {"preview": "linear-gradient(135deg, #a78bfa, #22d3ee)", "colors": {"primary": "#a78bfa", "secondary": "#22d3ee"}}
    },
    {
      "name": "Fire Wings",
      "description": "Flaming wings attached to your avatar — a fiery particle orbit with a wing overlay.",
      "category": "animation", "item_type": "avatar_effect", "rarity": "epic", "price_coins": 800,
      "item_data": {"frame_variant": "orbit_particles", "accessory_type": "wings", "accessory_glyph": "🪽", "colors": {"primary": "#f97316", "secondary": "#ef4444"}, "effects": {"glow": true, "particles": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #f97316, #ef4444)", "colors": {"primary": "#f97316", "secondary": "#ef4444"}}
    },
    {
      "name": "Golden Royalty Card Effect",
      "description": "Luxurious golden animated border for your post cards — a slow-shifting shine.",
      "category": "card_effect", "item_type": "card_border", "rarity": "legendary", "price_coins": 1200,
      "item_data": {"card_variant": "gradient_border", "colors": {"primary": "#fbbf24", "secondary": "#fde68a"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #fbbf24, #fde68a)", "colors": {"primary": "#fbbf24", "secondary": "#fde68a"}}
    },
    {
      "name": "Cyberpunk Neon Card Effect",
      "description": "Neon glowing border on your post cards — electric cyan-violet edges.",
      "category": "card_effect", "item_type": "card_border", "rarity": "epic", "price_coins": 750,
      "item_data": {"card_variant": "gradient_border", "colors": {"primary": "#22d3ee", "secondary": "#a855f7"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #22d3ee, #a855f7)", "colors": {"primary": "#22d3ee", "secondary": "#a855f7"}}
    },
    {
      "name": "Playfair Serif Font",
      "description": "Elegant Playfair Display serif font for your display name and bio.",
      "category": "font", "item_type": "font_family", "rarity": "rare", "price_coins": 350,
      "item_data": {"font_family": "Playfair Display, Georgia, serif", "font_url": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap", "font_weight": "600"},
      "preview_data": {"preview": "linear-gradient(135deg, #f8fafc, #cbd5e1)", "colors": {"primary": "#f8fafc"}}
    },
    {
      "name": "Fira Code Monospace Font",
      "description": "Developer-favorite monospace font for your display name — terminal energy.",
      "category": "font", "item_type": "font_family", "rarity": "rare", "price_coins": 350,
      "item_data": {"font_family": "Fira Code, ui-monospace, monospace", "font_url": "https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&display=swap", "font_weight": "600"},
      "preview_data": {"preview": "linear-gradient(135deg, #a5f3fc, #67e8f9)", "colors": {"primary": "#67e8f9"}}
    },
    {
      "name": "Gojo Domain Theme",
      "description": "Anime-inspired domain expansion theme — glowing blue-violet void palette.",
      "category": "theme", "item_type": "profile_theme", "rarity": "legendary", "price_coins": 1000,
      "item_data": {"theme_id": "gojo-theme", "colors": {"primary": "#38bdf8", "secondary": "#818cf8", "accent": "#a5b4fc", "background": "#060b18", "surface": "#0d1526", "text": "#e0f2fe"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #38bdf8, #818cf8)", "colors": {"primary": "#38bdf8", "secondary": "#818cf8"}}
    },
    {
      "name": "Forest Guardian Theme",
      "description": "Deep forest palette with emerald greens and warm bark accents.",
      "category": "theme", "item_type": "profile_theme", "rarity": "epic", "price_coins": 900,
      "item_data": {"theme_id": "forest-guardian", "colors": {"primary": "#16a34a", "secondary": "#22c55e", "accent": "#a3e635", "background": "#07130a", "surface": "#0e2013", "text": "#dcfce7"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #16a34a, #a3e635)", "colors": {"primary": "#16a34a", "secondary": "#a3e635"}}
    },
    {
      "name": "Sakura Bloom Theme",
      "description": "Soft pink sakura palette with petal-pink accents and a calm bloom.",
      "category": "theme", "item_type": "profile_theme", "rarity": "epic", "price_coins": 900,
      "item_data": {"theme_id": "sakura-bloom", "colors": {"primary": "#f472b6", "secondary": "#fb7185", "accent": "#fbcfe8", "background": "#1c0f18", "surface": "#2a1522", "text": "#fce7f3"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #f472b6, #fb7185)", "colors": {"primary": "#f472b6", "secondary": "#fb7185"}}
    },
    {
      "name": "Neon Genesis Theme",
      "description": "Bold acid-green and magenta neon theme for the loudest profiles.",
      "category": "theme", "item_type": "profile_theme", "rarity": "epic", "price_coins": 900,
      "item_data": {"theme_id": "neon-genesis", "colors": {"primary": "#4ade80", "secondary": "#e879f9", "accent": "#fde047", "background": "#0a0f0a", "surface": "#122014", "text": "#ecfccb"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #4ade80, #e879f9)", "colors": {"primary": "#4ade80", "secondary": "#e879f9"}}
    },
    {
      "name": "Orbiting Sparks",
      "description": "Sparkle particles orbit your avatar like a tiny solar system.",
      "category": "animation", "item_type": "avatar_effect", "rarity": "epic", "price_coins": 3000,
      "item_data": {"frame_variant": "orbit_particles", "colors": {"primary": "#22d3ee", "secondary": "#fbbf24"}, "effects": {"glow": true, "particles": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #22d3ee, #fbbf24)", "colors": {"primary": "#22d3ee", "secondary": "#fbbf24"}}
    },
    {
      "name": "Holo Tilt",
      "description": "Your avatar tilts in 3D as you move your pointer over it — subtle parallax depth.",
      "category": "animation", "item_type": "avatar_effect", "rarity": "epic", "price_coins": 3500,
      "item_data": {"frame_variant": "tilt_3d", "colors": {"primary": "#34d399", "secondary": "#0ea5e9"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #34d399, #0ea5e9)", "colors": {"primary": "#34d399", "secondary": "#0ea5e9"}}
    },
    {
      "name": "Aura Pulse",
      "description": "A soft, breathing glow around your avatar that pulses gently.",
      "category": "animation", "item_type": "avatar_effect", "rarity": "rare", "price_coins": 1500,
      "item_data": {"frame_variant": "pulse_glow", "colors": {"primary": "#8b5cf6", "secondary": "#ec4899"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #8b5cf6, #ec4899)", "colors": {"primary": "#8b5cf6", "secondary": "#ec4899"}}
    },
    {
      "name": "Soft Shimmer",
      "description": "A faint light sweep passes over your post cards periodically — readable, never distracting.",
      "category": "card_effect", "item_type": "post_card_effect", "rarity": "rare", "price_coins": 1200,
      "item_data": {"card_variant": "shimmer", "colors": {"primary": "#e2e8f0", "secondary": "#94a3b8"}, "effects": {"glow": false}},
      "preview_data": {"preview": "linear-gradient(135deg, #e2e8f0, #94a3b8)", "colors": {"primary": "#e2e8f0", "secondary": "#94a3b8"}}
    },
    {
      "name": "Aurora Border",
      "description": "An animated gradient border that slowly shifts color around your post cards.",
      "category": "card_effect", "item_type": "post_card_effect", "rarity": "legendary", "price_coins": 6000,
      "item_data": {"card_variant": "gradient_border", "colors": {"primary": "#22d3ee", "secondary": "#a78bfa"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #22d3ee, #a78bfa)", "colors": {"primary": "#22d3ee", "secondary": "#a78bfa"}}
    },
    {
      "name": "Ember Edge",
      "description": "A pulsing warm glow frames your post cards, like an ember that never dies out.",
      "category": "card_effect", "item_type": "post_card_effect", "rarity": "epic", "price_coins": 2800,
      "item_data": {"card_variant": "pulse_edge", "colors": {"primary": "#f97316", "secondary": "#ef4444"}, "effects": {"glow": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #f97316, #ef4444)", "colors": {"primary": "#f97316", "secondary": "#ef4444"}}
    },
    {
      "name": "Spark Burst",
      "description": "Tapping or hovering your avatar fires a tiny particle burst.",
      "category": "effect", "item_type": "aura_effect", "rarity": "rare", "price_coins": 1000,
      "item_data": {"frame_variant": "pulse_glow", "pfp_interaction": "burst", "colors": {"primary": "#fbbf24", "secondary": "#f472b6"}, "effects": {"glow": true, "particles": true}},
      "preview_data": {"preview": "linear-gradient(135deg, #fbbf24, #f472b6)", "colors": {"primary": "#fbbf24", "secondary": "#f472b6"}}
    }
  ]$catalog$)
  LOOP
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = item->>'name') THEN
        INSERT INTO shop_items (
          name, description, category, item_type, rarity, price_coins, premium_only,
          item_data, preview_data, is_active, rating_average, rating_count, updated_at, created_at
        )
        VALUES (
          item->>'name',
          item->>'description',
          (item->>'category')::shop_category,
          item->>'item_type',
          item->>'rarity',
          COALESCE((item->>'price_coins')::int, 0),
          COALESCE((item->>'premium_only')::boolean, false),
          COALESCE(item->'item_data', '{}'::jsonb),
          COALESCE(item->'preview_data', '{}'::jsonb),
          COALESCE((item->>'is_active')::boolean, true),
          0, 0, NOW(), NOW()
        );
        RAISE NOTICE 'Seeded catalog item: %', item->>'name';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped catalog item %: %', item->>'name', SQLERRM;
    END;
  END LOOP;
END $$;
