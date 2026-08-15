-- ============================================================
-- Private profiles: follow_requests table + realtime support
-- Idempotent — safe to run repeatedly.
-- ============================================================

-- 1. Follow requests table
CREATE TABLE IF NOT EXISTS public.follow_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (requester_id, target_id)
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_follow_requests_target ON public.follow_requests(target_id, status);
CREATE INDEX IF NOT EXISTS idx_follow_requests_requester ON public.follow_requests(requester_id, status);

-- 3. Realtime for live follow-request updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_requests;

-- 4. Backfill privacy_settings defaults so existing profiles
--    behave as public (current behavior) if the column is missing.
UPDATE public.profiles
SET privacy_settings = COALESCE(privacy_settings, '{"profile_visibility": "public", "message_privacy": "everyone"}')
WHERE privacy_settings IS NULL;
