-- ------------------------------------------------------------------
-- Fix: "profile_1.cosmetic does not exist" (PGRST / raw Postgres 500
-- from feed, For You / ML recommendations, comments, conversations).
--
-- The `profiles` table only ever got `active_cosmetics`, but the feed
-- selects `active_cosmetics, cosmetics` from embedded author profiles.
-- When a loop branches (parent_loop embed → second profiles join),
-- PostgREST aliases the second join as `profile_1` and the missing
-- column makes the whole query fail — which also hid branched posts
-- from the For You tab.
--
-- Adding the column (plus a singular `cosmetic` alias for any query
-- that references that spelling) makes every embed resolve. PostgREST
-- reloads its schema cache after the migration, so the fix applies
-- without a redeploy.
-- ------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cosmetics JSONB DEFAULT '{}'::jsonb;

-- Compatibility alias for the exact column name reported in the error.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cosmetic JSONB DEFAULT '{}'::jsonb;

-- Mirror the user's equipped look into the new column so selects that
-- read `cosmetics` still return what's actually active.
UPDATE public.profiles
SET cosmetics = active_cosmetics
WHERE active_cosmetics IS NOT NULL
  AND active_cosmetics <> '{}'::jsonb
  AND (cosmetics IS NULL OR cosmetics = '{}'::jsonb);
