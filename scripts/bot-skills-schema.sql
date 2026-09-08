-- ============================================================
-- BOT SKILLS — DAILY COIN CLAIMS
-- Store/reward bots (e.g. CoinKeeper) can grant a small daily
-- Loop Coin reward to community members. This table makes the
-- claim atomic + once-per-day per bot per user (no farming).
-- ============================================================

CREATE TABLE IF NOT EXISTS bot_daily_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES community_bots(id) ON DELETE CASCADE,
    community_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL DEFAULT 0,
    claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (bot_id, user_id, claim_date)
);

CREATE INDEX IF NOT EXISTS idx_bot_daily_claims_user ON bot_daily_claims(user_id, claim_date DESC);
