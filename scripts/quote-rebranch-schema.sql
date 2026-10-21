-- Quote rebranching
--
-- A quote rebranch is a top-level post authored by the quoting user. It keeps
-- a *reference* to the post it quotes (`quoted_loop_id`) instead of copying
-- that post's text, so the original stays untouched and the embedded card can
-- always open the real post with its own replies.
--
-- Normal rebranches keep using `parent_loop_id` and are untouched.

ALTER TABLE loops ADD COLUMN IF NOT EXISTS quoted_loop_id text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS quote_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loops_quoted_loop_id_fkey'
  ) THEN
    ALTER TABLE loops
      ADD CONSTRAINT loops_quoted_loop_id_fkey
      FOREIGN KEY (quoted_loop_id) REFERENCES loops(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_loops_quoted_loop_id ON loops(quoted_loop_id);

-- A quote post is never a branch: enforce that a row cannot claim both.
ALTER TABLE loops DROP CONSTRAINT IF EXISTS loops_quote_not_branch;
ALTER TABLE loops
  ADD CONSTRAINT loops_quote_not_branch
  CHECK (quoted_loop_id IS NULL OR parent_loop_id IS NULL);

-- A post cannot quote itself.
ALTER TABLE loops DROP CONSTRAINT IF EXISTS loops_quote_not_self;
ALTER TABLE loops
  ADD CONSTRAINT loops_quote_not_self
  CHECK (quoted_loop_id IS NULL OR quoted_loop_id <> id);
