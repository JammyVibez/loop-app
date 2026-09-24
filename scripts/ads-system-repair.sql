-- ─────────────────────────────────────────────────────────────────────────────
-- ads-system-repair — make the ad system actually serve.
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   "The ads system isn't working" turned out to be three legacy defaults in the
--   original `ad_settings` row, none of which the app could recover from:
--
--     1. enabled          DEFAULT false   → nothing was ever served until an
--                                           admin found the master switch.
--     2. frequency_min/max DEFAULT 50/70  → a sponsored slot sat 50–70 posts
--                                           down the feed, i.e. past the end of
--                                           almost every session. It looked
--                                           broken precisely because it worked.
--     3. surfaces         DEFAULT {"home": true, "circles": false,
--                                  "explore": false}
--                                         → those two placements were stored
--                                           OFF, and the keys the app actually
--                                           renders (communities, notifications,
--                                           world, developers) didn't exist yet.
--
--   This is idempotent and safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Canonical placement set: every surface the app can render, all on unless an
--    admin has deliberately switched one off. Merged rather than overwritten so
--    an existing deliberate choice (false) is preserved.
UPDATE public.ad_settings AS s
SET surfaces = COALESCE(s.surfaces, '{}'::jsonb)
             || jsonb_build_object(
                  'home',          COALESCE((s.surfaces ->> 'home'),          'true')::boolean,
                  'communities',   COALESCE((s.surfaces ->> 'communities'),   'true')::boolean,
                  'circles',       COALESCE((s.surfaces ->> 'circles'),       'true')::boolean,
                  'notifications', COALESCE((s.surfaces ->> 'notifications'), 'true')::boolean,
                  'world',         COALESCE((s.surfaces ->> 'world'),         'true')::boolean,
                  'developers',    COALESCE((s.surfaces ->> 'developers'),    'true')::boolean,
                  'explore',       COALESCE((s.surfaces ->> 'explore'),       'true')::boolean
                )
WHERE s.id = 'default'
  -- Only rows still on the legacy/absent shape need touching.
  AND (
        s.surfaces IS NULL
     OR NOT (s.surfaces ? 'developers')
     OR (s.surfaces ->> 'circles') = 'false'
     OR (s.surfaces ->> 'explore') = 'false'
  );

-- 2. Reachable pacing. Only rewrites the untouched legacy 50/70 pair, so an
--    admin's own numbers are never clobbered.
UPDATE public.ad_settings
SET frequency_min = 10,
    frequency_max = 16,
    updated_at    = now()
WHERE id = 'default'
  AND frequency_min = 50
  AND frequency_max = 70;

-- 3. Turn the system on when there is something to show. An install with no
--    creatives stays off (there would be nothing to serve anyway); the moment an
--    ad exists and is active, the master switch stops being the reason it's dark.
UPDATE public.ad_settings AS s
SET enabled    = true,
    updated_at = now()
WHERE s.id = 'default'
  AND s.enabled = false
  AND EXISTS (SELECT 1 FROM public.ads a WHERE a.is_active);

INSERT INTO public.ad_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Report the resulting state so the run is self-explanatory.
SELECT id,
       enabled,
       frequency_min,
       frequency_max,
       surfaces
FROM public.ad_settings
WHERE id = 'default';
