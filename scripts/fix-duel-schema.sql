-- FIX: Missing FK constraints that prevented Supabase PostgREST from resolving joins
-- This caused the enrichment query to silently fail, so duels never appeared in feed

-- 1. Add FK for opponent_id -> profiles (was missing)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loop_duels_opponent_id_fkey') THEN
        ALTER TABLE loop_duels ADD CONSTRAINT loop_duels_opponent_id_fkey 
            FOREIGN KEY (opponent_id) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Fix loop_duel_entries.duel_id type (was UUID, should be bigint to match loop_duels.id)
DO $$
BEGIN
    -- Drop old FKs on loop_duel_entries
    PERFORM (SELECT conname FROM pg_constraint 
             WHERE conrelid = 'loop_duel_entries'::regclass AND contype = 'f');
    
    -- Only alter if duel_id is still UUID
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'loop_duel_entries' AND column_name = 'duel_id' AND data_type = 'uuid') THEN
        -- Drop all FKs first
        FOR r IN SELECT conname FROM pg_constraint 
                 WHERE conrelid = 'loop_duel_entries'::regclass AND contype = 'f' LOOP
            EXECUTE 'ALTER TABLE loop_duel_entries DROP CONSTRAINT IF EXISTS ' || r.conname;
        END LOOP;
        
        -- Change type
        ALTER TABLE loop_duel_entries ALTER COLUMN duel_id TYPE bigint USING NULL;
        
        -- Re-add FK
        ALTER TABLE loop_duel_entries ADD CONSTRAINT loop_duel_entries_duel_id_fkey 
            FOREIGN KEY (duel_id) REFERENCES loop_duels(id) ON DELETE CASCADE;
    END IF;
END $$;
