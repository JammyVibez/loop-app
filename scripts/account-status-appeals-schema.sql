-- ============================================================================
-- Account status (suspended / deleted) + ban appeal system.
-- Idempotent — safe to re-run.
-- ============================================================================

-- Deleted accounts keep their row (so FKs / chat history survive) but are
-- masked everywhere: content shows "Deleted User" instead of the profile.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Suspension timestamp (is_banned is the suspension flag; this records when).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;

-- Ban appeals: a suspended/banned user can appeal once per ban.
CREATE TABLE IF NOT EXISTS public.ban_appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',      -- pending | approved | denied
    admin_notes TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_ban_appeals_status ON public.ban_appeals (status);
CREATE INDEX IF NOT EXISTS idx_ban_appeals_user ON public.ban_appeals (user_id);

-- Bot-authored circle chat messages (is_bot + bot_name) so the community
-- welcome/moderation bots can be identified in the UI.
ALTER TABLE public.circle_room_messages ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.circle_room_messages ADD COLUMN IF NOT EXISTS bot_name TEXT;

-- Moderation bot: flagged/removed messages are hidden from chat reads.
ALTER TABLE public.circle_room_messages ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'ok';
ALTER TABLE public.circle_room_messages ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

ALTER TABLE public.ban_appeals ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ban_appeals' AND policyname = 'Users read own appeals') THEN
    RETURN;
  END IF;
  CREATE POLICY "Users read own appeals" ON public.ban_appeals FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Users create appeals" ON public.ban_appeals FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Admins manage appeals" ON public.ban_appeals FOR ALL USING (TRUE) WITH CHECK (TRUE);
END $$;
