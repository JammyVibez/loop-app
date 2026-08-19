-- Account deletion scheduling table
-- Users request deletion, get a 3-day grace period
-- If they don't cancel within 3 days, the account is automatically deleted

CREATE TABLE IF NOT EXISTS account_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execute_after TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 days'),
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  executed BOOLEAN NOT NULL DEFAULT FALSE,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for the cleanup job to find due deletions
CREATE INDEX IF NOT EXISTS idx_account_deletions_execute_after 
  ON account_deletions(execute_after) 
  WHERE cancelled = FALSE AND executed = FALSE;

-- Admin deletion log (for audit trail)
CREATE TABLE IF NOT EXISTS admin_account_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  target_user_id UUID NOT NULL,
  target_username TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

-- Users can see their own deletion request
CREATE POLICY "Users can view own deletion request"
  ON account_deletions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own deletion request
CREATE POLICY "Users can request own deletion"
  ON account_deletions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update (cancel) their own deletion request
CREATE POLICY "Users can cancel own deletion"
  ON account_deletions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin deletion log - admins can read
ALTER TABLE admin_account_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view deletion log"
  ON admin_account_deletions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- Add scheduled_deletion field to profiles for quick lookup
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_executed_at TIMESTAMPTZ;
