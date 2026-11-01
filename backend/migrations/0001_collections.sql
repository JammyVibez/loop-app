-- LOOP collections: reusable, shareable sets of existing platform objects.
-- This migration is additive and does not rewrite legacy bookmarks or content.

CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(80) NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
    description VARCHAR(500) NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private', 'unlisted', 'public')),
    is_collaborative BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_owner_created
    ON collections(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collections_public_created
    ON collections(created_at DESC)
    WHERE visibility = 'public';

CREATE TABLE IF NOT EXISTS collection_members (
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer'
        CHECK (role IN ('editor', 'viewer')),
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_members_user
    ON collection_members(user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('loop', 'circle', 'external')),
    loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    external_url TEXT,
    title_override VARCHAR(160),
    note VARCHAR(500),
    position BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT collection_item_target_matches_type CHECK (
        (item_type = 'loop' AND loop_id IS NOT NULL AND circle_id IS NULL AND external_url IS NULL)
        OR
        (item_type = 'circle' AND loop_id IS NULL AND circle_id IS NOT NULL AND external_url IS NULL)
        OR
        (item_type = 'external' AND loop_id IS NULL AND circle_id IS NULL AND external_url IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_collection_items_order
    ON collection_items(collection_id, position, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_items_unique_loop
    ON collection_items(collection_id, loop_id)
    WHERE loop_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_items_unique_circle
    ON collection_items(collection_id, circle_id)
    WHERE circle_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_items_unique_external
    ON collection_items(collection_id, external_url)
    WHERE external_url IS NOT NULL;
