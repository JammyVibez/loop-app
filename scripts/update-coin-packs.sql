-- =============================================================
-- Update coin packages: reduce bonuses, add more tiers
-- Safe to re-run — uses ON CONFLICT WHERE to only update existing.
-- =============================================================

-- 1. Reduce bonuses on existing packs
UPDATE shop_items
SET
  item_data = jsonb_set(
    item_data,
    '{bonus}',
    '0'
  ),
  description = '250 Loop Coins'
WHERE name = 'Mini Pack' AND category = 'coins';

UPDATE shop_items
SET
  item_data = jsonb_set(
    item_data,
    '{bonus}',
    '25'
  ),
  description = '500 Loop Coins + 25 bonus'
WHERE name = 'Quick Pack' AND category = 'coins';

UPDATE shop_items
SET
  item_data = jsonb_set(
    item_data,
    '{bonus}',
    '1000'
  ),
  description = '2,500 Loop Coins + 1,000 bonus'
WHERE name = 'Starter Pack' AND category = 'coins' AND item_data->>'coins_amount' = '2500';

UPDATE shop_items
SET
  item_data = jsonb_set(
    item_data,
    '{bonus}',
    '500'
  ),
  description = '1,000 Loop Coins + 500 bonus'
WHERE name = 'Bronze Pack' AND category = 'coins' AND item_data->>'coins_amount' = '1000';

UPDATE shop_items
SET
  item_data = jsonb_set(
    item_data,
    '{bonus}',
    '500'
  ),
  description = '5,000 Loop Coins + 500 bonus'
WHERE name = 'Silver Pack' AND category = 'coins' AND item_data->>'coins_amount' = '5000';

UPDATE shop_items
SET
  item_data = jsonb_set(
    item_data,
    '{bonus}',
    '1000'
  ),
  description = '10,000 Loop Coins + 1,000 bonus'
WHERE name = 'Gold Pack' AND category = 'coins' AND item_data->>'coins_amount' = '10000';

UPDATE shop_items
SET
  item_data = jsonb_set(
    item_data,
    '{bonus}',
    '1000'
  ),
  description = '25,000 Loop Coins + 1,000 bonus'
WHERE name = 'Champion Pack' AND category = 'coins';

UPDATE shop_items
SET
  item_data = jsonb_set(
    item_data,
    '{bonus}',
    '2500'
  ),
  description = '50,000 Loop Coins + 2,500 bonus'
WHERE name = 'Legend Pack' AND category = 'coins';

UPDATE shop_items
SET
  item_data = jsonb_set(
    item_data,
    '{bonus}',
    '5000'
  ),
  description = '100,000 Loop Coins + 5,000 bonus'
WHERE name = 'Creator Pack' AND category = 'coins';

-- 2. Add new mid-tier packs
INSERT INTO shop_items (name, description, price_coins, price_usd, category, item_type, rarity, premium_only, item_data, preview_data, is_active)
SELECT 'Plus Pack', '1,000 Loop Coins + 50 bonus', 0, 4.99, 'coins', 'currency', 'common', false,
  '{"coins_amount": 1000, "bonus": 50}', '{"preview": "🪙"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Plus Pack' AND category = 'coins');

INSERT INTO shop_items (name, description, price_coins, price_usd, category, item_type, rarity, premium_only, item_data, preview_data, is_active)
SELECT 'Mega Pack', '5,000 Loop Coins + 250 bonus', 0, 9.99, 'coins', 'currency', 'rare', false,
  '{"coins_amount": 5000, "bonus": 250}', '{"preview": "💎"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Mega Pack' AND category = 'coins');

INSERT INTO shop_items (name, description, price_coins, price_usd, category, item_type, rarity, premium_only, item_data, preview_data, is_active)
SELECT 'Ultra Pack', '10,000 Loop Coins + 500 bonus', 0, 19.99, 'coins', 'currency', 'epic', false,
  '{"coins_amount": 10000, "bonus": 500}', '{"preview": "⚡"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Ultra Pack' AND category = 'coins');

INSERT INTO shop_items (name, description, price_coins, price_usd, category, item_type, rarity, premium_only, item_data, preview_data, is_active)
SELECT 'Titan Pack', '200,000 Loop Coins + 8,000 bonus — the ultimate pack', 0, 399.99, 'coins', 'currency', 'legendary', false,
  '{"coins_amount": 200000, "bonus": 8000}', '{"preview": "🔥"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Titan Pack' AND category = 'coins');
