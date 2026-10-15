-- Note colour themes.
--
-- A note is a bubble, and its author picks its colour. The allowed list is
-- mirrored in lib/profile-note.ts (NOTE_THEMES): __tests__/profile-note.test.ts
-- reads this file and fails if the two drift apart, so the CHECK can never
-- start rejecting a colour the picker happily offers.
--
-- Idempotent — safe to run against a database that already has the column.

ALTER TABLE public.profile_notes
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'indigo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profile_notes_theme_valid'
  ) THEN
    ALTER TABLE public.profile_notes
      ADD CONSTRAINT profile_notes_theme_valid
      CHECK (theme IN ('indigo', 'violet', 'fuchsia', 'cyan', 'emerald', 'amber', 'rose', 'slate'));
  END IF;
END $$;

COMMENT ON COLUMN public.profile_notes.theme IS
  'Bubble colour chosen by the author. Allowlist mirrors NOTE_THEMES in lib/profile-note.ts.';
