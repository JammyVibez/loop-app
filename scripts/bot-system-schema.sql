-- ============================================================
-- LOOP BOT SYSTEM — communities, marketplace, chat, activity
-- Run against your Supabase project (SQL editor) once.
-- Ownership model: creator always owns the bot; marketplace
-- purchases grant usage/source rights, never ownership.
-- ============================================================

-- 1. Bots (one bot = one deployable service inside one community)
CREATE TABLE IF NOT EXISTS community_bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT DEFAULT '',
    avatar_url TEXT,
    category TEXT DEFAULT 'utility',      -- moderation|welcome|notification|ecommerce|utility|ai|games|custom
    status TEXT DEFAULT 'offline',        -- online|offline
    deployment_type TEXT DEFAULT 'hosted',-- hosted|source
    webhook_url TEXT,                     -- live bot endpoint (owner's hosting)
    invite_link TEXT,                     -- invite/link for hosted access
    source_url TEXT,                      -- repo/download for self-hostable bots
    auto_reply TEXT,                      -- built-in reply when no webhook is set
    commands TEXT[] DEFAULT '{}',         -- custom command list the bot exposes
    secret_token TEXT NOT NULL,           -- owner-only management key
    is_listed BOOLEAN DEFAULT false,      -- Bot Marketplace listing
    price_coins INTEGER DEFAULT 0,        -- marketplace price in Loop Coins
    allows_hosted BOOLEAN DEFAULT true,   -- hosted usage rights purchasable
    allows_source BOOLEAN DEFAULT false,  -- source code purchasable
    rating_sum INTEGER DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(community_id, name)
);

CREATE INDEX IF NOT EXISTS idx_community_bots_community ON community_bots(community_id);
CREATE INDEX IF NOT EXISTS idx_community_bots_owner ON community_bots(owner_id);
CREATE INDEX IF NOT EXISTS idx_community_bots_listed ON community_bots(is_listed) WHERE is_listed = true;

-- 2. Bot activity feed (recent bot actions inside the community)
CREATE TABLE IF NOT EXISTS bot_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES community_bots(id) ON DELETE CASCADE,
    community_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    type TEXT DEFAULT 'action',           -- created|status|command|moderation|welcome|notify|purchase|custom
    title TEXT DEFAULT '',
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_activity_bot ON bot_activity(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_activity_community ON bot_activity(community_id, created_at DESC);

-- 3. Bot chat messages (community members talk to bots)
CREATE TABLE IF NOT EXISTS bot_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES community_bots(id) ON DELETE CASCADE,
    community_id BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL => bot message
    role TEXT NOT NULL DEFAULT 'user',    -- user|bot
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_chat_bot ON bot_chat_messages(bot_id, created_at);

-- 4. Marketplace purchases (usage/source rights — ownership stays with creator)
CREATE TABLE IF NOT EXISTS bot_marketplace_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES community_bots(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    community_id BIGINT REFERENCES circles(id) ON DELETE CASCADE,
    purchase_type TEXT NOT NULL,          -- hosted|source
    price_coins INTEGER NOT NULL DEFAULT 0,
    delivery TEXT,                        -- access link / source + instructions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bot_id, buyer_id, purchase_type)
);

CREATE INDEX IF NOT EXISTS idx_bot_purchases_buyer ON bot_marketplace_purchases(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_purchases_bot ON bot_marketplace_purchases(bot_id);

-- 5. Marketplace ratings (buyers rate bots they purchased)
CREATE TABLE IF NOT EXISTS bot_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES community_bots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bot_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_ratings_bot ON bot_ratings(bot_id);