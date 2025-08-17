-- Enhanced Database Schema Part 2: Gifting, NFTs, and Advanced Features
-- Continue from enhanced-database-schema.sql

-- =============================================
-- GIFTING SYSTEM
-- =============================================

-- Gift types
CREATE TABLE IF NOT EXISTS gift_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'theme', 'premium', 'virtual_item', 'collectible'
    icon_url TEXT,
    animation_data JSONB DEFAULT '{}',
    rarity VARCHAR(20) DEFAULT 'common',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User gifts
CREATE TABLE IF NOT EXISTS user_gifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    gift_type_id UUID REFERENCES gift_types(id),
    item_id UUID, -- References themes, shop_items, etc.
    message TEXT,
    is_opened BOOLEAN DEFAULT false,
    is_anonymous BOOLEAN DEFAULT false,
    opened_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Surprise boxes
CREATE TABLE IF NOT EXISTS surprise_boxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    box_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'premium', 'legendary'
    possible_items JSONB NOT NULL, -- Array of possible items with probabilities
    animation_data JSONB DEFAULT '{}',
    price_coins INTEGER DEFAULT 0,
    price_usd DECIMAL(10,2) DEFAULT 0,
    is_limited BOOLEAN DEFAULT false,
    available_until TIMESTAMP WITH TIME ZONE,
    purchase_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- NFT SYSTEM
-- =============================================

-- NFT collections
CREATE TABLE IF NOT EXISTS nft_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    creator_id UUID REFERENCES profiles(id),
    contract_address VARCHAR(100),
    blockchain VARCHAR(50) DEFAULT 'ethereum',
    collection_image TEXT,
    banner_image TEXT,
    floor_price DECIMAL(18,8) DEFAULT 0,
    total_supply INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    royalty_percentage DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NFT items
CREATE TABLE IF NOT EXISTS nft_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID REFERENCES nft_collections(id) ON DELETE CASCADE,
    token_id VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    image_url TEXT,
    animation_url TEXT,
    attributes JSONB DEFAULT '{}',
    metadata_uri TEXT,
    owner_id UUID REFERENCES profiles(id),
    is_listed BOOLEAN DEFAULT false,
    price DECIMAL(18,8),
    currency VARCHAR(20) DEFAULT 'ETH',
    rarity_rank INTEGER,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(collection_id, token_id)
);

-- NFT showcase galleries
CREATE TABLE IF NOT EXISTS nft_galleries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    gallery_type VARCHAR(50) DEFAULT 'personal', -- 'personal', 'curated', 'exhibition'
    layout_3d JSONB NOT NULL, -- 3D gallery layout
    featured_nfts UUID[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    visit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- LIVE STREAMING SYSTEM
-- =============================================

-- Live streams
CREATE TABLE IF NOT EXISTS live_streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    streamer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    stream_key VARCHAR(100) UNIQUE NOT NULL,
    rtmp_url TEXT,
    hls_url TEXT,
    thumbnail_url TEXT,
    is_live BOOLEAN DEFAULT false,
    viewer_count INTEGER DEFAULT 0,
    max_viewers INTEGER DEFAULT 0,
    chat_enabled BOOLEAN DEFAULT true,
    recording_enabled BOOLEAN DEFAULT false,
    overlay_3d JSONB DEFAULT '{}', -- 3D overlay configuration
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stream viewers
CREATE TABLE IF NOT EXISTS stream_viewers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    watch_duration INTEGER DEFAULT 0, -- in seconds
    UNIQUE(stream_id, user_id)
);

-- Stream chat
CREATE TABLE IF NOT EXISTS stream_chat (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'emote', 'system'
    is_highlighted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- VIRTUAL EVENTS SYSTEM
-- =============================================

-- Virtual events
CREATE TABLE IF NOT EXISTS virtual_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) DEFAULT 'conference', -- 'conference', 'concert', 'meetup', 'exhibition'
    venue_3d JSONB NOT NULL, -- 3D venue configuration
    max_attendees INTEGER DEFAULT 100,
    is_public BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false,
    ticket_price_coins INTEGER DEFAULT 0,
    ticket_price_usd DECIMAL(10,2) DEFAULT 0,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'live', 'ended', 'cancelled'
    attendee_count INTEGER DEFAULT 0,
    recording_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event attendees
CREATE TABLE IF NOT EXISTS event_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES virtual_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'registered', -- 'registered', 'attended', 'no_show'
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    attended_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(event_id, user_id)
);
