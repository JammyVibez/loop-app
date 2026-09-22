-- Co-Loop Studio version history.
--
-- Snapshots used to be written to `localStorage` only, which meant a refresh
-- wiped the whole timeline, invited co-authors never saw each other's
-- checkpoints, and restoring a version could not be repeated on another device.
-- This table makes the timeline a property of the session: shared by every
-- participant and durable across reloads.

CREATE TABLE IF NOT EXISTS public.co_loop_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
    media_url TEXT,
    media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    media_type TEXT NOT NULL DEFAULT 'text' CHECK (media_type IN ('text', 'image', 'video')),
    co_authors JSONB NOT NULL DEFAULT '[]'::jsonb,
    label TEXT,
    saved_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    saved_by_name TEXT,
    saved_by_avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'co_loop_versions_session_version_key'
    ) THEN
        ALTER TABLE public.co_loop_versions
            ADD CONSTRAINT co_loop_versions_session_version_key UNIQUE (session_id, version_number);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_co_loop_versions_session
    ON public.co_loop_versions(session_id, version_number DESC);

ALTER TABLE public.co_loop_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone can read co_loop_versions" ON public.co_loop_versions;
    CREATE POLICY "Anyone can read co_loop_versions" ON public.co_loop_versions
        FOR SELECT USING (true);

    -- Writes go through the service-role API route (/api/co-loop/versions),
    -- which authenticates the caller server-side.
    DROP POLICY IF EXISTS "Service role manages co_loop_versions" ON public.co_loop_versions;
    CREATE POLICY "Service role manages co_loop_versions" ON public.co_loop_versions
        FOR ALL USING (true) WITH CHECK (true);
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE co_loop_versions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
