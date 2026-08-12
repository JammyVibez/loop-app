-- Circle enhancements: multi-media posts, polls, announcement/private
-- channel enforcement, and per-member custom roles/permissions.

-- 1. Multi-media circle posts (Pro/verified members can attach more than one
-- file; media_url stays as the first item for back-compat with old readers).
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}';

-- 2. Circle post polls (mirrors loop_polls, but scoped to a circle_post).
CREATE TABLE IF NOT EXISTS circle_post_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES circle_posts(id) ON DELETE CASCADE UNIQUE,
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_votes INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circle_post_poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES circle_post_polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    option_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_post_polls_post_id ON circle_post_polls(post_id);
CREATE INDEX IF NOT EXISTS idx_circle_post_poll_votes_poll_id ON circle_post_poll_votes(poll_id);

-- 3. Room type: allow "announcement" (admin/moderator-only posting, but
-- everyone who's a member can read) alongside text/voice/video.
DO $$
BEGIN
    ALTER TABLE circle_rooms DROP CONSTRAINT IF EXISTS circle_rooms_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Per-member custom role label + granular permission overrides, on top
-- of the fixed owner/admin/moderator/member roles — e.g. an admin can label
-- someone "Events Lead" and grant can_manage_events without making them a
-- full moderator.
ALTER TABLE circle_members ADD COLUMN IF NOT EXISTS custom_title TEXT;
ALTER TABLE circle_members ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 5. Track which rooms are visible to non-members for a public circle vs
-- restricted to actual members — powers "private channel for subscribers"
-- (subscribers = joined circle members) without inventing a new paid tier.
-- (is_private already exists on circle_rooms; nothing to add here, this is
-- enforced at the query layer — see /api/circles/[id]/rooms.)

-- 6. Circle events: the create/update/delete API always used starts_at/
-- ends_at/organizer_id (matches this table), but the events LIST UI
-- (circle-events.tsx) queried event_date/host_id — columns that never
-- existed here — and RSVP wrote directly to a circle_event_participants
-- table that didn't exist at all. Add the columns the UI actually displays
-- and the missing participants table.
ALTER TABLE circle_events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE circle_events ADD COLUMN IF NOT EXISTS event_link TEXT;
ALTER TABLE circle_events ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE circle_events ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS circle_event_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES circle_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'attending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_event_participants_event_id ON circle_event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_circle_event_participants_user_id ON circle_event_participants(user_id);

-- 7. Per-room membership for private rooms — "private channel for community
-- subscribers" means something beyond "any circle member" (every room
-- already requires circle membership to read/post at all): a private room
-- is only visible to the specific members an admin granted access to,
-- tracked here instead of circle-wide membership.
CREATE TABLE IF NOT EXISTS circle_room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES circle_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_room_members_room_id ON circle_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_circle_room_members_user_id ON circle_room_members(user_id);

-- 8. The leaderboard tab has always read circle_members.contribution_score,
-- but nothing ever wrote to it, so every circle's "Top Contributors" board
-- showed a flat 0-point tie. Add an atomic increment helper and call it from
-- the API whenever a member posts, comments, or gets liked.
CREATE OR REPLACE FUNCTION increment_circle_contribution(p_circle_id UUID, p_user_id UUID, p_amount INTEGER)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE circle_members
    SET contribution_score = GREATEST(0, COALESCE(contribution_score, 0) + p_amount)
    WHERE circle_id = p_circle_id AND user_id = p_user_id;
END;
$$;

-- 9. circle_posts was already on the realtime publication, but
-- circle_post_comments never was, so the main community feed (unlike circle
-- rooms and the admin dashboard) had no live updates when new posts or
-- comments came in — it was fetch-once-on-load only.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_post_comments;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
