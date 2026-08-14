-- ============================================================================
-- Messages: edit / delete / forward support
-- Powers "Edit message", "Delete for everyone", and "Forward" in DMs.
-- Idempotent — safe to run any number of times in the Supabase SQL editor.
-- ============================================================================

-- Edit: content is overwritten and edited_at is stamped
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Delete for everyone: soft delete
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Forward: human-readable origin label + the original message id
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS forwarded_from TEXT;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS forwarded_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_forwarded_message_id
  ON public.messages(forwarded_message_id)
  WHERE forwarded_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_is_deleted
  ON public.messages(is_deleted);

-- Keep messages in the realtime publication so edits/deletes broadcast live.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Replica identity: broadcast the full updated row (needed so the app can
-- read content/edited_at/is_deleted from the realtime payload).
ALTER TABLE public.messages REPLICA IDENTITY FULL;
