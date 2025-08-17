-- Admin Approval System Tables
-- This script creates tables for verification and premium request systems

-- =============================================
-- VERIFICATION REQUESTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS verification_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    real_name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    social_links TEXT,
    reason TEXT NOT NULL,
    verification_type VARCHAR(50) NOT NULL CHECK (verification_type IN ('influencer', 'root')),
    documents_url TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_id UUID REFERENCES profiles(id),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PREMIUM REQUESTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS premium_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly', 'annual')),
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_id UUID REFERENCES profiles(id),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SUBSCRIPTIONS TABLE (for tracking premium subscriptions)
-- =============================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly', 'annual')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_created_at ON verification_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_premium_requests_user_id ON premium_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_requests_status ON premium_requests(status);
CREATE INDEX IF NOT EXISTS idx_premium_requests_created_at ON premium_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end ON subscriptions(current_period_end);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Verification requests policies
CREATE POLICY "verification_requests_select_policy" ON verification_requests
    FOR SELECT USING (
        auth.uid() = user_id 
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "verification_requests_insert_policy" ON verification_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "verification_requests_update_policy" ON verification_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Premium requests policies
CREATE POLICY "premium_requests_select_policy" ON premium_requests
    FOR SELECT USING (
        auth.uid() = user_id 
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "premium_requests_insert_policy" ON premium_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "premium_requests_update_policy" ON premium_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Subscriptions policies
CREATE POLICY "subscriptions_select_policy" ON subscriptions
    FOR SELECT USING (
        auth.uid() = user_id 
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "subscriptions_insert_policy" ON subscriptions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "subscriptions_update_policy" ON subscriptions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =============================================
-- FUNCTIONS FOR AUTOMATIC UPDATES
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_verification_requests_updated_at 
    BEFORE UPDATE ON verification_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_premium_requests_updated_at 
    BEFORE UPDATE ON premium_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check and expire premium subscriptions
CREATE OR REPLACE FUNCTION check_expired_subscriptions()
RETURNS void AS $$
BEGIN
    -- Update expired subscriptions
    UPDATE subscriptions 
    SET status = 'expired' 
    WHERE status = 'active' 
    AND current_period_end < NOW();
    
    -- Update user profiles for expired subscriptions
    UPDATE profiles 
    SET is_premium = false, premium_expires_at = NULL
    WHERE id IN (
        SELECT user_id FROM subscriptions 
        WHERE status = 'expired' 
        AND current_period_end < NOW()
    );
END;
$$ language 'plpgsql';

-- Create a scheduled job to check for expired subscriptions (if using pg_cron)
-- SELECT cron.schedule('check-expired-subscriptions', '0 0 * * *', 'SELECT check_expired_subscriptions();');
