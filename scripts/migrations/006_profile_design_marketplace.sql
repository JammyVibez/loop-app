-- Profile Design Studio + creator marketplace.
-- Run after 005_profile_custom_css.sql. Safe to re-run.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_layout jsonb NOT NULL
    DEFAULT '{"version":1,"sections":["cover","profile","content"],"sidebar":["avatar-actions","identity","bio","details","stats","awards","progress","organization","cosmetics"],"tabs":["about","loops","branches","media","work","awards"],"hidden":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_design_css text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_profile_design_css_byte_limit'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_profile_design_css_byte_limit
      CHECK (octet_length(profile_design_css) <= 21000);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.profile_design_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title varchar(72) NOT NULL,
  summary varchar(180) NOT NULL,
  description varchar(1600) NOT NULL,
  category text NOT NULL DEFAULT 'creative',
  tags text[] NOT NULL DEFAULT '{}',
  cover_url text,
  price_coins integer NOT NULL DEFAULT 0 CHECK (price_coins BETWEEN 0 AND 100000),
  design_layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  design_css text NOT NULL DEFAULT '',
  theme_tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'archived')),
  featured boolean NOT NULL DEFAULT false,
  purchase_count integer NOT NULL DEFAULT 0,
  rating_average numeric(3,2) NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  moderation_note varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (octet_length(design_css) <= 21000)
);

CREATE INDEX IF NOT EXISTS profile_design_listings_discovery_idx
  ON public.profile_design_listings (status, featured DESC, purchase_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_design_listings_creator_idx
  ON public.profile_design_listings (creator_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS profile_design_listings_category_idx
  ON public.profile_design_listings (category, status);

CREATE TABLE IF NOT EXISTS public.profile_design_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.profile_design_listings(id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title_snapshot varchar(72) NOT NULL,
  layout_snapshot jsonb NOT NULL,
  css_snapshot text NOT NULL DEFAULT '',
  theme_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_coins integer NOT NULL CHECK (price_coins >= 0),
  creator_earning_coins integer NOT NULL CHECK (creator_earning_coins >= 0),
  platform_fee_coins integer NOT NULL CHECK (platform_fee_coins >= 0),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_id),
  CHECK (octet_length(css_snapshot) <= 21000)
);

CREATE INDEX IF NOT EXISTS profile_design_purchases_buyer_idx
  ON public.profile_design_purchases (buyer_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS profile_design_purchases_creator_idx
  ON public.profile_design_purchases (creator_id, purchased_at DESC);

CREATE TABLE IF NOT EXISTS public.profile_design_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.profile_design_listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review text NOT NULL DEFAULT '' CHECK (char_length(review) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS profile_design_reviews_listing_idx
  ON public.profile_design_reviews (listing_id, created_at DESC);

ALTER TABLE public.profile_design_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_design_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_design_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published profile designs are public" ON public.profile_design_listings;
CREATE POLICY "Published profile designs are public"
  ON public.profile_design_listings FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Reviews are public" ON public.profile_design_reviews;
CREATE POLICY "Reviews are public"
  ON public.profile_design_reviews FOR SELECT
  USING (true);

-- A single transaction prevents double-spends, duplicate inventory grants and
-- partial creator payouts when multiple people buy the same design together.
CREATE OR REPLACE FUNCTION public.purchase_profile_design(
  p_listing_id uuid,
  p_buyer_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  design public.profile_design_listings%ROWTYPE;
  buyer_balance integer;
  creator_share integer;
  platform_share integer;
BEGIN
  SELECT * INTO design
  FROM public.profile_design_listings
  WHERE id = p_listing_id AND status = 'published'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DESIGN_NOT_AVAILABLE';
  END IF;
  IF design.creator_id = p_buyer_id THEN
    RAISE EXCEPTION 'CANNOT_BUY_OWN_DESIGN';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profile_design_purchases
    WHERE listing_id = p_listing_id AND buyer_id = p_buyer_id
  ) THEN
    RAISE EXCEPTION 'DESIGN_ALREADY_OWNED';
  END IF;

  SELECT loop_coins INTO buyer_balance
  FROM public.profiles
  WHERE id = p_buyer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BUYER_PROFILE_NOT_FOUND';
  END IF;
  IF COALESCE(buyer_balance, 0) < design.price_coins THEN
    RAISE EXCEPTION 'INSUFFICIENT_LOOP_COINS';
  END IF;

  creator_share := CASE WHEN design.price_coins = 0 THEN 0 ELSE GREATEST(1, floor(design.price_coins * 0.85)::integer) END;
  platform_share := design.price_coins - creator_share;

  UPDATE public.profiles
  SET loop_coins = COALESCE(loop_coins, 0) - design.price_coins,
      updated_at = now()
  WHERE id = p_buyer_id;

  UPDATE public.profiles
  SET loop_coins = COALESCE(loop_coins, 0) + creator_share,
      updated_at = now()
  WHERE id = design.creator_id;

  INSERT INTO public.profile_design_purchases (
    listing_id, buyer_id, creator_id, title_snapshot,
    layout_snapshot, css_snapshot, theme_snapshot,
    price_coins, creator_earning_coins, platform_fee_coins
  ) VALUES (
    design.id, p_buyer_id, design.creator_id, design.title,
    design.design_layout, design.design_css, design.theme_tokens,
    design.price_coins, creator_share, platform_share
  );

  UPDATE public.profile_design_listings
  SET purchase_count = purchase_count + 1, updated_at = now()
  WHERE id = design.id;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', design.id,
    'title', design.title,
    'price_coins', design.price_coins,
    'creator_earning_coins', creator_share,
    'platform_fee_coins', platform_share
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_profile_design(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_profile_design(uuid, uuid) TO service_role;

COMMIT;
