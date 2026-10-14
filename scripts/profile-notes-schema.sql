-- Profile notes: the short, self-erasing line under your name.
--
-- A note is at most 60 characters and disappears after 24 hours. The author
-- chooses where it shows — profile, posts, communities — because "public
-- everywhere" should be a default, not a rule: someone may want a line on
-- their own page without it following them into a community thread.
--
-- One live note per account: writing a new note replaces the previous one
-- (same row, new text + a fresh 24h clock) rather than piling up history that
-- the product deliberately does not keep.
--
-- Idempotent — safe to run against a database that already has this table.

CREATE TABLE IF NOT EXISTS public.profile_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  show_on_profile BOOLEAN NOT NULL DEFAULT TRUE,
  show_on_posts BOOLEAN NOT NULL DEFAULT TRUE,
  show_on_communities BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Enforce the length limit in the database, not only in the API, so a direct
-- SQL write can't park an essay where the UI promises one line.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profile_notes_content_len'
  ) THEN
    ALTER TABLE public.profile_notes
      ADD CONSTRAINT profile_notes_content_len
      CHECK (char_length(content) BETWEEN 1 AND 60);
  END IF;
END $$;

-- One note per account — the upsert path (onConflict: user_id) needs it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_notes_user_id
  ON public.profile_notes(user_id);

-- Reads always filter on expiry; keep that cheap.
CREATE INDEX IF NOT EXISTS idx_profile_notes_expires_at
  ON public.profile_notes(expires_at);

COMMENT ON COLUMN public.profile_notes.content IS
  'Note text, 1–60 characters. Replaced (not appended) when the author writes a new note.';
COMMENT ON COLUMN public.profile_notes.show_on_profile IS
  'Author chose to show this note on their own profile page.';
COMMENT ON COLUMN public.profile_notes.show_on_posts IS
  'Author chose to show this note on their posts (feed, loop cards).';
COMMENT ON COLUMN public.profile_notes.show_on_communities IS
  'Author chose to show this note in community threads.';
COMMENT ON COLUMN public.profile_notes.expires_at IS
  'Notes self-erase after 24 hours; every read filters on this column.';

-- Notes are public by design (they sit on a public profile), so reads are
-- open; writes go through the service-role client only, so no INSERT/UPDATE
-- policy is granted.
ALTER TABLE public.profile_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profile_notes'
      AND policyname = 'profile notes are publicly readable'
  ) THEN
    CREATE POLICY "profile notes are publicly readable"
      ON public.profile_notes FOR SELECT USING (true);
  END IF;
END $$;
