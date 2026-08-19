-- Curated custom emojis managed by admins
-- These appear in the emoji picker across the app

CREATE TABLE IF NOT EXISTS curated_emojis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shortcode TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  preview_url TEXT,
  category TEXT DEFAULT 'custom',
  is_active BOOLEAN DEFAULT true,
  added_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for active emoji lookups
CREATE INDEX IF NOT EXISTS idx_curated_emojis_active ON curated_emojis(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_curated_emojis_shortcode ON curated_emojis(shortcode);

-- RLS: admins can do everything, everyone can read active emojis
ALTER TABLE curated_emojis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active emojis"
  ON curated_emojis FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage emojis"
  ON curated_emojis FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );
