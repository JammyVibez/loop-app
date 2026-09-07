-- Profile pronouns (replaces the earlier name-pronunciation chip).
--
-- Lets users show how they want to be referred to, e.g. "she/her",
-- "he/him", "they/them" or any custom set. Rendered as a small pill next
-- to the display name on profiles.
--
-- Idempotent: safe to run repeatedly. Applied with:
--   node scripts/apply-pending-schema.mjs scripts/profile-pronouns-schema.sql

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pronouns TEXT;

COMMENT ON COLUMN public.profiles.pronouns
  IS 'Profile pronouns displayed next to the display name (e.g. "she/her", "he/him", "they/them").';
