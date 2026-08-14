-- Enable realtime for support tickets/messages + create curated_gifs table

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE support_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- Admin-curated GIFs shown across the app (chat picker, comments, etc.)
CREATE TABLE IF NOT EXISTS curated_gifs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(160) NOT NULL,
    url TEXT NOT NULL,
    preview_url TEXT,
    tags TEXT[] DEFAULT '{}',
    source VARCHAR(20) DEFAULT 'custom' CHECK (source IN ('custom', 'tenor', 'giphy', 'uploaded')),
    is_active BOOLEAN DEFAULT true,
    added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curated_gifs_active ON curated_gifs(is_active, created_at DESC);

ALTER TABLE curated_gifs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "curated_gifs_read_policy" ON curated_gifs;
CREATE POLICY "curated_gifs_read_policy" ON curated_gifs
    FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
DROP POLICY IF EXISTS "curated_gifs_manage_policy" ON curated_gifs;
CREATE POLICY "curated_gifs_manage_policy" ON curated_gifs
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Seed a starter set so the picker has content immediately
INSERT INTO curated_gifs (title, url, preview_url, tags, source) VALUES
('Mind Blown', 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', ARRAY['wow','shock','reaction'], 'giphy'),
('Celebration', 'https://media.giphy.com/media/l0AM41lC46985qEww/giphy.gif', 'https://media.giphy.com/media/l0AM41lC46985qEww/giphy.gif', ARRAY['party','hype','reaction'], 'giphy'),
('Applause', 'https://media.giphy.com/media/3o7qDEq2bMbcbPRQ2c/giphy.gif', 'https://media.giphy.com/media/3o7qDEq2bMbcbPRQ2c/giphy.gif', ARRAY['clap','applause','reaction'], 'giphy'),
('High Five', 'https://media.giphy.com/media/l0ErFaf42tKm055OM/giphy.gif', 'https://media.giphy.com/media/l0ErFaf42tKm055OM/giphy.gif', ARRAY['highfive','celebrate','reaction'], 'giphy'),
('Dance', 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif', 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif', ARRAY['dance','fun','reaction'], 'giphy'),
('Coding', 'https://media.giphy.com/media/13Hgw8T855CpYX/giphy.gif', 'https://media.giphy.com/media/13Hgw8T855CpYX/giphy.gif', ARRAY['code','dev','tech'], 'giphy')
ON CONFLICT DO NOTHING;
