-- ============================================================================
-- Animated cosmetics catalog (Pro/sponsor decorations)
-- Every row is pure data: the render layer reads `item_data.frame_variant`,
-- `item_data.card_variant` and `item_data.pfp_interaction`, so new variants
-- can be added from the admin panel without a redeploy.
--
-- Idempotent: rerun any time. Existing rows are never touched.
-- ============================================================================

INSERT INTO shop_items (
  name, description, category, item_type, rarity, price_coins, price_usd,
  premium_only, is_active, item_data, preview_data,
  rating_average, rating_count, updated_at, created_at
)
VALUES
  -- ---- Avatar frames (animated) -------------------------------------------
  (
    'Prism Ring',
    'A rotating gradient ring that spins around your avatar — pure CSS, zero video.',
    'animation', 'avatar_effect', 'legendary', 5000, 0,
    TRUE, TRUE,
    '{"frame_variant":"ring_rotate","colors":{"primary":"#f472b6","secondary":"#a78bfa"},"effects":{"glow":true}}',
    '{"preview":"linear-gradient(135deg, #f472b6, #a78bfa)","colors":{"primary":"#f472b6","secondary":"#a78bfa"}}',
    0, 0, NOW(), NOW()
  ),
  (
    'Orbiting Sparks',
    'Sparkle particles orbit your avatar like a tiny solar system.',
    'animation', 'avatar_effect', 'epic', 3000, 0,
    TRUE, TRUE,
    '{"frame_variant":"orbit_particles","colors":{"primary":"#22d3ee","secondary":"#fbbf24"},"effects":{"glow":true}}',
    '{"preview":"linear-gradient(135deg, #22d3ee, #fbbf24)","colors":{"primary":"#22d3ee","secondary":"#fbbf24"}}',
    0, 0, NOW(), NOW()
  ),
  (
    'Aura Pulse',
    'A soft, breathing glow around your avatar that pulses gently.',
    'animation', 'avatar_effect', 'rare', 1500, 0,
    TRUE, TRUE,
    '{"frame_variant":"pulse_glow","colors":{"primary":"#8b5cf6","secondary":"#ec4899"},"effects":{"glow":true}}',
    '{"preview":"linear-gradient(135deg, #8b5cf6, #ec4899)","colors":{"primary":"#8b5cf6","secondary":"#ec4899"}}',
    0, 0, NOW(), NOW()
  ),
  (
    'Holo Tilt',
    'Your avatar tilts in 3D as you move your pointer over it — subtle parallax depth.',
    'animation', 'avatar_effect', 'epic', 3500, 0,
    TRUE, TRUE,
    '{"frame_variant":"tilt_3d","colors":{"primary":"#34d399","secondary":"#0ea5e9"},"effects":{"glow":true}}',
    '{"preview":"linear-gradient(135deg, #34d399, #0ea5e9)","colors":{"primary":"#34d399","secondary":"#0ea5e9"}}',
    0, 0, NOW(), NOW()
  ),

  -- ---- Post card effects (animated) ---------------------------------------
  (
    'Aurora Border',
    'An animated gradient border that slowly shifts color around your post cards.',
    'card_effect', 'post_card_effect', 'legendary', 6000, 0,
    TRUE, TRUE,
    '{"card_variant":"gradient_border","colors":{"primary":"#22d3ee","secondary":"#a78bfa"},"effects":{"glow":true}}',
    '{"preview":"linear-gradient(135deg, #22d3ee, #a78bfa)","colors":{"primary":"#22d3ee","secondary":"#a78bfa"}}',
    0, 0, NOW(), NOW()
  ),
  (
    'Soft Shimmer',
    'A faint light sweep passes over your post cards periodically — readable, never distracting.',
    'card_effect', 'post_card_effect', 'rare', 1200, 0,
    TRUE, TRUE,
    '{"card_variant":"shimmer","colors":{"primary":"#e2e8f0","secondary":"#94a3b8"},"effects":{"glow":false}}',
    '{"preview":"linear-gradient(135deg, #e2e8f0, #94a3b8)","colors":{"primary":"#e2e8f0","secondary":"#94a3b8"}}',
    0, 0, NOW(), NOW()
  ),
  (
    'Ember Edge',
    'A pulsing warm glow frames your post cards, like an ember that never dies out.',
    'card_effect', 'post_card_effect', 'epic', 2800, 0,
    TRUE, TRUE,
    '{"card_variant":"pulse_edge","colors":{"primary":"#f97316","secondary":"#ef4444"},"effects":{"glow":true}}',
    '{"preview":"linear-gradient(135deg, #f97316, #ef4444)","colors":{"primary":"#f97316","secondary":"#ef4444"}}',
    0, 0, NOW(), NOW()
  ),

  -- ---- PFP tap/hover micro-interactions ------------------------------------
  (
    'Spark Burst',
    'Tapping or hovering your avatar fires a tiny particle burst.',
    'effect', 'aura_effect', 'rare', 1000, 0,
    TRUE, TRUE,
    '{"pfp_interaction":"burst","colors":{"primary":"#fbbf24","secondary":"#f472b6"},"effects":{"glow":true}}',
    '{"preview":"linear-gradient(135deg, #fbbf24, #f472b6)","colors":{"primary":"#fbbf24","secondary":"#f472b6"}}',
    0, 0, NOW(), NOW()
  ),
  (
    'Bounce Pop',
    'Your avatar does a quick bounce-pop whenever it is tapped.',
    'effect', 'aura_effect', 'common', 500, 0,
    TRUE, TRUE,
    '{"pfp_interaction":"bounce","colors":{"primary":"#34d399","secondary":"#84cc16"},"effects":{"glow":false}}',
    '{"preview":"linear-gradient(135deg, #34d399, #84cc16)","colors":{"primary":"#34d399","secondary":"#84cc16"}}',
    0, 0, NOW(), NOW()
  ),
  (
    'Glow Tap',
    'A quick glow pulse ripples from your avatar on tap.',
    'effect', 'aura_effect', 'common', 750, 0,
    TRUE, TRUE,
    '{"pfp_interaction":"pulse","colors":{"primary":"#0ea5e9","secondary":"#6366f1"},"effects":{"glow":true}}',
    '{"preview":"linear-gradient(135deg, #0ea5e9, #6366f1)","colors":{"primary":"#0ea5e9","secondary":"#6366f1"}}',
    0, 0, NOW(), NOW()
  )
ON CONFLICT (name) DO NOTHING;
