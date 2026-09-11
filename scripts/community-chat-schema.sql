-- Community Chat: add missing columns to messages table
-- The community chat API (app/api/communities/[id]/chat/route.ts) needs
-- media_url, content_metadata, and author_id on the messages table.

-- media_url for shared images/files in chat
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type TEXT;

-- content_metadata stores space_id for per-space chat filtering
ALTER TABLE messages ADD COLUMN IF NOT EXISTS content_metadata JSONB;

-- author_id (some tables use author_id, messages used sender_id)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Backfill author_id from sender_id for existing rows
UPDATE messages SET author_id = sender_id WHERE author_id IS NULL AND sender_id IS NOT NULL;
