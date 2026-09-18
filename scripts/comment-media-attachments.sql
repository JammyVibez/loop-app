-- Comment attachments: images, video, audio, GIFs or any file.
--
-- `media_url` already existed for a single attachment; these columns let a
-- comment carry a typed attachment (so the UI knows whether to render an
-- <img>, a <video> or a file chip) and several attachments at once.
--
-- Safe to re-run.

ALTER TABLE comments ADD COLUMN IF NOT EXISTS media_type TEXT;

ALTER TABLE comments ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Keep the shape predictable: a comment can hold at most 4 attachments.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comments_attachments_is_array'
  ) THEN
    ALTER TABLE comments
      ADD CONSTRAINT comments_attachments_is_array
      CHECK (jsonb_typeof(attachments) = 'array');
  END IF;
END $$;
