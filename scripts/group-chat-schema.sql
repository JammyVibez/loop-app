-- Group chat schema additions (idempotent)
-- 1. group_read_receipts — tracks per-member read position in group chats
CREATE TABLE IF NOT EXISTS group_read_receipts (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_message_id UUID,
  UNIQUE(conversation_id, user_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_group_read_receipts_conv ON group_read_receipts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_group_read_receipts_user ON group_read_receipts(user_id);

-- 2. Ensure conversations table has all group-chat columns (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'who_can_send') THEN
    ALTER TABLE conversations ADD COLUMN who_can_send TEXT DEFAULT 'everyone';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'who_can_add_members') THEN
    ALTER TABLE conversations ADD COLUMN who_can_add_members TEXT DEFAULT 'everyone';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'member_limit') THEN
    ALTER TABLE conversations ADD COLUMN member_limit INTEGER DEFAULT 100;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'description') THEN
    ALTER TABLE conversations ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'topic') THEN
    ALTER TABLE conversations ADD COLUMN topic TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'invite_link') THEN
    ALTER TABLE conversations ADD COLUMN invite_link TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'invite_link_expires_at') THEN
    ALTER TABLE conversations ADD COLUMN invite_link_expires_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'invite_link_max_uses') THEN
    ALTER TABLE conversations ADD COLUMN invite_link_max_uses INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'invite_link_uses') THEN
    ALTER TABLE conversations ADD COLUMN invite_link_uses INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'is_locked') THEN
    ALTER TABLE conversations ADD COLUMN is_locked BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'locked_by') THEN
    ALTER TABLE conversations ADD COLUMN locked_by UUID;
  END IF;

  -- conversation_participants columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_participants' AND column_name = 'can_delete_messages') THEN
    ALTER TABLE conversation_participants ADD COLUMN can_delete_messages BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_participants' AND column_name = 'can_mute_members') THEN
    ALTER TABLE conversation_participants ADD COLUMN can_mute_members BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_participants' AND column_name = 'can_pin_messages') THEN
    ALTER TABLE conversation_participants ADD COLUMN can_pin_messages BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_participants' AND column_name = 'can_manage_settings') THEN
    ALTER TABLE conversation_participants ADD COLUMN can_manage_settings BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversation_participants' AND column_name = 'is_muted') THEN
    ALTER TABLE conversation_participants ADD COLUMN is_muted BOOLEAN DEFAULT false;
  END IF;

  -- messages columns for group features
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_pinned') THEN
    ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'pinned_by') THEN
    ALTER TABLE messages ADD COLUMN pinned_by UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'pinned_at') THEN
    ALTER TABLE messages ADD COLUMN pinned_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'system_event') THEN
    ALTER TABLE messages ADD COLUMN system_event TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'system_metadata') THEN
    ALTER TABLE messages ADD COLUMN system_metadata JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'mentions') THEN
    ALTER TABLE messages ADD COLUMN mentions JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'forwarded_from') THEN
    ALTER TABLE messages ADD COLUMN forwarded_from TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'forwarded_message_id') THEN
    ALTER TABLE messages ADD COLUMN forwarded_message_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'deleted_at') THEN
    ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

-- 3. RLS policies for group_read_receipts
ALTER TABLE group_read_receipts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Members can read group read receipts" ON group_read_receipts;
  DROP POLICY IF EXISTS "Members can insert their own read receipts" ON group_read_receipts;
  DROP POLICY IF EXISTS "Members can update their own read receipts" ON group_read_receipts;
END $$;

CREATE POLICY "Members can read group read receipts"
  ON group_read_receipts FOR SELECT
  USING (true);

CREATE POLICY "Members can insert their own read receipts"
  ON group_read_receipts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Members can update their own read receipts"
  ON group_read_receipts FOR UPDATE
  USING (true);

-- 4. Enable realtime for group_read_receipts
ALTER PUBLICATION supabase_realtime ADD TABLE group_read_receipts;
