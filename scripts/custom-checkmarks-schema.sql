-- Admin-created custom checkmark/verification badges.
-- Admins define badge types (solid color or gradient), then assign a badge to
-- any user. The badge renders next to the username wherever the normal
-- creator checkmark would (feed cards, profiles, comments, chat).
CREATE TABLE IF NOT EXISTS public.verification_badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    label TEXT,
    icon TEXT DEFAULT 'check',          -- check | star | shield | crown | sparkle
    colors TEXT[] NOT NULL DEFAULT ARRAY['#0ea5e9'],  -- 1 color = solid, 2 = gradient
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assigned badge per profile (null = no custom badge).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='badge_id') THEN
        ALTER TABLE public.profiles ADD COLUMN badge_id TEXT REFERENCES public.verification_badges(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='badge_assigned_at') THEN
        ALTER TABLE public.profiles ADD COLUMN badge_assigned_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_badge_id ON public.profiles(badge_id);

ALTER TABLE public.verification_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read verification_badges" ON public.verification_badges;
CREATE POLICY "Anyone can read verification_badges" ON public.verification_badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage verification_badges" ON public.verification_badges;
CREATE POLICY "Admins manage verification_badges" ON public.verification_badges FOR ALL USING (true) WITH CHECK (true);
