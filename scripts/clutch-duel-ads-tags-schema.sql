-- ============================================================================
-- Clutch Duel + Admin Ad System + Circle Tags & Comment Replies
-- Run with the service-role database connection (idempotent, safe to re-run).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CLUTCH DUEL — a themed extension of the existing Duel engine.
-- loop_duels gains a duel_type + clutch-specific columns; predictions are a
-- new table so the regular duel vote flow is untouched.
-- ----------------------------------------------------------------------------
ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS duel_type TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS clip_url TEXT;
ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS prediction_question TEXT;
ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS betting_ends_at TIMESTAMPTZ;
ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS correct_side TEXT;
ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS outcome_revealed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS payout_processed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS yes_stake BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS no_stake BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.clutch_duel_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    duel_id UUID NOT NULL REFERENCES public.loop_duels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
    stake_coins INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (duel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_clutch_predictions_duel_id ON public.clutch_duel_predictions(duel_id);
CREATE INDEX IF NOT EXISTS idx_clutch_predictions_user_id ON public.clutch_duel_predictions(user_id);

-- Live prediction bars stream over realtime.
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clutch_duel_predictions;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. ADMIN-CONTROLLED AD SYSTEM
-- ads: the creatives. ad_settings: single-row master switch + frequency +
-- surface placement control.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_name TEXT NOT NULL,
    headline TEXT NOT NULL,
    description TEXT,
    media_url TEXT,
    media_type TEXT NOT NULL DEFAULT 'image',
    link_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_active ON public.ads(is_active);

CREATE TABLE IF NOT EXISTS public.ad_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    enabled BOOLEAN NOT NULL DEFAULT false,
    frequency_min INTEGER NOT NULL DEFAULT 50,
    frequency_max INTEGER NOT NULL DEFAULT 70,
    surfaces JSONB NOT NULL DEFAULT '{"home": true, "circles": false, "explore": false}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ad_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ad_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ad_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id ON public.ad_impressions(ad_id);

-- Atomic per-ad counter bump (impressions/clicks), used by /api/ads/track.
CREATE OR REPLACE FUNCTION public.increment_ad_counter(p_ad_id UUID, p_column TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_column = 'clicks' THEN
        UPDATE public.ads SET clicks = clicks + 1, updated_at = now() WHERE id = p_ad_id;
    ELSE
        UPDATE public.ads SET impressions = impressions + 1, updated_at = now() WHERE id = p_ad_id;
    END IF;
END;
$$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ads;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. CIRCLE POST TAGS + COMMENT REPLIES
-- circle_tags: admin-curated tag vocabulary per circle. circle_posts.tags:
-- tags a poster attached (validated against circle_tags server-side).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (circle_id, name)
);

CREATE INDEX IF NOT EXISTS idx_circle_tags_circle_id ON public.circle_tags(circle_id);

ALTER TABLE public.circle_posts ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Threaded comment replies (safe add — API already writes this column).
ALTER TABLE public.circle_post_comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES public.circle_post_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_circle_post_comments_parent ON public.circle_post_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_circle_post_comments_post_id ON public.circle_post_comments(post_id);
