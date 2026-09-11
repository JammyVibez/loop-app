-- FIX: loop_duel_votes.duel_id is UUID but loop_duels.id is BIGSERIAL (bigint).
-- This causes "invalid input syntax for uuid" when voting because the duel ID
-- is a numeric value like "3", not a UUID string.
-- The fix-duel-schema.sql only corrected loop_duel_entries — this fixes loop_duel_votes.

DO $$
BEGIN
    -- Only alter if duel_id is still UUID
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'loop_duel_votes' AND column_name = 'duel_id' AND data_type = 'uuid') THEN
        -- Drop all FKs first
        FOR r IN SELECT conname FROM pg_constraint
                 WHERE conrelid = 'loop_duel_votes'::regclass AND contype = 'f' LOOP
            EXECUTE 'ALTER TABLE loop_duel_votes DROP CONSTRAINT IF EXISTS ' || r.conname;
        END LOOP;

        -- Change type from UUID to BIGINT
        ALTER TABLE loop_duel_votes ALTER COLUMN duel_id TYPE BIGINT USING duel_id::TEXT::BIGINT;

        -- Re-add FK
        ALTER TABLE loop_duel_votes ADD CONSTRAINT loop_duel_votes_duel_id_fkey
            FOREIGN KEY (duel_id) REFERENCES loop_duels(id) ON DELETE CASCADE;
    END IF;
END $$;
