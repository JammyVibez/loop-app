-- user_inventory integrity
--
-- Two bugs with one root cause. `user_inventory.item_id` is the only thing that
-- names the item a user owns, and it is declared
--
--     REFERENCES shop_items(id) ON DELETE SET NULL
--
-- so the moment a catalogue row is deleted every inventory row that pointed at
-- it is silently rewritten to item_id = NULL. Those rows then have no name, no
-- data and no way back: the inventory renders them as the literal string
-- "Item", and equipping one fails with "Shop item missing". That is exactly the
-- state the live table is in today — 35 of 35 rows.
--
-- The fix is to stop depending on the join. An inventory row now carries its
-- own snapshot of what it is, written at the moment it is granted, so deleting
-- or re-seeding a catalogue row can never erase what somebody owns.
--
-- This file is idempotent.

-- ── 1. The snapshot ─────────────────────────────────────────────────────────
-- These are also the columns the gift-claim function in
-- comprehensive-shop-gift-system.sql and shop-reward-integration.sql already
-- write to, which is why claiming a gift never worked against this table.

ALTER TABLE user_inventory ADD COLUMN IF NOT EXISTS item_name text;
ALTER TABLE user_inventory ADD COLUMN IF NOT EXISTS item_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE user_inventory ADD COLUMN IF NOT EXISTS preview_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE user_inventory ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE user_inventory ADD COLUMN IF NOT EXISTS rarity text;
ALTER TABLE user_inventory ADD COLUMN IF NOT EXISTS acquired_from text;
ALTER TABLE user_inventory ADD COLUMN IF NOT EXISTS gift_id bigint;
ALTER TABLE user_inventory ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── 2. Backfill from the catalogue, for rows that still resolve ─────────────

UPDATE user_inventory AS ui
SET item_name = s.name,
    item_data = COALESCE(ui.item_data, s.item_data, '{}'::jsonb),
    preview_data = COALESCE(ui.preview_data, s.preview_data, '{}'::jsonb),
    category = COALESCE(ui.category, s.category),
    rarity = COALESCE(ui.rarity, s.rarity)
FROM shop_items AS s
WHERE s.id = ui.item_id
  AND (ui.item_name IS NULL OR ui.category IS NULL);

-- Rows whose item_type alone can be typed but that have no readable name get a
-- readable one, so nothing in the inventory is ever labelled "Item".
UPDATE user_inventory
SET item_name = initcap(replace(item_type, '_', ' '))
WHERE item_name IS NULL
  AND item_type IS NOT NULL
  AND item_id IS NOT NULL;

-- ── 3. The uniqueness the API already assumes ───────────────────────────────
-- Three write paths upsert with `onConflict: "user_id,item_id"` /
-- `"user_id,item_id,item_type"`. No matching unique index existed, so every one
-- of those upserts failed with 42P10 and the purchase was never granted:
-- Stripe Checkout, the payment_intent webhook and gift delivery.
--
-- Both are partial, because item_id is nullable and NULLs are distinct in
-- Postgres — a scoped index can't be relied on to deduplicate them anyway.

CREATE UNIQUE INDEX IF NOT EXISTS user_inventory_user_item_key
  ON user_inventory (user_id, item_id)
  WHERE item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_inventory_user_item_type_key
  ON user_inventory (user_id, item_id, item_type)
  WHERE item_id IS NOT NULL;

-- One active item per type per user, which is what equipping enforces in code.
-- Existing rows are reconciled first: keep the newest active row per type.
UPDATE user_inventory AS ui
SET is_active = false
WHERE ui.is_active = true
  AND EXISTS (
    SELECT 1
    FROM user_inventory AS other
    WHERE other.user_id = ui.user_id
      AND other.item_type = ui.item_type
      AND other.is_active = true
      AND (COALESCE(other.acquired_at, to_timestamp(0)), other.id)
        > (COALESCE(ui.acquired_at, to_timestamp(0)), ui.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS user_inventory_one_active_per_type
  ON user_inventory (user_id, item_type)
  WHERE is_active = true;

-- ── 4. Retire the rows that identify nothing ────────────────────────────────
-- An inventory row with no item_id and no name is not a record of anything: it
-- cannot be rendered, equipped, unequipped or resolved to a catalogue entry,
-- and there is no other table that connects it to a purchase. They are copies
-- of a pre-catalogue schema. Kept in a side table rather than dropped, so the
-- decision is auditable and reversible.

CREATE TABLE IF NOT EXISTS user_inventory_discarded (LIKE public.user_inventory INCLUDING ALL);

INSERT INTO user_inventory_discarded
SELECT * FROM user_inventory
WHERE item_id IS NULL AND item_name IS NULL
ON CONFLICT (id) DO NOTHING;

DELETE FROM user_inventory
WHERE item_id IS NULL AND item_name IS NULL;

-- ── 5. Keep the snapshot honest going forward ───────────────────────────────
-- Any insert that names its item_id copies the catalogue values automatically,
-- so no write path can forget to write the snapshot.

CREATE OR REPLACE FUNCTION user_inventory_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  src shop_items%ROWTYPE;
BEGIN
  IF NEW.item_id IS NOT NULL THEN
    SELECT * INTO src FROM shop_items WHERE id = NEW.item_id;
    IF FOUND THEN
      NEW.item_name := COALESCE(NEW.item_name, src.name);
      NEW.item_data := COALESCE(NULLIF(NEW.item_data, '{}'::jsonb), src.item_data, '{}'::jsonb);
      NEW.preview_data := COALESCE(NULLIF(NEW.preview_data, '{}'::jsonb), src.preview_data, '{}'::jsonb);
      NEW.category := COALESCE(NEW.category, src.category);
      NEW.rarity := COALESCE(NEW.rarity, src.rarity);
    END IF;
  END IF;

  IF NEW.item_name IS NULL AND NEW.item_type IS NOT NULL THEN
    NEW.item_name := initcap(replace(NEW.item_type, '_', ' '));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_inventory_snapshot_trigger ON user_inventory;
CREATE TRIGGER user_inventory_snapshot_trigger
  BEFORE INSERT OR UPDATE OF item_id ON user_inventory
  FOR EACH ROW EXECUTE FUNCTION user_inventory_snapshot();
