-- =============================================
-- Dev Quests & Bounties — Developer Hub
-- Weekly-style challenges with Loop Coin bounties.
-- Submissions are reviewed by admins; approval credits the
-- bounty to the winner's Loop Coin balance.
-- =============================================

CREATE TABLE IF NOT EXISTS dev_quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'beginner'
        CHECK (difficulty IN ('beginner', 'intermediate', 'expert')),
    reward_coins INTEGER NOT NULL DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ends_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dev_quest_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quest_id UUID REFERENCES dev_quests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES developer_projects(id) ON DELETE SET NULL,
    link TEXT,
    note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reward_coins_awarded INTEGER DEFAULT 0,
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(quest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dev_quests_active ON dev_quests(is_active, ends_at);
CREATE INDEX IF NOT EXISTS idx_dev_quest_submissions_quest ON dev_quest_submissions(quest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_quest_submissions_user ON dev_quest_submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_quest_submissions_status ON dev_quest_submissions(status);

-- Real-time: submission status changes (e.g. admin approval) show up live.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE dev_quests; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE dev_quest_submissions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE dev_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_quest_submissions ENABLE ROW LEVEL SECURITY;

-- Quests are readable by everyone (active ones); admins manage them.
DROP POLICY IF EXISTS "dev_quests_select_policy" ON dev_quests;
CREATE POLICY "dev_quests_select_policy" ON dev_quests
    FOR SELECT USING (
        is_active = true
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "dev_quests_insert_policy" ON dev_quests;
CREATE POLICY "dev_quests_insert_policy" ON dev_quests
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "dev_quests_update_policy" ON dev_quests;
CREATE POLICY "dev_quests_update_policy" ON dev_quests
    FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Submissions: users see their own; admins see everything and can review.
DROP POLICY IF EXISTS "dev_quest_submissions_select_policy" ON dev_quest_submissions;
CREATE POLICY "dev_quest_submissions_select_policy" ON dev_quest_submissions
    FOR SELECT USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "dev_quest_submissions_insert_policy" ON dev_quest_submissions;
CREATE POLICY "dev_quest_submissions_insert_policy" ON dev_quest_submissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dev_quest_submissions_update_policy" ON dev_quest_submissions;
CREATE POLICY "dev_quest_submissions_update_policy" ON dev_quest_submissions
    FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- =============================================
-- SEED QUESTS (idempotent — fixed ids so re-runs are safe)
-- =============================================
INSERT INTO dev_quests (id, title, description, difficulty, reward_coins, tags, ends_at, created_by)
VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'Ship your first project to the Developer Hub',
    'Publish an original project (any language) to the Developer Hub. It should include a real code snippet or attached file, a clear description, and at least one tag. We''re looking for quality over size — a clean utility, API wrapper, or component beats a half-finished monolith.',
    'beginner',
    100,
    ARRAY['beginner', 'open-source', 'first-project'],
    NOW() + INTERVAL '14 days',
    NULL
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'Publish a community pack to the Marketplace',
    'Turn one of your projects into a sellable Marketplace listing (design, styling kit, or bot logic). Circle owners will be able to buy and install it — and you keep the coins from every sale plus this bounty.',
    'intermediate',
    250,
    ARRAY['marketplace', 'coins', 'community'],
    NOW() + INTERVAL '21 days',
    NULL
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'Fork & improve an existing project',
    'Fork any project in the Developer Hub and make it measurably better — add a feature, fix a bug, or improve the docs. Link your forked project and summarize what you changed in the submission note.',
    'intermediate',
    150,
    ARRAY['collaboration', 'open-source', 'fork'],
    NOW() + INTERVAL '21 days',
    NULL
  )
ON CONFLICT (id) DO NOTHING;
