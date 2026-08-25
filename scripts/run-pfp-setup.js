const { Client } = require('pg');

const sql = `
-- 1. pfp_frames table
CREATE TABLE IF NOT EXISTS pfp_frames (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  image_type TEXT DEFAULT 'image/png',
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  price_coins INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. user_pfp_frames
CREATE TABLE IF NOT EXISTS user_pfp_frames (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frame_id BIGINT NOT NULL REFERENCES pfp_frames(id) ON DELETE CASCADE,
  equipped BOOLEAN DEFAULT false,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, frame_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_user_pfp_frames_user ON user_pfp_frames(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pfp_frames_equipped ON user_pfp_frames(user_id, equipped) WHERE equipped = true;
CREATE INDEX IF NOT EXISTS idx_pfp_frames_active ON pfp_frames(is_active) WHERE is_active = true;

-- 4. Add equipped_frame_id to profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'equipped_frame_id') THEN
    ALTER TABLE profiles ADD COLUMN equipped_frame_id BIGINT REFERENCES pfp_frames(id);
  END IF;
END $$;

-- 5. RLS
ALTER TABLE pfp_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pfp_frames ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pfp_frames_select' AND tablename = 'pfp_frames') THEN
    CREATE POLICY pfp_frames_select ON pfp_frames FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'upf_select' AND tablename = 'user_pfp_frames') THEN
    CREATE POLICY upf_select ON user_pfp_frames FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'upf_insert' AND tablename = 'user_pfp_frames') THEN
    CREATE POLICY upf_insert ON user_pfp_frames FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'upf_update' AND tablename = 'user_pfp_frames') THEN
    CREATE POLICY upf_update ON user_pfp_frames FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'upf_delete' AND tablename = 'user_pfp_frames') THEN
    CREATE POLICY upf_delete ON user_pfp_frames FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 6. Seed frames
INSERT INTO pfp_frames (name, description, image_url, is_active, price_coins, sort_order)
SELECT * FROM (VALUES
  ('None', 'Remove any frame', '', true, 0, 0),
  ('Golden', 'Premium gold border', '/pfp-frames/golden.svg', true, 0, 1),
  ('Neon Glow', 'Electric neon border', '/pfp-frames/neon.svg', true, 50, 2),
  ('Pixel Art', 'Retro pixel border', '/pfp-frames/pixel.svg', true, 75, 3),
  ('Galaxy', 'Space-themed frame', '/pfp-frames/galaxy.svg', true, 100, 4),
  ('Fire', 'Flaming border effect', '/pfp-frames/fire.svg', true, 150, 5),
  ('Diamond', 'Sparkly diamond frame', '/pfp-frames/diamond.svg', true, 200, 6),
  ('Rainbow', 'Colorful rainbow border', '/pfp-frames/rainbow.svg', true, 250, 7),
  ('Galactic', 'Deep space energy', '/pfp-frames/galactic.svg', true, 300, 8),
  ('Cyber', 'Futuristic cyber frame', '/pfp-frames/cyber.svg', true, 350, 9),
  ('Frost', 'Icy crystal border', '/pfp-frames/frost.svg', true, 400, 10),
  ('Dragon', 'Dragon scale frame', '/pfp-frames/dragon.svg', true, 500, 11)
) AS v(name, description, image_url, is_active, price_coins, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM pfp_frames LIMIT 1);

-- 7. Notify PostgREST
NOTIFY pgrst, 'reload schema';
`;

const client = new Client({
  connectionString: 'postgresql://postgres.cgtjjowhlyyrfljarfgd:yx8JhcsveQ5HOVaH@aws-1-eu-west-3.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await client.connect();
    console.log('Connected to database');
    
    await client.query(sql);
    console.log('SQL executed successfully');
    
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('pfp_frames', 'user_pfp_frames')");
    console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));
    
    const count = await client.query('SELECT COUNT(*) as count FROM pfp_frames');
    console.log('Frames seeded:', count.rows[0].count);
    
    const profileCol = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'equipped_frame_id'");
    console.log('equipped_frame_id column:', profileCol.rows.length > 0 ? 'EXISTS' : 'MISSING');
    
    await client.end();
    console.log('\nDone!');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
