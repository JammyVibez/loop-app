-- Fix loop_poll_votes.poll_id: UUID → BIGINT
-- The loop_polls.id column was changed to BIGSERIAL (Snowflake IDs),
-- but loop_poll_votes.poll_id was still UUID, causing
-- "invalid input syntax for uuid" errors when voting.

-- Drop FK constraints on poll_id first
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'loop_poll_votes'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name != 'loop_poll_votes_loop_id_fkey'
      AND constraint_name != 'loop_poll_votes_user_id_fkey'
  LOOP
    EXECUTE 'ALTER TABLE loop_poll_votes DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
  END LOOP;
END $$;

-- Convert poll_id from UUID to BIGINT
ALTER TABLE loop_poll_votes
  ALTER COLUMN poll_id TYPE bigint USING poll_id::text::bigint;

-- Re-add the poll_id FK
ALTER TABLE loop_poll_votes
  ADD CONSTRAINT loop_poll_votes_poll_id_fkey
  FOREIGN KEY (poll_id) REFERENCES loop_polls(id) ON DELETE CASCADE;

-- Ensure loop_id and user_id FKs exist
DO $$ BEGIN
  ALTER TABLE loop_poll_votes
    ADD CONSTRAINT loop_poll_votes_loop_id_fkey
    FOREIGN KEY (loop_id) REFERENCES loops(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE loop_poll_votes
    ADD CONSTRAINT loop_poll_votes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
