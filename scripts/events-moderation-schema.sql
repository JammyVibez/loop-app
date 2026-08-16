-- Events Stage Moderation & Restrictions Migration
-- Fixes: "can't end event" (missing ended_at), event creation rules,
-- mute/unmute (all + individual), per-event audience restrictions, and
-- message moderation (delete / soft-delete).

-- 1. events: ended_at (end-event action previously 500'd on missing column),
--    circle_id (already written by the create route), and allow_type
--    (audience restriction: everyone | pro | verified | organization).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='ended_at') THEN
        ALTER TABLE public.events ADD COLUMN ended_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='circle_id') THEN
        ALTER TABLE public.events ADD COLUMN circle_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='allow_type') THEN
        ALTER TABLE public.events ADD COLUMN allow_type TEXT DEFAULT 'everyone';
    END IF;
END $$;

-- 2. event_participants: is_muted for per-user stage mutes.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_participants' AND column_name='is_muted') THEN
        ALTER TABLE public.event_participants ADD COLUMN is_muted BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_participants' AND column_name='muted_at') THEN
        ALTER TABLE public.event_participants ADD COLUMN muted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 3. event_messages: soft-delete for moderation (keeps audit trail, lets
--    Realtime consumers drop the bubble without a row disappearing).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_messages' AND column_name='is_deleted') THEN
        ALTER TABLE public.event_messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_messages' AND column_name='deleted_at') THEN
        ALTER TABLE public.event_messages ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 4. event_rsvps — official (global_events) RSVPs, referenced by the
--    participants API for both event types.
CREATE TABLE IF NOT EXISTS public.event_rsvps (
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON public.event_rsvps(event_id);

-- 5. event_mutes — stage-wide mute tracking. A row with user_id NULL means
--    "everyone muted" (host mute-all); rows with a user_id are individual
--    mutes. un_muted_until NULL = indefinite.
CREATE TABLE IF NOT EXISTS public.event_mutes (
    event_id TEXT NOT NULL,
    user_id TEXT,
    muted_until TIMESTAMP WITH TIME ZONE,
    muted_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_mutes_event ON public.event_mutes(event_id);

-- RLS: keep the API-driver pattern used by the other event tables (open to
-- service-role-backed API routes, realtime reads for the room).
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all event_rsvps" ON public.event_rsvps;
CREATE POLICY "Allow all event_rsvps" ON public.event_rsvps FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all event_mutes" ON public.event_mutes;
CREATE POLICY "Allow all event_mutes" ON public.event_mutes FOR ALL USING (true) WITH CHECK (true);

-- Realtime: stage chat + roster + mutes sync live.
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_mutes;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
