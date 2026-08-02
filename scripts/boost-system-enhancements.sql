-- Enhancements for Loop Boost System
ALTER TABLE loops ADD COLUMN IF NOT EXISTS boosted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE loops ADD COLUMN IF NOT EXISTS boost_tier INTEGER DEFAULT 0;

-- Ensure loop_boosts table exists and has user details & timestamps
CREATE TABLE IF NOT EXISTS loop_boosts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  coins INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE loop_boosts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public loop_boosts viewable" ON loop_boosts;
CREATE POLICY "Public loop_boosts viewable" ON loop_boosts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert loop_boosts" ON loop_boosts;
CREATE POLICY "Users can insert loop_boosts" ON loop_boosts FOR INSERT WITH CHECK (true);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE loop_boosts;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
