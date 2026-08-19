-- Team permissions system
-- Each team member gets granular access to specific admin dashboard sections

CREATE TABLE IF NOT EXISTS team_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, permission_key)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_team_permissions_user ON team_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_team_permissions_key ON team_permissions(permission_key);

-- RLS
ALTER TABLE team_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage team permissions"
  ON team_permissions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Team members can read their own permissions
CREATE POLICY "Team members read own permissions"
  ON team_permissions FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_team_member = true)
  );

-- Define the available permission sections
COMMENT ON TABLE team_permissions IS 'Granular permissions for team-role users. Each row grants access to one admin dashboard section.';
COMMENT ON COLUMN team_permissions.permission_key IS 'One of: moderation, gifs_emojis, ads, events, support, analytics, economy, pro_lounge, organizations, featured, broadcast, verification, awards, cache, settings, health, coloop_sessions, account_management';
