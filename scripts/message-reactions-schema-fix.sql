-- Fixes DM message reactions, which were fully coded end-to-end
-- (components/messages/messages-workspace.tsx -> /api/messages/reactions)
-- but silently did nothing on the live database: message_reactions had a
-- NOT NULL `reaction_type` column (never populated by the API, which only
-- ever wrote `emoji`), and `messages` had no `reactions` JSONB fallback
-- column either. The POST handler swallows the resulting insert error and
-- falls through to a JSONB update that also silently fails, so reactions
-- appeared to work in the UI (optimistic update) but were never persisted.

ALTER TABLE message_reactions ADD COLUMN IF NOT EXISTS emoji VARCHAR(16);

DO $$
BEGIN
  ALTER TABLE message_reactions ALTER COLUMN reaction_type DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS message_reactions_message_id_user_id_reaction_type_key;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE message_reactions
    ADD CONSTRAINT message_reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;
