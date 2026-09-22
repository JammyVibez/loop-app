-- Co-Loop Studio draft persistence.
--
-- Live edits were only ever exchanged over the realtime channel, so if every
-- participant refreshed (or the room emptied) the draft was gone. These columns
-- let the studio autosave the shared draft and rehydrate it on load; realtime
-- presence still wins whenever anyone is actually in the room.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'co_loop_sessions' AND column_name = 'draft_title'
    ) THEN
        ALTER TABLE public.co_loop_sessions ADD COLUMN draft_title TEXT NOT NULL DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'co_loop_sessions' AND column_name = 'draft_content'
    ) THEN
        ALTER TABLE public.co_loop_sessions ADD COLUMN draft_content TEXT NOT NULL DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'co_loop_sessions' AND column_name = 'draft_updated_at'
    ) THEN
        ALTER TABLE public.co_loop_sessions ADD COLUMN draft_updated_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
