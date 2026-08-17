-- Corrected migration: moment view_count, moment_comments, admin_settings seeds, admin_cache_registry
-- Idempotent — safe to re-run.

-- 1) Moments: add view_count
ALTER TABLE moments ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- 2) Moment comments (threaded replies on moments, auto-deleted when moment expires)
CREATE TABLE IF NOT EXISTS moment_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id UUID NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES moment_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moment_comments_moment ON moment_comments(moment_id);
CREATE INDEX IF NOT EXISTS idx_moment_comments_parent ON moment_comments(parent_comment_id);

ALTER TABLE moment_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "moment_comments_select" ON moment_comments;
CREATE POLICY "moment_comments_select" ON moment_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "moment_comments_insert" ON moment_comments;
CREATE POLICY "moment_comments_insert" ON moment_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "moment_comments_delete" ON moment_comments;
CREATE POLICY "moment_comments_delete" ON moment_comments FOR DELETE USING (auth.uid() = user_id);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE moment_comments;
EXCEPTION WHEN duplicate_object OR unique_violation OR others THEN NULL;
END $$;

-- 3) Seed maintenance_mode + app_logo into existing admin_settings (uses setting_key)
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
  ('maintenance_mode', '{"enabled": false, "message": "We are performing scheduled maintenance. Please check back soon.", "developer_notes": ""}', 'Site-wide maintenance mode toggle and message'),
  ('app_logo', '{"logo_url": "/icons/icon.svg"}', 'Dynamic app logo URL — admin can change at any time')
ON CONFLICT (setting_key) DO NOTHING;

-- 4) Admin cache management
CREATE TABLE IF NOT EXISTS admin_cache_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  last_cleared_at TIMESTAMPTZ,
  cleared_count INTEGER NOT NULL DEFAULT 0
);

INSERT INTO admin_cache_registry (id, name, description) VALUES
  ('cdn_cache', 'CDN Cache', 'Cloudinary and static asset caches'),
  ('search_index', 'Search Index', 'Search and discovery index'),
  ('feed_cache', 'Feed Cache', 'Algorithmically-sorted feed caches'),
  ('og_cache', 'OG Image Cache', 'Open Graph image generation cache'),
  ('auth_sessions', 'Auth Sessions', 'Stale authentication sessions'),
  ('db_connections', 'DB Connections', 'Stale Supabase pooler connections'),
  ('redis_cache', 'Redis Cache', 'In-memory cache layer if present')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE admin_cache_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_cache_select" ON admin_cache_registry;
CREATE POLICY "admin_cache_select" ON admin_cache_registry FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_cache_update" ON admin_cache_registry;
CREATE POLICY "admin_cache_update" ON admin_cache_registry FOR UPDATE USING (true);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE admin_cache_registry;
EXCEPTION WHEN duplicate_object OR unique_violation OR others THEN NULL;
END $$;

-- 5) Helper RPC to atomically bump the cleared counter
CREATE OR REPLACE FUNCTION admin_increment_cache_cleared(cache_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admin_cache_registry
  SET cleared_count = cleared_count + 1
  WHERE id = cache_id;
END;
$$;
