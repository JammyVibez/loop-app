-- ─────────────────────────────────────────────────────────────────────────────
-- global_events — official, platform-wide events (Admin → Events)
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   The events hub (/api/events), the event detail page, the participants API
--   and the admin Events tab all read and write `global_events`, but no schema
--   script ever created it. Without the table:
--     • GET  /api/admin/events silently fell back to two hard-coded demo
--       events, so the admin panel looked populated but was fake.
--     • POST /api/admin/events ignored its insert error and returned success.
--     • PUT/DELETE on those demo ids matched zero rows yet reported success.
--   "Admin events don't work" was this: a missing table plus swallowed errors.
--
-- Safe to re-run: every statement is idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.global_events (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    description     TEXT DEFAULT '',
    category        TEXT NOT NULL DEFAULT 'General',
    banner_url      TEXT,
    location_type   TEXT DEFAULT 'Virtual Stage',
    external_link   TEXT DEFAULT '',
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at         TIMESTAMPTZ,
    -- Event lifecycle: 'upcoming' | 'live' | 'ended'
    status          TEXT NOT NULL DEFAULT 'upcoming',
    is_live         BOOLEAN NOT NULL DEFAULT FALSE,
    -- Admin visibility switch (unpublished events disappear from the hub)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
    -- Rewards granted to attendees
    reward_coins    INTEGER NOT NULL DEFAULT 0,
    badge_reward    TEXT DEFAULT 'Event Participant',
    tags            JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Denormalised RSVP counter kept in sync by /api/events/[id]/participants
    rsvp_count      INTEGER NOT NULL DEFAULT 0,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ
);

-- Older deployments may already have a partial table; fill in the gaps.
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'Virtual Stage';
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS external_link TEXT DEFAULT '';
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'upcoming';
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS reward_coins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS badge_reward TEXT DEFAULT 'Event Participant';
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS rsvp_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.global_events ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_global_events_active ON public.global_events(is_active, starts_at);
CREATE INDEX IF NOT EXISTS idx_global_events_featured ON public.global_events(is_featured) WHERE is_featured;
CREATE INDEX IF NOT EXISTS idx_global_events_status ON public.global_events(status);

-- keep updated_at honest for every writer (API routes and admin panel alike)
CREATE OR REPLACE FUNCTION public.touch_global_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_global_events_updated_at ON public.global_events;
CREATE TRIGGER trg_global_events_updated_at
    BEFORE UPDATE ON public.global_events
    FOR EACH ROW EXECUTE FUNCTION public.touch_global_events_updated_at();

-- RLS: same service-role-backed API pattern as events / event_rsvps
ALTER TABLE public.global_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all global_events" ON public.global_events;
CREATE POLICY "Allow all global_events" ON public.global_events FOR ALL USING (true) WITH CHECK (true);

-- Realtime: the hub + admin panel subscribe to changes on this table.
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.global_events;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RSVP counts: /api/events/[id]/participants writes rsvp_count on this table.
-- event_rsvps.event_id is TEXT, matching global_events.id, so the counts stay
-- in sync without a foreign key (PostgREST cannot embed across the two).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recount_global_event_rsvps(p_event_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    total INTEGER;
BEGIN
    SELECT COUNT(*) INTO total FROM public.event_rsvps WHERE event_id = p_event_id;
    UPDATE public.global_events SET rsvp_count = total WHERE id = p_event_id;
    RETURN total;
END;
$$;
