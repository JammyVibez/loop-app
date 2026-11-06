-- ============================================================
-- 004 — Collapse duplicated achievement definitions.
--
-- The seed inserted every achievement 17 times: `achievements` holds 68
-- rows for just 4 names ("First Loop", "Social Butterfly", "Branch Master",
-- "Community Builder"). Every award pass therefore unlocked 17 identical
-- achievements at once and wrote 17 "Achievement unlocked" notifications for
-- a single action — which is what users reported as "I got 17 rewards from
-- one post" / "17 notifications that I finished a quest".
--
-- This migration keeps the lowest id per name, repoints existing awards to
-- it, removes the now-duplicate awards and notifications, and finally blocks
-- the seed from creating duplicates again with a UNIQUE(name) index.
--
-- Safe to re-run: each step is idempotent.
-- ============================================================

BEGIN;

-- 1. Drop awards that would collide with an award the user already holds for
--    the canonical row (user_achievements is UNIQUE(user_id, achievement_id),
--    so these must go before the repoint, not after).
WITH canonical AS (
  SELECT a.id AS dup_id, c.keep_id
  FROM achievements a
  JOIN (
    SELECT name, MIN(id) AS keep_id
    FROM achievements
    GROUP BY name
    HAVING COUNT(*) > 1
  ) c ON c.name = a.name
  WHERE a.id <> c.keep_id
)
DELETE FROM user_achievements ua
USING canonical
WHERE ua.achievement_id = canonical.dup_id
  AND EXISTS (
    SELECT 1 FROM user_achievements k
    WHERE k.user_id = ua.user_id
      AND k.achievement_id = canonical.keep_id
  );

-- 2. Repoint the remaining awards at the canonical (lowest id) row.
WITH canonical AS (
  SELECT a.id AS dup_id, c.keep_id
  FROM achievements a
  JOIN (
    SELECT name, MIN(id) AS keep_id
    FROM achievements
    GROUP BY name
    HAVING COUNT(*) > 1
  ) c ON c.name = a.name
  WHERE a.id <> c.keep_id
)
UPDATE user_achievements ua
SET achievement_id = canonical.keep_id
FROM canonical
WHERE ua.achievement_id = canonical.dup_id;

-- 2b. Safety net: collapse any remaining duplicate award rows.
DELETE FROM user_achievements d
USING user_achievements k
WHERE d.user_id = k.user_id
  AND d.achievement_id = k.achievement_id
  AND d.id > k.id;

-- 3. Remove the duplicate definitions themselves.
WITH canonical AS (
  SELECT name, MIN(id) AS keep_id
  FROM achievements
  GROUP BY name
  HAVING COUNT(*) > 1
)
DELETE FROM achievements a
USING canonical
WHERE a.name = canonical.name
  AND a.id <> canonical.keep_id;

-- 4. One notification per user per achievement name (keep the earliest).
DELETE FROM notifications d
USING notifications k
WHERE d.type = 'achievement'
  AND k.type = 'achievement'
  AND d.user_id = k.user_id
  AND COALESCE(d.data ->> 'achievement_name', d.message) =
      COALESCE(k.data ->> 'achievement_name', k.message)
  AND d.id > k.id;

-- 5. Never seed the same achievement twice again.
CREATE UNIQUE INDEX IF NOT EXISTS achievements_name_key ON achievements (name);

COMMIT;
