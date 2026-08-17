-- Additional font families + color palette themes for the cosmetics shop.
-- Idempotent: each item only inserts if its name is not already present.
-- Fonts render via lib/cosmetic-fonts.ts (Google Fonts css2 URLs injected on
-- equip); palettes are standard theme items with colors + effects.

DO $$
BEGIN
  -- ---- Fonts -------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Bebas Neue Display Font') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Bebas Neue Display Font', 'Tall condensed headline type — bold, loud, impossible to miss.', 'font', 'font_family', 'rare', 400, 0, TRUE, TRUE,
      '{"font_family":"''Bebas Neue'', sans-serif","font_preset":"bebas","font_url":"https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap","font_weight":"400"}',
      '{"preview":"linear-gradient(135deg, #fbbf24, #f97316)","colors":{"primary":"#fbbf24"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Righteous Street Font') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Righteous Street Font', 'Rounded street-art lettering with real attitude.', 'font', 'font_family', 'rare', 400, 0, TRUE, TRUE,
      '{"font_family":"''Righteous'', sans-serif","font_preset":"righteous","font_url":"https://fonts.googleapis.com/css2?family=Righteous&display=swap","font_weight":"400"}',
      '{"preview":"linear-gradient(135deg, #22d3ee, #a78bfa)","colors":{"primary":"#22d3ee"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Caveat Handwritten Font') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Caveat Handwritten Font', 'Warm, personal handwritten script — like a note from a friend.', 'font', 'font_family', 'common', 250, 0, TRUE, TRUE,
      '{"font_family":"''Caveat'', cursive","font_preset":"caveat","font_url":"https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap","font_weight":"700"}',
      '{"preview":"linear-gradient(135deg, #f472b6, #fbbf24)","colors":{"primary":"#f472b6"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Dancing Script Font') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Dancing Script Font', 'Elegant flowing script with a bounce — effortless flair.', 'font', 'font_family', 'rare', 350, 0, TRUE, TRUE,
      '{"font_family":"''Dancing Script'', cursive","font_preset":"dancing_script","font_url":"https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;700&display=swap","font_weight":"700"}',
      '{"preview":"linear-gradient(135deg, #f9a8d4, #c4b5fd)","colors":{"primary":"#f9a8d4"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Unbounded Extreme Font') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Unbounded Extreme Font', 'Extra-bold futuristic display type — maximum presence.', 'font', 'font_family', 'epic', 600, 0, TRUE, TRUE,
      '{"font_family":"''Unbounded'', sans-serif","font_preset":"unbounded","font_url":"https://fonts.googleapis.com/css2?family=Unbounded:wght@500;800&display=swap","font_weight":"800"}',
      '{"preview":"linear-gradient(135deg, #e879f9, #22d3ee)","colors":{"primary":"#e879f9"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Orbitron Sci-Fi Font') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Orbitron Sci-Fi Font', 'Geometric sci-fi lettering straight out of a spaceship HUD.', 'font', 'font_family', 'epic', 550, 0, TRUE, TRUE,
      '{"font_family":"''Orbitron'', sans-serif","font_preset":"orbitron","font_url":"https://fonts.googleapis.com/css2?family=Orbitron:wght@500;800&display=swap","font_weight":"700"}',
      '{"preview":"linear-gradient(135deg, #00ff88, #00ccff)","colors":{"primary":"#00ff88"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Press Start Pixel Font') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Press Start Pixel Font', 'Retro 8-bit arcade font for the true gamers.', 'font', 'font_family', 'legendary', 800, 0, TRUE, TRUE,
      '{"font_family":"''Press Start 2P'', monospace","font_preset":"press_start","font_url":"https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap","font_weight":"400"}',
      '{"preview":"linear-gradient(135deg, #4ade80, #fde047)","colors":{"primary":"#4ade80"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Lobster Retro Font') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Lobster Retro Font', 'Classic bold retro script — diner sign energy.', 'font', 'font_family', 'rare', 350, 0, TRUE, TRUE,
      '{"font_family":"''Lobster'', cursive","font_preset":"lobster","font_url":"https://fonts.googleapis.com/css2?family=Lobster&display=swap","font_weight":"400"}',
      '{"preview":"linear-gradient(135deg, #fb7185, #f97316)","colors":{"primary":"#fb7185"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Fredoka Rounded Font') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Fredoka Rounded Font', 'Friendly rounded sans-serif — soft, bubbly, approachable.', 'font', 'font_family', 'common', 250, 0, TRUE, TRUE,
      '{"font_family":"''Fredoka'', sans-serif","font_preset":"fredoka","font_url":"https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&display=swap","font_weight":"600"}',
      '{"preview":"linear-gradient(135deg, #a5b4fc, #67e8f9)","colors":{"primary":"#a5b4fc"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Cinzel Royal Font') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Cinzel Royal Font', 'Ancient roman inscriptional capitals — fit for a king.', 'font', 'font_family', 'epic', 500, 0, TRUE, TRUE,
      '{"font_family":"''Cinzel'', serif","font_preset":"cinzel","font_url":"https://fonts.googleapis.com/css2?family=Cinzel:wght@500;800&display=swap","font_weight":"700"}',
      '{"preview":"linear-gradient(135deg, #fbbf24, #fde68a)","colors":{"primary":"#fbbf24"}}', 0, 0, NOW(), NOW());
  END IF;

  -- ---- Theme palettes ------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Sakura Dream Theme') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Sakura Dream Theme', 'Soft pink sakura palette with petal-pink accents and a calm bloom.', 'theme', 'profile_theme', 'epic', 900, 0, TRUE, TRUE,
      '{"theme_id":"sakura-dream","colors":{"primary":"#f472b6","secondary":"#fb7185","accent":"#fbcfe8","background":"#1c0f18","surface":"#2a1522","text":"#fce7f3"},"effects":{"glow":true,"particles":true}}',
      '{"preview":"linear-gradient(135deg, #f472b6, #fbcfe8)","colors":{"primary":"#f472b6","secondary":"#fb7185"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Ocean Tide Theme') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Ocean Tide Theme', 'Deep-sea blues and teal surf accents — calm, deep, alive.', 'theme', 'profile_theme', 'epic', 900, 0, TRUE, TRUE,
      '{"theme_id":"ocean-tide","colors":{"primary":"#0ea5e9","secondary":"#06b6d4","accent":"#67e8f9","background":"#020617","surface":"#0c2233","text":"#e0f2fe"},"effects":{"glow":true,"particles":true}}',
      '{"preview":"linear-gradient(135deg, #0ea5e9, #67e8f9)","colors":{"primary":"#0ea5e9","secondary":"#06b6d4"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Sunset Blaze Theme') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Sunset Blaze Theme', 'Coral and amber dusk palette — warm, loud, golden hour forever.', 'theme', 'profile_theme', 'rare', 700, 0, TRUE, TRUE,
      '{"theme_id":"sunset-blaze","colors":{"primary":"#ff6b6b","secondary":"#ffa94d","accent":"#ff1744","background":"#1c0f0a","surface":"#2a1710","text":"#fff3e0"},"effects":{"glow":true,"particles":true}}',
      '{"preview":"linear-gradient(135deg, #ff6b6b, #ffa94d)","colors":{"primary":"#ff6b6b","secondary":"#ffa94d"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Royal Gold Theme') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Royal Gold Theme', 'Violet velvet with molten-gold accents — nobility in every pixel.', 'theme', 'profile_theme', 'legendary', 1500, 0, TRUE, TRUE,
      '{"theme_id":"royal-gold","colors":{"primary":"#8b5cf6","secondary":"#fbbf24","accent":"#c4b5fd","background":"#0b0714","surface":"#170f2b","text":"#f3e8ff"},"effects":{"glow":true,"particles":true}}',
      '{"preview":"linear-gradient(135deg, #8b5cf6, #fbbf24)","colors":{"primary":"#8b5cf6","secondary":"#fbbf24"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Cyber Strike Theme') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Cyber Strike Theme', 'Acid-green and electric-cyan cyber palette — loud and proud.', 'theme', 'profile_theme', 'epic', 950, 0, TRUE, TRUE,
      '{"theme_id":"cyber-strike","colors":{"primary":"#00ff88","secondary":"#00ccff","accent":"#ff0080","background":"#050b0a","surface":"#0d1a16","text":"#eafff5"},"effects":{"glow":true,"particles":true}}',
      '{"preview":"linear-gradient(135deg, #00ff88, #00ccff)","colors":{"primary":"#00ff88","secondary":"#00ccff"}}', 0, 0, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Arctic Frost Theme') THEN
    INSERT INTO shop_items (name, description, category, item_type, rarity, price_coins, price_usd, premium_only, is_active, item_data, preview_data, rating_average, rating_count, updated_at, created_at)
    VALUES ('Arctic Frost Theme', 'Icy blue-white palette — clean, cold, crystalline.', 'theme', 'profile_theme', 'rare', 650, 0, TRUE, TRUE,
      '{"theme_id":"arctic-frost","colors":{"primary":"#7dd3fc","secondary":"#e0f2fe","accent":"#38bdf8","background":"#020617","surface":"#0f1b2e","text":"#f0f9ff"},"effects":{"glow":true,"particles":false}}',
      '{"preview":"linear-gradient(135deg, #7dd3fc, #e0f2fe)","colors":{"primary":"#7dd3fc","secondary":"#e0f2fe"}}', 0, 0, NOW(), NOW());
  END IF;
END $$;
