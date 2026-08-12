-- Ensures the columns the DM read-receipt flow depends on exist, regardless
-- of which schema era created `messages` / `conversation_participants` on
-- this database. Safe to run multiple times.

ALTER TABLE IF EXISTS messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

ALTER TABLE IF EXISTS conversation_participants
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE;
