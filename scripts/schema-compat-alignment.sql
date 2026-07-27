-- Schema compatibility for existing Loop Supabase projects.
-- Bridges older column names into the shapes used by the Next.js API routes.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE content_type AS ENUM ('text', 'image', 'video', 'audio', 'file');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE visibility_type AS ENUM ('public', 'private', 'circle');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE interaction_type AS ENUM ('like', 'save', 'view', 'share');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- loops: app expects content_text / content_media_url / content_type / visibility
ALTER TABLE IF EXISTS public.loops
  ADD COLUMN IF NOT EXISTS content_text TEXT,
  ADD COLUMN IF NOT EXISTS content_media_url TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS content_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_title TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS circle_id UUID,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS sentiment TEXT,
  ADD COLUMN IF NOT EXISTS trending_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_count INTEGER DEFAULT 0;

-- Backfill from older column names when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loops' AND column_name = 'content'
  ) THEN
    EXECUTE $sql$
      UPDATE public.loops
      SET content_text = COALESCE(content_text, content)
      WHERE content_text IS NULL AND content IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loops' AND column_name = 'media_url'
  ) THEN
    EXECUTE $sql$
      UPDATE public.loops
      SET content_media_url = COALESCE(content_media_url, media_url)
      WHERE content_media_url IS NULL AND media_url IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loops' AND column_name = 'media_type'
  ) THEN
    EXECUTE $sql$
      UPDATE public.loops
      SET content_type = COALESCE(NULLIF(content_type, 'text'), media_type, 'text')
      WHERE media_type IS NOT NULL
    $sql$;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.loop_stats
  ADD COLUMN IF NOT EXISTS saves_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS active_theme TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- messages: support both author_id and sender_id/recipient_id shapes
ALTER TABLE IF EXISTS public.messages
  ADD COLUMN IF NOT EXISTS sender_id UUID,
  ADD COLUMN IF NOT EXISTS recipient_id UUID,
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'author_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.messages
      SET sender_id = COALESCE(sender_id, author_id)
      WHERE sender_id IS NULL AND author_id IS NOT NULL
    $sql$;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS related_id UUID,
  ADD COLUMN IF NOT EXISTS related_type TEXT,
  ADD COLUMN IF NOT EXISTS actor_id UUID;

CREATE INDEX IF NOT EXISTS idx_loops_visibility ON public.loops(visibility);
CREATE INDEX IF NOT EXISTS idx_loops_content_type ON public.loops(content_type);
