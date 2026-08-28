-- Migration for Loop Chains, Duels, Coin-Powered Boosts, and Real-Time Polls

-- 1. Extend loops table for Post Types and Crowd-funded Boosts
ALTER TABLE loops ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'standard';
ALTER TABLE loops ADD COLUMN IF NOT EXISTS boost_coins_current INTEGER DEFAULT 0;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS boost_coins_target INTEGER DEFAULT 1000;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT false;

-- Table to log coin contributions for boosting loops
CREATE TABLE IF NOT EXISTS loop_boosts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  coins INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Real-Time Polls Tables
CREATE TABLE IF NOT EXISTS loop_polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loop_id UUID REFERENCES loops(id) ON DELETE CASCADE UNIQUE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMP WITH TIME ZONE,
  total_votes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loop_poll_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES loop_polls(id) ON DELETE CASCADE,
  loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_poll_user_vote UNIQUE (poll_id, user_id)
);

-- 3. Loop Duels Tables
CREATE TABLE IF NOT EXISTS loop_duels (
  id BIGSERIAL PRIMARY KEY,
  prompt TEXT NOT NULL,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  loop_id TEXT REFERENCES loops(id) ON DELETE CASCADE,
  circle_id BIGINT REFERENCES circles(id),
  stake_coins INTEGER DEFAULT 50,
  duration_hours INTEGER DEFAULT 24,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active',
  winner_id UUID REFERENCES profiles(id),
  duel_type TEXT DEFAULT 'standard',
  clip_url TEXT,
  prediction_question TEXT,
  betting_ends_at TIMESTAMP WITH TIME ZONE,
  correct_side TEXT,
  outcome_revealed BOOLEAN DEFAULT false,
  payout_processed BOOLEAN DEFAULT false,
  yes_stake BIGINT DEFAULT 0,
  no_stake BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loop_duel_entries (
  id BIGSERIAL PRIMARY KEY,
  duel_id BIGINT REFERENCES loop_duels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  side TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  media_url TEXT,
  votes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_duel_user_side UNIQUE (duel_id, side)
);

CREATE TABLE IF NOT EXISTS loop_duel_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  duel_id UUID REFERENCES loop_duels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  side TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_duel_user_vote UNIQUE (duel_id, user_id)
);

-- 4. Enable RLS
ALTER TABLE loop_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loop_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE loop_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE loop_duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE loop_duel_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE loop_duel_votes ENABLE ROW LEVEL SECURITY;

-- 5. Open security policies
DROP POLICY IF EXISTS "Public loop_boosts viewable" ON loop_boosts;
CREATE POLICY "Public loop_boosts viewable" ON loop_boosts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert loop_boosts" ON loop_boosts;
CREATE POLICY "Users can insert loop_boosts" ON loop_boosts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public loop_polls viewable" ON loop_polls;
CREATE POLICY "Public loop_polls viewable" ON loop_polls FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage loop_polls" ON loop_polls;
CREATE POLICY "Anyone can manage loop_polls" ON loop_polls FOR ALL USING (true);

DROP POLICY IF EXISTS "Public loop_poll_votes viewable" ON loop_poll_votes;
CREATE POLICY "Public loop_poll_votes viewable" ON loop_poll_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert loop_poll_votes" ON loop_poll_votes;
CREATE POLICY "Anyone can insert loop_poll_votes" ON loop_poll_votes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public loop_duels viewable" ON loop_duels;
CREATE POLICY "Public loop_duels viewable" ON loop_duels FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage loop_duels" ON loop_duels;
CREATE POLICY "Anyone can manage loop_duels" ON loop_duels FOR ALL USING (true);

DROP POLICY IF EXISTS "Public loop_duel_entries viewable" ON loop_duel_entries;
CREATE POLICY "Public loop_duel_entries viewable" ON loop_duel_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage loop_duel_entries" ON loop_duel_entries;
CREATE POLICY "Anyone can manage loop_duel_entries" ON loop_duel_entries FOR ALL USING (true);

DROP POLICY IF EXISTS "Public loop_duel_votes viewable" ON loop_duel_votes;
CREATE POLICY "Public loop_duel_votes viewable" ON loop_duel_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage loop_duel_votes" ON loop_duel_votes;
CREATE POLICY "Anyone can manage loop_duel_votes" ON loop_duel_votes FOR ALL USING (true);

-- 6. Add to Supabase Realtime Publication safely
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE loop_polls;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE loop_poll_votes;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE loop_duels;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE loop_duel_entries;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE loop_duel_votes;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE loop_boosts;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
