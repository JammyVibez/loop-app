-- linked_accounts: multi-account switching
-- Normal users can link up to 2 accounts; Pro users up to 10.
CREATE TABLE IF NOT EXISTS linked_accounts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id, linked_user_id)
);

-- Index for fast lookups by owner
CREATE INDEX IF NOT EXISTS idx_linked_accounts_owner ON linked_accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_linked_accounts_linked ON linked_accounts(linked_user_id);

-- RLS: users can only see / manage their own linked accounts
ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own linked accounts"
  ON linked_accounts FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Prevent circular linking: a user who is a linked_user in any row
-- cannot also be an owner (optional guard enforced in the API layer).
