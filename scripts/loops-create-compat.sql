-- Align loops inserts with the live schema used by the app.
-- Safe to re-run. Does NOT add media_metadata (app uses content_metadata).

ALTER TABLE public.loops
  ADD COLUMN IF NOT EXISTS content_text TEXT,
  ADD COLUMN IF NOT EXISTS content_title TEXT,
  ADD COLUMN IF NOT EXISTS content_media_url TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS content_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tree_depth INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_loop_id UUID REFERENCES public.loops(id) ON DELETE CASCADE;

-- Keep legacy columns populated when present
ALTER TABLE public.loops
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type VARCHAR(20);
