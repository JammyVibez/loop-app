-- FIX: open_co_loop_participants FK was pointing to auth.session instead of co_loop_sessions
-- FIX: feed_post_id was UUID but loops.id is text

-- 1. Fix feed_post_id type
DO $$
BEGIN
    -- Drop any FK on feed_post_id first
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='co_loop_sessions' AND column_name='feed_post_id' AND data_type='uuid') THEN
        ALTER TABLE public.co_loop_sessions ALTER COLUMN feed_post_id DROP NOT NULL;
        ALTER TABLE public.co_loop_sessions ALTER COLUMN feed_post_id TYPE text;
    END IF;
END $$;

-- 2. Add unique constraint on session_id if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'co_loop_sessions_session_id_unique') THEN
        ALTER TABLE public.co_loop_sessions ADD CONSTRAINT co_loop_sessions_session_id_unique UNIQUE (session_id);
    END IF;
END $$;

-- 3. Drop the broken FK referencing auth.session
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT conname FROM pg_constraint 
             WHERE conrelid = 'open_co_loop_participants'::regclass 
             AND contype = 'f'
             AND confrelid = 'session'::regclass
    LOOP
        EXECUTE 'ALTER TABLE open_co_loop_participants DROP CONSTRAINT IF EXISTS ' || r.conname;
    END LOOP;
END $$;

-- 4. Add correct FK referencing co_loop_sessions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'open_co_loop_participants_session_id_fkey' AND confrelid = 'co_loop_sessions'::regclass) THEN
        ALTER TABLE open_co_loop_participants 
            ADD CONSTRAINT open_co_loop_participants_session_id_fkey 
            FOREIGN KEY (session_id) REFERENCES co_loop_sessions(session_id) ON DELETE CASCADE;
    END IF;
END $$;
