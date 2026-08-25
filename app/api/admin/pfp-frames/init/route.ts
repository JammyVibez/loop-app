import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

// POST /api/admin/pfp-frames/init — run once to create tables
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const authHeader = request.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { data: profile } = await supabase
      .from("profiles").select("is_admin").eq("id", user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: "Admin required" }, { status: 403 })

    // Check if tables already exist
    const { data: existing } = await supabase
      .from("pfp_frames")
      .select("id")
      .limit(1)

    if (existing !== null) {
      return NextResponse.json({ success: true, message: "Tables already exist", alreadySetup: true })
    }

    // Tables don't exist yet — need manual SQL execution
    return NextResponse.json({
      success: false,
      message: "Tables not found. Please run the SQL setup in Supabase dashboard.",
      sql: `
-- Run this in Supabase SQL Editor:

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

CREATE TABLE IF NOT EXISTS user_pfp_frames (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frame_id BIGINT NOT NULL REFERENCES pfp_frames(id) ON DELETE CASCADE,
  equipped BOOLEAN DEFAULT false,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, frame_id)
);

CREATE INDEX IF NOT EXISTS idx_user_pfp_frames_user ON user_pfp_frames(user_id);
CREATE INDEX IF NOT EXISTS idx_pfp_frames_active ON pfp_frames(is_active) WHERE is_active = true;

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

-- Add equipped_frame_id to profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'equipped_frame_id') THEN
    ALTER TABLE profiles ADD COLUMN equipped_frame_id BIGINT REFERENCES pfp_frames(id);
  END IF;
END $$;

-- Seed default frames
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

NOTIFY pgrst, 'reload schema';
      `.trim(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
