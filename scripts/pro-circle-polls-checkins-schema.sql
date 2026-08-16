-- ============================================================================
-- Pro Circle Workspace: channel polls + Pro Lounge daily check-in
-- Idempotent — safe to re-run. Run with the service-role connection.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CHANNEL POLLS (Slack-style) — a poll is attached to a circle_room_messages
-- row so it renders inline in the chat stream. One vote per member per poll.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_room_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.circle_rooms(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.circle_room_messages(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_votes INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    ended BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_circle_room_polls_room ON public.circle_room_polls(room_id);
CREATE INDEX IF NOT EXISTS idx_circle_room_polls_message ON public.circle_room_polls(message_id);

CREATE TABLE IF NOT EXISTS public.circle_room_poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.circle_room_polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    option_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_room_poll_votes_poll ON public.circle_room_poll_votes(poll_id);

-- Live vote bars stream over realtime.
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_room_polls;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_room_poll_votes;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. PRO LOUNGE DAILY CHECK-IN — one reward per member per UTC day per circle.
-- Streak = consecutive days ending today or yesterday (a missed day resets).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pro_lounge_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (circle_id, user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_pro_lounge_checkins_user ON public.pro_lounge_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_pro_lounge_checkins_circle ON public.pro_lounge_checkins(circle_id);
