-- Co-Loop Studio chat: durable room chat with emoji reactions.
--
-- The studio chat used to live only in the broadcast channel. Anyone who
-- joined after a message was sent — or who reloaded, reconnected, or opened
-- the room on a second device — saw an empty chat, because nothing was ever
-- stored. Reactions had no storage at all, so they could not survive a single
-- re-render.
--
-- One row per message; reactions are `{ "<emoji>": ["<user_id>", …] }` like the
-- community chat, so a toggle is one JSONB update and needs no extra table.
-- Idempotent — safe to run against a database that already has the table.

CREATE TABLE IF NOT EXISTS public.co_loop_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'co_loop_chat_messages_content_len'
  ) THEN
    ALTER TABLE public.co_loop_chat_messages
      ADD CONSTRAINT co_loop_chat_messages_content_len
      CHECK (char_length(content) BETWEEN 1 AND 1000);
  END IF;
END $$;

-- The rail always reads one session's newest 100 messages.
CREATE INDEX IF NOT EXISTS idx_co_loop_chat_session_created
  ON public.co_loop_chat_messages(session_id, created_at DESC);

-- Reads and writes go through the service-role API (which checks room
-- membership), so no anon policies are granted; RLS blocks direct access.
ALTER TABLE public.co_loop_chat_messages ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.co_loop_chat_messages.reactions IS
  'Emoji reactions keyed by emoji, each holding the user ids that reacted.';
