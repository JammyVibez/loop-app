-- Update cosmetics pricing: reduce prices, make most pro-only, keep some cheap for normal users

-- Make most items pro-only (legendary and epic = pro)
UPDATE cosmetics_catalog 
SET is_premium_only = TRUE 
WHERE rarity IN ('legendary', 'epic');

-- Reduce all prices significantly
UPDATE cosmetics_catalog 
SET price_coins = CASE 
  WHEN rarity = 'legendary' THEN 800
  WHEN rarity = 'epic' THEN 500
  WHEN rarity = 'rare' THEN 200
  WHEN rarity = 'common' THEN 100
  ELSE price_coins
END;

-- Keep a few common items affordable for normal users (not pro-only)
UPDATE cosmetics_catalog 
SET is_premium_only = FALSE, price_coins = 50
WHERE rarity = 'common' AND category IN ('profile_decoration', 'nameplate');

-- Make nameplates mostly pro-only except cheapest
UPDATE cosmetics_catalog 
SET is_premium_only = TRUE 
WHERE category = 'nameplate' AND rarity IN ('rare', 'epic', 'legendary');

-- Make display_name_theme mostly pro-only
UPDATE cosmetics_catalog 
SET is_premium_only = TRUE 
WHERE category = 'display_name_theme' AND rarity IN ('rare', 'epic', 'legendary');

-- Make post effects mostly pro-only
UPDATE cosmetics_catalog 
SET is_premium_only = TRUE 
WHERE category = 'post_effect' AND rarity IN ('epic', 'legendary');

-- Make profile effects mostly pro-only
UPDATE cosmetics_catalog 
SET is_premium_only = TRUE 
WHERE category = 'profile_effect' AND rarity IN ('epic', 'legendary');

-- Keep post decorations affordable for normal users (rare ones)
UPDATE cosmetics_catalog 
SET is_premium_only = FALSE, price_coins = 150
WHERE category = 'post_decoration' AND rarity = 'rare';

-- Print summary
SELECT category, rarity, is_premium_only, price_coins, name 
FROM cosmetics_catalog 
ORDER BY category, price_coins;
