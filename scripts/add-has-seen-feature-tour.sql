-- One-time on-feed coach-mark tour.
--
-- `has_seen_feature_tour` is set on profiles the first time the feed tour is
-- finished or skipped, so it never repeats on later logins. Settings → About
-- can clear it to replay the tour on demand.
--
-- Idempotent: safe to re-run.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS has_seen_feature_tour BOOLEAN NOT NULL DEFAULT false;

-- Accounts that predate the tour keep the default (false) so they see it once.
UPDATE profiles
  SET has_seen_feature_tour = false
  WHERE has_seen_feature_tour IS NULL;
