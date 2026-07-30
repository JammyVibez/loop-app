-- Loop Social Platform Database Migrations
-- Run these SQL commands in your Supabase SQL editor

-- =============================================
-- 1. Update profiles table with new fields
-- =============================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS available_earnings DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS verification_level TEXT CHECK (verification_level IN ('none', 'basic', 'influencer', 'root')) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS can_stream BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stream_key TEXT,
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS loops_count INTEGER DEFAULT 0;

-- =============================================
-- 2. Create live_streams table
-- =============================================

CREATE TABLE IF NOT EXISTS live_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    stream_key TEXT NOT NULL,
    rtmp_url TEXT,
    hls_url TEXT,
    status TEXT CHECK (status IN ('preparing', 'live', 'ended', 'paused')) DEFAULT 'preparing',
    viewer_count INTEGER DEFAULT 0,
    max_viewers INTEGER DEFAULT 0,
    category TEXT DEFAULT 'general',
    tags TEXT[] DEFAULT '{}',
    is_premium_only BOOLEAN DEFAULT false,
    chat_enabled BOOLEAN DEFAULT true,
    gifts_enabled BOOLEAN DEFAULT true,
    total_earnings DECIMAL(10,2) DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for live_streams
CREATE INDEX IF NOT EXISTS idx_live_streams_streamer_id ON live_streams(streamer_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_category ON live_streams(category);
CREATE INDEX IF NOT EXISTS idx_live_streams_created_at ON live_streams(created_at DESC);

-- =============================================
-- 3. Create stream_viewers table
-- =============================================

CREATE TABLE IF NOT EXISTS stream_viewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    watch_time INTEGER DEFAULT 0,
    UNIQUE(stream_id, user_id)
);

-- Create indexes for stream_viewers
CREATE INDEX IF NOT EXISTS idx_stream_viewers_stream_id ON stream_viewers(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_user_id ON stream_viewers(user_id);

-- =============================================
-- 4. Create stream_chat table
-- =============================================

CREATE TABLE IF NOT EXISTS stream_chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type TEXT CHECK (message_type IN ('text', 'gift', 'system')) DEFAULT 'text',
    gift_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for stream_chat
CREATE INDEX IF NOT EXISTS idx_stream_chat_stream_id ON stream_chat(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_chat_created_at ON stream_chat(created_at DESC);

-- =============================================
-- 5. Create gifts table
-- =============================================

CREATE TABLE IF NOT EXISTS gifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_url TEXT NOT NULL,
    animation_url TEXT,
    price_coins INTEGER NOT NULL CHECK (price_coins > 0),
    rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')) DEFAULT 'common',
    effects JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for gifts
CREATE INDEX IF NOT EXISTS idx_gifts_rarity ON gifts(rarity);
CREATE INDEX IF NOT EXISTS idx_gifts_price_coins ON gifts(price_coins);
CREATE INDEX IF NOT EXISTS idx_gifts_is_active ON gifts(is_active);

-- =============================================
-- 6. Create gift_transactions table
-- =============================================

CREATE TABLE IF NOT EXISTS gift_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    gift_id UUID REFERENCES gifts(id) ON DELETE CASCADE,
    stream_id UUID REFERENCES live_streams(id) ON DELETE SET NULL,
    loop_id UUID REFERENCES loops(id) ON DELETE SET NULL,
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    total_cost INTEGER NOT NULL CHECK (total_cost > 0),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for gift_transactions
CREATE INDEX IF NOT EXISTS idx_gift_transactions_sender_id ON gift_transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_recipient_id ON gift_transactions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_stream_id ON gift_transactions(stream_id);
CREATE INDEX IF NOT EXISTS idx_gift_transactions_created_at ON gift_transactions(created_at DESC);

-- =============================================
-- 7. Create earnings table
-- =============================================

CREATE TABLE IF NOT EXISTS earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    source_type TEXT CHECK (source_type IN ('gift', 'premium', 'tip', 'ad_revenue')) NOT NULL,
    source_id UUID,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency TEXT CHECK (currency IN ('coins', 'usd')) DEFAULT 'coins',
    status TEXT CHECK (status IN ('pending', 'available', 'withdrawn')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for earnings
CREATE INDEX IF NOT EXISTS idx_earnings_user_id ON earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_status ON earnings(status);
CREATE INDEX IF NOT EXISTS idx_earnings_created_at ON earnings(created_at DESC);

-- =============================================
-- 8. Create withdrawals table
-- =============================================

CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 10),
    currency TEXT CHECK (currency IN ('usd')) DEFAULT 'usd',
    method TEXT CHECK (method IN ('paypal', 'bank_transfer', 'crypto')) NOT NULL,
    method_details JSONB NOT NULL,
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    transaction_id TEXT,
    fees DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(10,2) NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for withdrawals
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_requested_at ON withdrawals(requested_at DESC);

-- =============================================
-- 9. Create reels table
-- =============================================

CREATE TABLE IF NOT EXISTS reels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT CHECK (content_type IN ('video', 'image', 'audio', 'text')) NOT NULL,
    content_url TEXT,
    thumbnail_url TEXT,
    duration INTEGER, -- in seconds
    hashtags TEXT[] DEFAULT '{}',
    music_id UUID,
    effects JSONB,
    visibility TEXT CHECK (visibility IN ('public', 'private', 'followers')) DEFAULT 'public',
    allows_comments BOOLEAN DEFAULT true,
    allows_duets BOOLEAN DEFAULT true,
    allows_downloads BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for reels
CREATE INDEX IF NOT EXISTS idx_reels_author_id ON reels(author_id);
CREATE INDEX IF NOT EXISTS idx_reels_content_type ON reels(content_type);
CREATE INDEX IF NOT EXISTS idx_reels_visibility ON reels(visibility);
CREATE INDEX IF NOT EXISTS idx_reels_hashtags ON reels USING GIN(hashtags);
CREATE INDEX IF NOT EXISTS idx_reels_view_count ON reels(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON reels(created_at DESC);

-- =============================================
-- 10. Create reel_interactions table
-- =============================================

CREATE TABLE IF NOT EXISTS reel_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    reel_id UUID REFERENCES reels(id) ON DELETE CASCADE,
    interaction_type TEXT CHECK (interaction_type IN ('like', 'view', 'share', 'save')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, reel_id, interaction_type)
);

-- Create indexes for reel_interactions
CREATE INDEX IF NOT EXISTS idx_reel_interactions_user_id ON reel_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_reel_interactions_reel_id ON reel_interactions(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_interactions_type ON reel_interactions(interaction_type);

-- =============================================
-- 11. Create database functions
-- =============================================

-- Function to increment stream viewers
CREATE OR REPLACE FUNCTION increment_stream_viewers(stream_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE live_streams 
    SET viewer_count = viewer_count + 1,
        max_viewers = GREATEST(max_viewers, viewer_count + 1)
    WHERE id = stream_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement stream viewers
CREATE OR REPLACE FUNCTION decrement_stream_viewers(stream_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE live_streams 
    SET viewer_count = GREATEST(0, viewer_count - 1)
    WHERE id = stream_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment reel interactions
CREATE OR REPLACE FUNCTION increment_reel_interaction(reel_id UUID, interaction_type TEXT)
RETURNS void AS $$
BEGIN
    CASE interaction_type
        WHEN 'like' THEN
            UPDATE reels SET like_count = like_count + 1 WHERE id = reel_id;
        WHEN 'view' THEN
            UPDATE reels SET view_count = view_count + 1 WHERE id = reel_id;
        WHEN 'share' THEN
            UPDATE reels SET share_count = share_count + 1 WHERE id = reel_id;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement reel interactions
CREATE OR REPLACE FUNCTION decrement_reel_interaction(reel_id UUID, interaction_type TEXT)
RETURNS void AS $$
BEGIN
    CASE interaction_type
        WHEN 'like' THEN
            UPDATE reels SET like_count = GREATEST(0, like_count - 1) WHERE id = reel_id;
        WHEN 'view' THEN
            UPDATE reels SET view_count = GREATEST(0, view_count - 1) WHERE id = reel_id;
        WHEN 'share' THEN
            UPDATE reels SET share_count = GREATEST(0, share_count - 1) WHERE id = reel_id;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to add user earnings
CREATE OR REPLACE FUNCTION add_user_earnings(user_id UUID, amount DECIMAL)
RETURNS void AS $$
BEGIN
    UPDATE profiles 
    SET total_earnings = total_earnings + amount,
        available_earnings = available_earnings + amount
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 12. Insert default gifts
-- =============================================

INSERT INTO gifts (name, description, icon_url, price_coins, rarity) VALUES
('Heart', 'Show some love', '/gifts/heart.png', 10, 'common'),
('Rose', 'A beautiful rose', '/gifts/rose.png', 25, 'common'),
('Star', 'You''re a star!', '/gifts/star.png', 50, 'rare'),
('Diamond', 'Precious and rare', '/gifts/diamond.png', 100, 'epic'),
('Crown', 'For the royalty', '/gifts/crown.png', 500, 'legendary'),
('Fire', 'This content is fire!', '/gifts/fire.png', 75, 'rare'),
('Lightning', 'Electrifying performance', '/gifts/lightning.png', 150, 'epic'),
('Rainbow', 'Colorful and magical', '/gifts/rainbow.png', 200, 'epic'),
('Rocket', 'To the moon!', '/gifts/rocket.png', 300, 'legendary'),
('Trophy', 'Winner winner!', '/gifts/trophy.png', 1000, 'legendary')
ON CONFLICT DO NOTHING;

-- =============================================
-- 13. Enable Row Level Security (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_interactions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 14. Create RLS Policies
-- =============================================

-- Live streams policies
CREATE POLICY "Public streams are viewable by everyone" ON live_streams
    FOR SELECT USING (status = 'live' OR status = 'ended');

CREATE POLICY "Users can create their own streams" ON live_streams
    FOR INSERT WITH CHECK (auth.uid() = streamer_id);

CREATE POLICY "Users can update their own streams" ON live_streams
    FOR UPDATE USING (auth.uid() = streamer_id);

-- Stream viewers policies
CREATE POLICY "Users can view stream viewers" ON stream_viewers
    FOR SELECT USING (true);

CREATE POLICY "Users can join streams" ON stream_viewers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Stream chat policies
CREATE POLICY "Users can view stream chat" ON stream_chat
    FOR SELECT USING (true);

CREATE POLICY "Users can send chat messages" ON stream_chat
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Gifts policies
CREATE POLICY "Everyone can view active gifts" ON gifts
    FOR SELECT USING (is_active = true);

-- Gift transactions policies
CREATE POLICY "Users can view their gift transactions" ON gift_transactions
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send gifts" ON gift_transactions
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Earnings policies
CREATE POLICY "Users can view their own earnings" ON earnings
    FOR SELECT USING (auth.uid() = user_id);

-- Withdrawals policies
CREATE POLICY "Users can view their own withdrawals" ON withdrawals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create withdrawal requests" ON withdrawals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reels policies
CREATE POLICY "Public reels are viewable by everyone" ON reels
    FOR SELECT USING (visibility = 'public');

CREATE POLICY "Users can view their own reels" ON reels
    FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Users can create reels" ON reels
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own reels" ON reels
    FOR UPDATE USING (auth.uid() = author_id);

-- Reel interactions policies
CREATE POLICY "Users can view reel interactions" ON reel_interactions
    FOR SELECT USING (true);

CREATE POLICY "Users can interact with reels" ON reel_interactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their interactions" ON reel_interactions
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 15. Create triggers for updated_at timestamps
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_live_streams_updated_at BEFORE UPDATE ON live_streams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reels_updated_at BEFORE UPDATE ON reels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Migration Complete
-- =============================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON notifications(user_id, is_read);

COMMIT;
