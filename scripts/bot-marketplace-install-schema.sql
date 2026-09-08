-- ============================================================
-- BOT MARKETPLACE — INSTALL CLONES
-- Tracks which marketplace bot an installed community bot was
-- cloned from (buyer installs a usage-rights copy of a bot they
-- purchased into one of their own communities).
-- Ownership of the original listing stays with the creator.
-- ============================================================

ALTER TABLE community_bots ADD COLUMN IF NOT EXISTS marketplace_source_id UUID;

CREATE INDEX IF NOT EXISTS idx_community_bots_marketplace_source ON community_bots(marketplace_source_id) WHERE marketplace_source_id IS NOT NULL;
