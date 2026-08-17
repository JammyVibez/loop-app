-- ============================================================
-- 100ms realtime calls (livestream / video calls / voice calls)
-- Applies to: public.call_sessions + public.live_streams columns
-- Idempotent — safe to run multiple times.
-- ============================================================

-- Call sessions backed by 100ms rooms. One row per call; the same
-- session is used for 1:1 DM calls, group DM calls and Circle calls.
CREATE TABLE IF NOT EXISTS public.call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type TEXT NOT NULL DEFAULT 'dm_video'
        CHECK (room_type IN ('dm_audio','dm_video','group_audio','group_video','circle_audio','circle_video')),
    hms_room_id TEXT NOT NULL,
    hms_room_name TEXT NOT NULL,
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'ringing'
        CHECK (status IN ('ringing','active','ended')),
    is_video BOOLEAN NOT NULL DEFAULT true,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_creator ON public.call_sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_conversation ON public.call_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_circle ON public.call_sessions(circle_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON public.call_sessions(status);

-- Livestreams now carry their 100ms room so the SFU layer replaces the
-- old peer-to-peer mesh for camera/screen publishing.
ALTER TABLE public.live_streams ADD COLUMN IF NOT EXISTS hms_room_id TEXT;
ALTER TABLE public.live_streams ADD COLUMN IF NOT EXISTS hms_room_name TEXT;
CREATE INDEX IF NOT EXISTS idx_live_streams_hms_room ON public.live_streams(hms_room_id);

-- ---- Row Level Security ------------------------------------
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can read sessions they are part of (creator, DM participant,
-- or circle member) — used for realtime ringing / joining.
DROP POLICY IF EXISTS "call_sessions_select_participant" ON public.call_sessions;
CREATE POLICY "call_sessions_select_participant" ON public.call_sessions
    FOR SELECT
    USING (
        creator_id = auth.uid()
        OR (
            conversation_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.conversation_participants cp
                WHERE cp.conversation_id = call_sessions.conversation_id
                  AND cp.user_id = auth.uid()
            )
        )
        OR (
            circle_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.circle_members cm
                WHERE cm.circle_id = call_sessions.circle_id
                  AND cm.user_id = auth.uid()
                  AND cm.status = 'active'
            )
        )
    );

-- Authenticated users may create call sessions.
DROP POLICY IF EXISTS "call_sessions_insert_authenticated" ON public.call_sessions;
CREATE POLICY "call_sessions_insert_authenticated" ON public.call_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (creator_id = auth.uid());

-- Caller + participants may update (start/end) a session.
DROP POLICY IF EXISTS "call_sessions_update_participant" ON public.call_sessions;
CREATE POLICY "call_sessions_update_participant" ON public.call_sessions
    FOR UPDATE
    USING (
        creator_id = auth.uid()
        OR (
            conversation_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.conversation_participants cp
                WHERE cp.conversation_id = call_sessions.conversation_id
                  AND cp.user_id = auth.uid()
            )
        )
        OR (
            circle_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.circle_members cm
                WHERE cm.circle_id = call_sessions.circle_id
                  AND cm.user_id = auth.uid()
                  AND cm.status = 'active'
            )
        )
    );

-- Realtime: broadcast call_sessions so DMs/circles ring instantly.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'call_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
    END IF;
END $$;
