-- Community marketplace: designs, component styling packs, and bot logic
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS community_marketplace_listings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  listing_type text NOT NULL CHECK (listing_type IN ('design', 'styling', 'bot')),
  title varchar(160) NOT NULL,
  description text,
  price_coins integer NOT NULL DEFAULT 0 CHECK (price_coins >= 0),
  preview_url text,
  thumbnail_url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}'::text[],
  is_published boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sales_count integer NOT NULL DEFAULT 0,
  rating_average numeric(3,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_marketplace_purchases (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id uuid NOT NULL REFERENCES community_marketplace_listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  price_paid integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_id)
);

CREATE TABLE IF NOT EXISTS community_marketplace_installs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id uuid NOT NULL REFERENCES community_marketplace_listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  circle_id uuid REFERENCES circles(id) ON DELETE CASCADE,
  install_result jsonb DEFAULT '{}'::jsonb,
  installed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cml_type ON community_marketplace_listings (listing_type);
CREATE INDEX IF NOT EXISTS idx_cml_published ON community_marketplace_listings (is_published);
CREATE INDEX IF NOT EXISTS idx_cml_seller ON community_marketplace_listings (seller_id);
CREATE INDEX IF NOT EXISTS idx_cmp_buyer ON community_marketplace_purchases (buyer_id);
CREATE INDEX IF NOT EXISTS idx_cmi_circle ON community_marketplace_installs (circle_id);

-- Soft-heal stuck onboarding for accounts that already have identity
UPDATE profiles
SET onboarding_completed = true, updated_at = now()
WHERE onboarding_completed = false
  AND username IS NOT NULL
  AND btrim(username) <> '';
