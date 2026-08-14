-- ============================================================
-- Feed branches schema
-- Supports showing branched loops in the For You / feed tabs with
-- a "Branched from" chip that links back to the original loop.
-- Safe to run multiple times (idempotent).
-- ============================================================

-- 1) Ensure loops.parent_loop_id has a foreign key to loops.id
--    (self-reference for the branch tree) so PostgREST can resolve
--    the `parent_loop:loops!parent_loop_id(...)` join used by the feed API.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.constraint_schema = kcu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'loops'
      AND kcu.column_name = 'parent_loop_id'
  ) THEN
    ALTER TABLE loops
      ADD CONSTRAINT loops_parent_loop_id_fkey
      FOREIGN KEY (parent_loop_id) REFERENCES loops(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Index for fast parent joins + branch lookups
CREATE INDEX IF NOT EXISTS loops_parent_loop_id_idx ON loops(parent_loop_id);

-- 3) Index for feed ordering (already partially covered, keep for safety)
CREATE INDEX IF NOT EXISTS loops_created_at_idx ON loops(created_at DESC);

-- 4) Realtime: stream loop INSERTs (and updates) to feed subscribers.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE loops;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
