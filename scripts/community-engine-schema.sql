-- ============================================================
-- LOOP COMMUNITY ENGINE — SCHEMA v1
-- Extends the existing circles system (circles == communities).
-- All new tables reference circles(id) so existing data survives.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extend the circles table with next-gen community columns
-- ------------------------------------------------------------
ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS handle TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS layout_preset TEXT DEFAULT 'default',      -- default | compact | visual | magazine | dashboard
  ADD COLUMN IF NOT EXISTS featured_modules JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS enabled_features JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_roles JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS recognition_rules JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS moderation_settings JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS discovery_preferences JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS welcome_message TEXT,
  ADD COLUMN IF NOT EXISTS dna JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pulse_cached JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pulse_updated_at TIMESTAMP WITH TIME ZONE;

-- Backfill handle from slug/name for existing circles (migration path)
UPDATE circles SET handle = LOWER(REGEXP_REPLACE(COALESCE(NULLIF(slug, ''), name), '[^a-z0-9]+', '-', 'g')) || '-' || id
WHERE handle IS NULL OR handle = '';

-- Unique index on handle (partial to tolerate legacy NULLs)
DROP INDEX IF EXISTS circles_handle_unique_idx;
CREATE UNIQUE INDEX circles_handle_unique_idx ON circles (handle) WHERE handle IS NOT NULL;

-- ------------------------------------------------------------
-- 2. community_spaces — the typed "Spaces" system
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_spaces (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  type TEXT NOT NULL DEFAULT 'discussion',   -- discussion|feed|chat|media|qa|polls|events|projects|resources|knowledge|challenges|gallery|custom
  icon TEXT DEFAULT 'hash',
  description TEXT DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'members', -- public|members|mods
  permissions JSONB DEFAULT '{}',
  content_rules JSONB DEFAULT '{}',
  pinned_content JSONB DEFAULT '[]',
  is_archived BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_spaces_circle ON community_spaces (circle_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_community_spaces_circle_type ON community_spaces (circle_id, type);

-- Scope posts to spaces (existing posts keep NULL = "General")
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS space_id BIGINT REFERENCES community_spaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_circle_posts_space ON circle_posts (circle_id, space_id, created_at DESC);

-- ------------------------------------------------------------
-- 3. community_projects — collaborative projects
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_projects (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',     -- active|completed|archived
  progress INTEGER DEFAULT 0,                -- 0-100 (auto from tasks)
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_projects_circle ON community_projects (circle_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_project_members (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES community_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'contributor',  -- lead|contributor
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON community_project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON community_project_members (user_id);

CREATE TABLE IF NOT EXISTS community_project_tasks (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES community_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'todo',       -- todo|in_progress|done
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON community_project_tasks (project_id, sort_order);

-- ------------------------------------------------------------
-- 4. community_challenges — entries + votes for circle_challenges
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_challenge_entries (
  id BIGSERIAL PRIMARY KEY,
  challenge_id BIGINT NOT NULL REFERENCES circle_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT DEFAULT '',
  media_url TEXT,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_challenge_entries_challenge ON community_challenge_entries (challenge_id, vote_count DESC);

CREATE TABLE IF NOT EXISTS community_challenge_votes (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES community_challenge_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (entry_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_entry ON community_challenge_votes (entry_id);

-- ------------------------------------------------------------
-- 5. community_memory — archive / milestones
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_memory (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'milestone',    -- milestone|memory|announcement|legend
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  media_url TEXT,
  ref_type TEXT,
  ref_id TEXT,
  happened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_auto BOOLEAN DEFAULT FALSE,
  importance INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_memory_circle ON community_memory (circle_id, happened_at DESC);

-- ------------------------------------------------------------
-- 6. community_moments — surfaced highlights + manual features
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_moments (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                        -- most_discussed|funniest|insightful|favorite|fastest_growing|top_contribution|featured
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  ref_type TEXT,
  ref_id TEXT,
  ref_url TEXT,
  is_manual BOOLEAN DEFAULT FALSE,
  featured_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_moments_circle ON community_moments (circle_id, created_at DESC);

-- ------------------------------------------------------------
-- 7. community_reports + moderation log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_reports (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,                 -- post|comment|member|room|project|challenge_entry
  target_id TEXT NOT NULL,
  target_author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT DEFAULT '',
  details TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',       -- open|resolved|dismissed
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_community_reports_circle ON community_reports (circle_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS community_moderation_logs (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,                      -- warn|mute|ban|unban|remove_post|lock|delete_comment|pin|feature|approve
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_type TEXT,
  target_id TEXT,
  reason TEXT DEFAULT '',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_circle ON community_moderation_logs (circle_id, created_at DESC);

-- ------------------------------------------------------------
-- 8. community_recognitions — contribution-based badges
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_recognitions (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  giver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                        -- knowledge_keeper|creator|connector|conversation_starter|organizer|top_contributor|custom
  label TEXT DEFAULT '',
  message TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recognitions_circle ON community_recognitions (circle_id, receiver_id);

-- ------------------------------------------------------------
-- 9. community_category_configs — category engine (seeded by API)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_category_configs (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 10. community_evolution_recommendations — owner-approved evolution
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_evolution_recommendations (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                        -- feature|space|role|module
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  payload JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',    -- pending|applied|dismissed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_evolution_circle ON community_evolution_recommendations (circle_id, status);

-- ------------------------------------------------------------
-- 11. Community activity fast-path: view for pulse/dna computation
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW community_recent_activity AS
SELECT
  ca.circle_id,
  ca.actor_id,
  ca.activity_type,
  ca.target_type,
  ca.target_id,
  ca.metadata,
  ca.created_at
FROM circle_activity ca
WHERE ca.created_at > NOW() - INTERVAL '24 hours';

-- ------------------------------------------------------------
-- 12. Auto-update member last_active whenever activity is logged
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_circle_member_activity() RETURNS TRIGGER AS $$
BEGIN
  -- circle_activity.circle_id is text while circle_members.circle_id is bigint
  UPDATE circle_members SET last_active = NOW()
  WHERE circle_id = NEW.circle_id::bigint AND user_id = NEW.actor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_member_activity ON circle_activity;
CREATE TRIGGER trg_touch_member_activity
  AFTER INSERT ON circle_activity
  FOR EACH ROW EXECUTE FUNCTION touch_circle_member_activity();