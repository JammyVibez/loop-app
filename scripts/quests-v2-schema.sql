-- ── 3b. Game attempts (server-verified) ───────────────────────
CREATE TABLE IF NOT EXISTS quest_game_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL DEFAULT 'memory',
    token TEXT NOT NULL DEFAULT '',
    score INTEGER DEFAULT 0,
    passed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qga_user ON quest_game_attempts(user_id, created_at DESC);
