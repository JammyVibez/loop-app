-- Circle Activity Feed — tracks all meaningful events for the activity tab
CREATE TABLE IF NOT EXISTS circle_activity (
  id BIGSERIAL PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'post_created', 'member_joined', 'member_left', 'event_created', 'event_rsvp', 'badge_earned', 'message_sent', 'room_created', 'milestone_reached'
  target_type TEXT, -- 'post', 'member', 'event', 'room', 'badge', null
  target_id TEXT, -- ID of the target entity
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_activity_circle_id ON circle_activity(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_activity_created_at ON circle_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_activity_actor_id ON circle_activity(actor_id);

-- Circle Badges — predefined achievements for circle members
CREATE TABLE IF NOT EXISTS circle_badges (
  id BIGSERIAL PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '⭐', -- emoji
  color TEXT DEFAULT 'amber', -- badge color theme
  requirement_type TEXT NOT NULL, -- 'posts_count', 'reactions_received', 'events_attended', 'streak_days', 'days_member', 'invites_sent'
  requirement_value INTEGER NOT NULL DEFAULT 1,
  rarity TEXT DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(circle_id, name)
);

-- Circle Member Stats — tracks per-member stats for leaderboards and badge progress
CREATE TABLE IF NOT EXISTS circle_member_stats (
  id BIGSERIAL PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  posts_count INTEGER DEFAULT 0,
  reactions_received INTEGER DEFAULT 0,
  reactions_given INTEGER DEFAULT 0,
  comments_made INTEGER DEFAULT 0,
  events_attended INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  total_contribution_score INTEGER DEFAULT 0,
  earned_badges TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_member_stats_leaderboard ON circle_member_stats(circle_id, total_contribution_score DESC);

-- Circle Co-Loop Sessions — collaborative loops tied to a circle
CREATE TABLE IF NOT EXISTS circle_coloop_sessions (
  id BIGSERIAL PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  max_collaborators INTEGER DEFAULT 5,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  loop_id TEXT, -- linked loop post after completion
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_coloop_sessions ON circle_coloop_sessions(circle_id, status);

-- Enable RLS
ALTER TABLE circle_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_member_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_coloop_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies — public read, authenticated write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public circle_activity read' AND tablename = 'circle_activity') THEN
    CREATE POLICY "Public circle_activity read" ON circle_activity FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated circle_activity insert' AND tablename = 'circle_activity') THEN
    CREATE POLICY "Authenticated circle_activity insert" ON circle_activity FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public circle_badges read' AND tablename = 'circle_badges') THEN
    CREATE POLICY "Public circle_badges read" ON circle_badges FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated circle_badges write' AND tablename = 'circle_badges') THEN
    CREATE POLICY "Authenticated circle_badges write" ON circle_badges FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public circle_member_stats read' AND tablename = 'circle_member_stats') THEN
    CREATE POLICY "Public circle_member_stats read" ON circle_member_stats FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated circle_member_stats write' AND tablename = 'circle_member_stats') THEN
    CREATE POLICY "Authenticated circle_member_stats write" ON circle_member_stats FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public circle_coloop read' AND tablename = 'circle_coloop_sessions') THEN
    CREATE POLICY "Public circle_coloop read" ON circle_coloop_sessions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated circle_coloop write' AND tablename = 'circle_coloop_sessions') THEN
    CREATE POLICY "Authenticated circle_coloop write" ON circle_coloop_sessions FOR ALL USING (true);
  END IF;
END $$;

-- Add realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'circle_activity') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE circle_activity;
  END IF;
END $$;

-- Seed default badges for all circles (will be created via API)
-- Badges: First Post, Active Creator, Event Regular, Social Butterfly, Streak Master, Circle Veteran
