-- Co-Loop Viral Referral & Invite Rewards Table
CREATE TABLE IF NOT EXISTS co_loop_invite_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  coins_awarded INT DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_inviter_invitee_pair UNIQUE (inviter_id, invitee_id)
);

-- Index for fast lookup on daily cap & pair duplicate check
CREATE INDEX IF NOT EXISTS idx_co_loop_rewards_inviter_created ON co_loop_invite_rewards(inviter_id, created_at);

-- Add tracking columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_via_coloop BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invited_by_username TEXT;
