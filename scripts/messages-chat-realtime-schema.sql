-- DM chat delivery: realtime needs a SELECT policy.
--
-- public.messages had RLS enabled with *no* policies at all. The app reads
-- messages through the service-role API, so the inbox looked fine, but
-- Postgres Changes evaluates RLS as the subscribing user — with zero policies
-- every INSERT/UPDATE was dropped, so the other person's open chat never
-- received a message. Broadcast covered only the pair who were both connected
-- at that instant; a reconnect or a second device got nothing until a manual
-- reload.
--
-- Participants of a conversation can see its rows; nobody else can. Realtime
-- and any authenticated client read now agree with the API's own membership
-- check. Idempotent — safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
      AND policyname = 'conversation participants can read messages'
  ) THEN
    CREATE POLICY "conversation participants can read messages"
      ON public.messages FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.conversation_participants cp
          WHERE cp.conversation_id = messages.conversation_id
            AND cp.user_id = auth.uid()
            AND cp.left_at IS NULL
        )
      );
  END IF;
END $$;

-- A sender may insert their own row (used only if a client ever writes
-- directly; the app itself writes through the service role).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
      AND policyname = 'authors can send messages'
  ) THEN
    CREATE POLICY "authors can send messages"
      ON public.messages FOR INSERT
      WITH CHECK (
        (author_id = auth.uid() OR sender_id = auth.uid())
        AND EXISTS (
          SELECT 1
          FROM public.conversation_participants cp
          WHERE cp.conversation_id = messages.conversation_id
            AND cp.user_id = auth.uid()
            AND cp.left_at IS NULL
        )
      );
  END IF;
END $$;

-- Reaction storage: the API writes message_reactions (one row per user+emoji)
-- and mirrors the grouped counts into messages.reactions so older readers and
-- the fan-out channel always agree.
ALTER TABLE public.message_reactions ADD COLUMN IF NOT EXISTS emoji VARCHAR(16);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;

DO $$
BEGIN
  ALTER TABLE public.message_reactions ALTER COLUMN reaction_type DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- Backfill the JSONB mirror from the dedicated table so reactions written
-- before this migration show up on the next read.
DO $$
DECLARE
  target RECORD;
BEGIN
  FOR target IN
    SELECT message_id, jsonb_agg(jsonb_build_object('emoji', emoji, 'users', users, 'count', cnt) ORDER BY emoji) AS grouped
    FROM (
      SELECT message_id, emoji, jsonb_agg(user_id::text) AS users, count(*)::int AS cnt
      FROM public.message_reactions
      WHERE message_id IS NOT NULL AND emoji IS NOT NULL
      GROUP BY message_id, emoji
    ) per_emoji
    GROUP BY message_id
  LOOP
    UPDATE public.messages
    SET reactions = target.grouped
    WHERE id = target.message_id;
  END LOOP;
END $$;
