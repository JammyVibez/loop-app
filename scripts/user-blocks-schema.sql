-- ============================================================
-- USER BLOCKS — global block system
-- A blocked user cannot: view profile, follow, message, see in search.
-- A blocked user CAN: reply to comments, like comments (public interactions).
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_blocks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Prevent self-blocking (idempotent — safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_self_block' AND conrelid = 'user_blocks'::regclass
  ) THEN
    ALTER TABLE user_blocks ADD CONSTRAINT no_self_block CHECK (blocker_id != blocked_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

-- RLS: users can only see/manage their own blocks (idempotent — safe to re-run)
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own blocks" ON user_blocks;
CREATE POLICY "Users manage own blocks" ON user_blocks
  FOR ALL USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);
