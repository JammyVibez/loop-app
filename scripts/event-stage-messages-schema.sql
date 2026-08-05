-- Event Stage chat was rendering entirely client-side, fake local state (a
-- hardcoded "Loop Bot" welcome message plus whatever the current viewer
-- typed) — nothing was ever sent to or received from other viewers. This
-- table makes it real: messages persist and broadcast to everyone on the
-- event page via Supabase Realtime, the same pattern circle rooms and DMs
-- already use.
CREATE TABLE IF NOT EXISTS event_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_messages_event_id ON event_messages(event_id, created_at);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.event_messages;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
