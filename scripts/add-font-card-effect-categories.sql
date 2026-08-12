-- Adds "font" and "card_effect" as valid shop_items categories, needed for
-- the admin-manageable cosmetic catalog (custom display-name fonts + post
-- card effects). Safe to run multiple times.
--
-- Some schema eras define shop_items.category as a Postgres ENUM
-- (shop_category) rather than free text. If that enum exists, inserting a
-- shop_item with category = 'font' or 'card_effect' will fail with
-- "invalid input value for enum shop_category" until these values are
-- added. If your shop_items.category is already TEXT/VARCHAR, this script
-- is a no-op.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_category') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'shop_category' AND e.enumlabel = 'font'
    ) THEN
      ALTER TYPE shop_category ADD VALUE 'font';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'shop_category' AND e.enumlabel = 'card_effect'
    ) THEN
      ALTER TYPE shop_category ADD VALUE 'card_effect';
    END IF;
  END IF;
END $$;
