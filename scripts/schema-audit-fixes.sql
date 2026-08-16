-- Schema Audit Fixes
-- Adds every column/table that the full schema audit (scripts/schema-audit.mjs)
-- proved the live code references but the live Supabase schema was missing.
-- Idempotent: safe to run repeatedly.

-- ============================================================
-- messages — edit/delete routes write updated_at; reply threads
-- reference reply_to_id (table only had reply_to_message_id).
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='updated_at') THEN
        ALTER TABLE public.messages ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='reply_to_id') THEN
        ALTER TABLE public.messages ADD COLUMN reply_to_id TEXT;
    END IF;
END $$;

-- ============================================================
-- circle_members — admin ban/role PUT writes ban_reason,
-- banned_until and updated_at.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='circle_members' AND column_name='ban_reason') THEN
        ALTER TABLE public.circle_members ADD COLUMN ban_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='circle_members' AND column_name='banned_until') THEN
        ALTER TABLE public.circle_members ADD COLUMN banned_until TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='circle_members' AND column_name='updated_at') THEN
        ALTER TABLE public.circle_members ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- ============================================================
-- shop_items — inventory apply/remove + feed cosmetics select
-- icon_url / preview_url; admin POST sends price (mapped to
-- price_coins in code). Backfill icon/preview from thumbnail_url.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shop_items' AND column_name='icon_url') THEN
        ALTER TABLE public.shop_items ADD COLUMN icon_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shop_items' AND column_name='preview_url') THEN
        ALTER TABLE public.shop_items ADD COLUMN preview_url TEXT;
    END IF;
END $$;

UPDATE public.shop_items
SET icon_url = COALESCE(icon_url, thumbnail_url),
    preview_url = COALESCE(preview_url, thumbnail_url)
WHERE thumbnail_url IS NOT NULL AND (icon_url IS NULL OR preview_url IS NULL);

-- ============================================================
-- loop_duels — clutch-duel reveal route writes updated_at.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loop_duels' AND column_name='updated_at') THEN
        ALTER TABLE public.loop_duels ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- ============================================================
-- live_streams — stream notifications route best-effort is_live.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='live_streams' AND column_name='is_live') THEN
        ALTER TABLE public.live_streams ADD COLUMN is_live BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- ============================================================
-- circles — search selects cover_url / is_public / slug; table
-- only had banner_url / is_private. Backfill from existing data.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='circles' AND column_name='cover_url') THEN
        ALTER TABLE public.circles ADD COLUMN cover_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='circles' AND column_name='is_public') THEN
        ALTER TABLE public.circles ADD COLUMN is_public BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='circles' AND column_name='slug') THEN
        ALTER TABLE public.circles ADD COLUMN slug TEXT;
    END IF;
END $$;

UPDATE public.circles
SET cover_url = COALESCE(cover_url, banner_url),
    is_public = COALESCE(is_public, NOT COALESCE(is_private, false))
WHERE cover_url IS NULL OR is_public IS NULL;

-- ============================================================
-- profiles — admin verification writes verified_at.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='verified_at') THEN
        ALTER TABLE public.profiles ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- ============================================================
-- media_uploads — upload route inserts Cloudinary-aligned columns
-- (file_name, file_size, cloudinary_public_id, cloudinary_url,
-- media_type, folder, width, height, duration, format) and the
-- DELETE route looks up by cloudinary_public_id. Table only had
-- the legacy file_url/bytes/provider/metadata shape.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_uploads' AND column_name='file_name') THEN
        ALTER TABLE public.media_uploads ADD COLUMN file_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_uploads' AND column_name='file_size') THEN
        ALTER TABLE public.media_uploads ADD COLUMN file_size BIGINT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_uploads' AND column_name='cloudinary_public_id') THEN
        ALTER TABLE public.media_uploads ADD COLUMN cloudinary_public_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_uploads' AND column_name='cloudinary_url') THEN
        ALTER TABLE public.media_uploads ADD COLUMN cloudinary_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_uploads' AND column_name='media_type') THEN
        ALTER TABLE public.media_uploads ADD COLUMN media_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_uploads' AND column_name='folder') THEN
        ALTER TABLE public.media_uploads ADD COLUMN folder TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_uploads' AND column_name='width') THEN
        ALTER TABLE public.media_uploads ADD COLUMN width INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_uploads' AND column_name='height') THEN
        ALTER TABLE public.media_uploads ADD COLUMN height INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_uploads' AND column_name='duration') THEN
        ALTER TABLE public.media_uploads ADD COLUMN duration DOUBLE PRECISION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media_uploads' AND column_name='format') THEN
        ALTER TABLE public.media_uploads ADD COLUMN format TEXT;
    END IF;
END $$;

-- Backfill legacy rows so existing media stays addressable.
UPDATE public.media_uploads
SET cloudinary_public_id = COALESCE(cloudinary_public_id, metadata->>'public_id', provider),
    cloudinary_url = COALESCE(cloudinary_url, file_url),
    media_type = COALESCE(media_type, file_type),
    file_name = COALESCE(file_name, metadata->>'original_filename', 'upload'),
    file_size = COALESCE(file_size, bytes)
WHERE cloudinary_public_id IS NULL OR cloudinary_url IS NULL;

-- ============================================================
-- conversations — co-loop invite inserts type: 'direct'.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='type') THEN
        ALTER TABLE public.conversations ADD COLUMN type TEXT DEFAULT 'direct';
    END IF;
END $$;

-- ============================================================
-- user_inventory — Stripe webhook upserts payment_method /
-- purchased_at / source (table only had acquired_at).
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_inventory' AND column_name='payment_method') THEN
        ALTER TABLE public.user_inventory ADD COLUMN payment_method TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_inventory' AND column_name='purchased_at') THEN
        ALTER TABLE public.user_inventory ADD COLUMN purchased_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_inventory' AND column_name='source') THEN
        ALTER TABLE public.user_inventory ADD COLUMN source TEXT;
    END IF;
END $$;

-- ============================================================
-- achievements — /api/users/achievements selects level,
-- coins_reward, icon (table only had icon_url / coin_reward /
-- xp_reward). Backfill from the canonical columns.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='achievements' AND column_name='level') THEN
        ALTER TABLE public.achievements ADD COLUMN level TEXT DEFAULT 'bronze';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='achievements' AND column_name='coins_reward') THEN
        ALTER TABLE public.achievements ADD COLUMN coins_reward INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='achievements' AND column_name='icon') THEN
        ALTER TABLE public.achievements ADD COLUMN icon TEXT;
    END IF;
END $$;

UPDATE public.achievements
SET coins_reward = COALESCE(coins_reward, coin_reward, 0),
    icon = COALESCE(icon, icon_url)
WHERE coins_reward IS NULL OR icon IS NULL;

-- ============================================================
-- user_achievements — API orders by earned_at (table had
-- unlocked_at). Backfill from unlocked_at.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_achievements' AND column_name='earned_at') THEN
        ALTER TABLE public.user_achievements ADD COLUMN earned_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

UPDATE public.user_achievements
SET earned_at = COALESCE(earned_at, unlocked_at)
WHERE earned_at IS NULL AND unlocked_at IS NOT NULL;

-- ============================================================
-- user_stats — referenced by /api/users/achievements (stats
-- card). Created here so the query stops 500ing.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    loops_created INTEGER DEFAULT 0,
    total_likes_received INTEGER DEFAULT 0,
    total_comments_received INTEGER DEFAULT 0,
    total_shares_received INTEGER DEFAULT 0,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    loops_liked INTEGER DEFAULT 0,
    comments_made INTEGER DEFAULT 0,
    consecutive_days_active INTEGER DEFAULT 0,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON public.user_stats(user_id);

-- ============================================================
-- event_rsvps — live table has an `id` column (older shape) but
-- the events API upserts on (event_id, user_id). Dedupe any stray
-- duplicates, then add the unique index so upsert onConflict works.
-- ============================================================
DELETE FROM public.event_rsvps a
USING public.event_rsvps b
WHERE a.ctid < b.ctid
  AND a.event_id = b.event_id
  AND a.user_id = b.user_id;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_rsvps_event_user') THEN
        CREATE UNIQUE INDEX idx_event_rsvps_event_user ON public.event_rsvps(event_id, user_id);
    END IF;
END $$;

-- ============================================================
-- Realtime: messages, circle_members, loop_duels, live_streams,
-- shop_items and media_uploads changes flow to live clients.
-- ============================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_members;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.loop_duels;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_items;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.media_uploads;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
