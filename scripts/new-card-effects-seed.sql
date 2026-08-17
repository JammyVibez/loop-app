-- New animated card effects for the cosmetics shop.
-- Each maps to a `card_variant` that components/cosmetics/animated-card-frame.tsx renders.
-- Idempotent: only inserts when the name isn't already present.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Aurora Card Effect') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Aurora Card Effect', 'A soft northern-lights band sweeps across the top of your posts — calm, dreamy, unmistakable.', 'card_effect', 'post_card_effect', 'rare', 450, 0, TRUE, TRUE,
      '{"card_variant":"aurora","glow":true,"colors":{"primary":"#34d399","secondary":"#22d3ee"}}',
      '{"preview":"linear-gradient(120deg, #34d399, #22d3ee, #a78bfa)","colors":{"primary":"#34d399"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Ember Glow Card Effect') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Ember Glow Card Effect', 'Warm embers drift up from the edges of your card like sparks from a midnight fire.', 'card_effect', 'post_card_effect', 'epic', 600, 0, TRUE, TRUE,
      '{"card_variant":"ember","glow":true,"colors":{"primary":"#f97316","secondary":"#fbbf24"}}',
      '{"preview":"linear-gradient(120deg, #f97316, #fbbf24)","colors":{"primary":"#f97316"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Frost Edge Card Effect') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Frost Edge Card Effect', 'An icy, slow-shifting frost border — cool blue edges that shimmer like winter glass.', 'card_effect', 'post_card_effect', 'rare', 450, 0, TRUE, TRUE,
      '{"card_variant":"ice","glow":true,"colors":{"primary":"#7dd3fc","secondary":"#e0f2fe"}}',
      '{"preview":"linear-gradient(120deg, #7dd3fc, #e0f2fe)","colors":{"primary":"#7dd3fc"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Fire Edge Card Effect') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Fire Edge Card Effect', 'A flickering flame gradient rings your post — hot, alive, impossible to scroll past.', 'card_effect', 'post_card_effect', 'legendary', 900, 0, TRUE, TRUE,
      '{"card_variant":"fire_edge","glow":true,"colors":{"primary":"#ef4444","secondary":"#fbbf24"}}',
      '{"preview":"linear-gradient(90deg, #ef4444, #f97316, #fbbf24)","colors":{"primary":"#ef4444"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Neon Edge Card Effect') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Neon Edge Card Effect', 'A hard, bright neon outline that pulses — pure city-at-midnight energy.', 'card_effect', 'post_card_effect', 'epic', 650, 0, TRUE, TRUE,
      '{"card_variant":"neon_edge","glow":true,"colors":{"primary":"#22d3ee","secondary":"#a78bfa"}}',
      '{"preview":"linear-gradient(120deg, #22d3ee, #a78bfa)","colors":{"primary":"#22d3ee"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Hologram Card Effect') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Hologram Card Effect', 'An iridescent hue-shifting border — the rarest finish in the shop.', 'card_effect', 'post_card_effect', 'legendary', 1000, 0, TRUE, TRUE,
      '{"card_variant":"hologram","glow":true,"colors":{"primary":"#f472b6","secondary":"#22d3ee"}}',
      '{"preview":"linear-gradient(120deg, #f472b6, #a78bfa, #22d3ee, #34d399)","colors":{"primary":"#f472b6"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Rainbow Dash Card Effect') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Rainbow Dash Card Effect', 'A rotating conic rainbow ring around your posts — playful, loud, joyful.', 'card_effect', 'post_card_effect', 'epic', 700, 0, TRUE, TRUE,
      '{"card_variant":"rainbow_dash","glow":true,"colors":{"primary":"#f43f5e","secondary":"#8b5cf6"}}',
      '{"preview":"conic-gradient(from 0deg, #f43f5e, #f59e0b, #22c55e, #06b6d4, #8b5cf6)","colors":{"primary":"#f43f5e"}}', 0, 0, NOW(), NOW());
  END IF;
END $$;
