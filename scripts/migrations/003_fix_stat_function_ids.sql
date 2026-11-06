-- ============================================================
-- 003 — Loop stat + ad counter functions must accept the ids the app
-- actually stores, and must not be ambiguous about `loop_id`.
--
-- loops.id and loop_stats.loop_id are TEXT holding 19-digit Snowflake
-- values, and ads.id is BIGINT, but these functions were written against
-- UUID. Every like, view, comment, share and ad impression therefore threw
--
--   invalid input syntax for type uuid: "1791572674981992454"
--
-- A second bug hid behind the first: the parameter and the column share the
-- name `loop_id`, so any statement that ran once a stats row existed failed
-- with "column reference loop_id is ambiguous". Both are fixed here: the
-- parameter is text, the column is always qualified, and the upsert targets
-- the real primary key instead of re-inferring it.
--
-- Safe to re-run: the uuid overloads are dropped, then recreated as text /
-- bigint. No rows are modified by this migration.
-- ============================================================

BEGIN;

-- ── Loop stats ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.increment_loop_likes(uuid);
DROP FUNCTION IF EXISTS public.decrement_loop_likes(uuid);
DROP FUNCTION IF EXISTS public.increment_loop_views(uuid);
DROP FUNCTION IF EXISTS public.increment_loop_shares(uuid);
DROP FUNCTION IF EXISTS public.increment_loop_comments(uuid);

CREATE OR REPLACE FUNCTION public.increment_loop_likes(loop_id text)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO loop_stats (loop_id, likes_count, comments_count, shares_count, views_count, branches_count)
  VALUES (increment_loop_likes.loop_id, 1, 0, 0, 0, 0)
  ON CONFLICT ON CONSTRAINT loop_stats_pkey
  DO UPDATE SET
    likes_count = loop_stats.likes_count + 1,
    updated_at = NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrement_loop_likes(loop_id text)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE loop_stats
  SET
    likes_count = GREATEST(0, loop_stats.likes_count - 1),
    updated_at = NOW()
  WHERE loop_stats.loop_id = decrement_loop_likes.loop_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_loop_views(loop_id text)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO loop_stats (loop_id, likes_count, comments_count, shares_count, views_count, branches_count)
  VALUES (increment_loop_views.loop_id, 0, 0, 0, 1, 0)
  ON CONFLICT ON CONSTRAINT loop_stats_pkey
  DO UPDATE SET
    views_count = loop_stats.views_count + 1,
    updated_at = NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_loop_shares(loop_id text)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO loop_stats (loop_id, likes_count, comments_count, shares_count, views_count, branches_count)
  VALUES (increment_loop_shares.loop_id, 0, 0, 1, 0, 0)
  ON CONFLICT ON CONSTRAINT loop_stats_pkey
  DO UPDATE SET
    shares_count = loop_stats.shares_count + 1,
    updated_at = NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_loop_comments(loop_id text)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO loop_stats (loop_id, likes_count, comments_count, shares_count, views_count, branches_count)
  VALUES (increment_loop_comments.loop_id, 0, 1, 0, 0, 0)
  ON CONFLICT ON CONSTRAINT loop_stats_pkey
  DO UPDATE SET
    comments_count = loop_stats.comments_count + 1,
    updated_at = NOW();
END;
$function$;

-- ── Ad counters ───────────────────────────────────────────────
-- ads.id is bigint; the uuid signature made every impression log an error.
DROP FUNCTION IF EXISTS public.increment_ad_counter(uuid, text);

CREATE OR REPLACE FUNCTION public.increment_ad_counter(p_ad_id bigint, p_column text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF p_column = 'clicks' THEN
    UPDATE public.ads SET clicks = clicks + 1, updated_at = now() WHERE id = p_ad_id;
  ELSE
    UPDATE public.ads SET impressions = impressions + 1, updated_at = now() WHERE id = p_ad_id;
  END IF;
END;
$function$;

COMMIT;
