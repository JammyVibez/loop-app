-- ============================================================
-- LOOP COMMUNITIES — POWERS + THREADS
-- Two primitives the community engine was missing:
--   1. Powers  — named, coloured, permission-bearing roles a member can hold
--                more than one of (replaces the fixed member|moderator|admin enum
--                as the ONLY way to express standing).
--   2. Threads — a unit of work with a lifecycle (open → decided → archived)
--                and an outcome, instead of an eternal channel firehose.
-- Both hang off circles(id), which is what a community is.
-- ============================================================

-- ------------------------------------------------------------
-- 1. community_roles — "Powers"
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_roles (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  icon TEXT DEFAULT 'shield',
  -- Array of permission keys from lib/community-permissions.ts
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Higher priority wins when two powers conflict on a per-thread gate.
  priority INTEGER NOT NULL DEFAULT 0,
  -- Auto-granted to every member when they join.
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (circle_id, name)
);
CREATE INDEX IF NOT EXISTS idx_community_roles_circle ON community_roles (circle_id, priority DESC, created_at);

-- ------------------------------------------------------------
-- 2. community_member_roles — assignments (a member can hold several)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_member_roles (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES community_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_member_roles_circle_user ON community_member_roles (circle_id, user_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_role ON community_member_roles (role_id);

-- ------------------------------------------------------------
-- 3. community_threads — the work spine
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_threads (
  id BIGSERIAL PRIMARY KEY,
  circle_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  -- Optional home space (a space is where the thread's posts land).
  space_id BIGINT REFERENCES community_spaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  prompt TEXT DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'make',          -- make | decide | ask | show
  state TEXT NOT NULL DEFAULT 'open',         -- open | decided | archived
  -- What came out of it: the decision, the artifact, the answer.
  outcome TEXT DEFAULT '',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  contribution_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  decided_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_threads_circle_state
  ON community_threads (circle_id, state, is_pinned DESC, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_threads_activity
  ON community_threads (circle_id, last_activity_at DESC);

-- ------------------------------------------------------------
-- 4. community_thread_follows — per-thread notification level
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_thread_follows (
  id BIGSERIAL PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES community_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'all',           -- all | mentions | none
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (thread_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_thread_follows_user ON community_thread_follows (user_id);

-- ------------------------------------------------------------
-- 5. Auto-grant default powers on join (keeps assignments in sync)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION grant_default_community_powers() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO community_member_roles (circle_id, user_id, role_id)
  SELECT r.circle_id, NEW.user_id, r.id
  FROM community_roles r
  WHERE r.circle_id = NEW.circle_id AND r.is_default = TRUE
  ON CONFLICT (user_id, role_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grant_default_powers ON circle_members;
CREATE TRIGGER trg_grant_default_powers
  AFTER INSERT ON circle_members
  FOR EACH ROW EXECUTE FUNCTION grant_default_community_powers();

-- ------------------------------------------------------------
-- 6. Attach posts to threads, so a thread shows its real contributions
--    instead of a hand-maintained counter.
-- ------------------------------------------------------------
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS thread_id BIGINT REFERENCES community_threads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_circle_posts_thread ON circle_posts (thread_id, created_at DESC);

-- Keep the thread's contribution count + activity stamp honest on every post.
CREATE OR REPLACE FUNCTION sync_thread_contribution() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE community_threads
       SET contribution_count = contribution_count + 1,
           last_activity_at = NOW()
     WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_thread_contribution ON circle_posts;
CREATE TRIGGER trg_sync_thread_contribution
  AFTER INSERT ON circle_posts
  FOR EACH ROW EXECUTE FUNCTION sync_thread_contribution();
