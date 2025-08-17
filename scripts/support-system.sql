-- Support System Database Schema
-- This script creates tables for the help and support system with real-time chat

-- =============================================
-- SUPPORT TICKETS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('technical', 'billing', 'account', 'feature', 'other')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
    assigned_to UUID REFERENCES profiles(id), -- Support agent assigned to ticket
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- SUPPORT MESSAGES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_from_support BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]', -- Array of attachment URLs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SUPPORT KNOWLEDGE BASE
-- =============================================

CREATE TABLE IF NOT EXISTS knowledge_base_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    author_id UUID REFERENCES profiles(id),
    is_published BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ARTICLE FEEDBACK
-- =============================================

CREATE TABLE IF NOT EXISTS article_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES knowledge_base_articles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL,
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(article_id, user_id)
);

-- =============================================
-- SUPPORT AGENT PROFILES
-- =============================================

-- Add support-related columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_support BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS support_level VARCHAR(20) DEFAULT 'agent' CHECK (support_level IN ('agent', 'senior', 'manager'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS support_specialties TEXT[] DEFAULT '{}';

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON support_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base_articles(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_published ON knowledge_base_articles(is_published);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON knowledge_base_articles USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_profiles_is_support ON profiles(is_support);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_base_search ON knowledge_base_articles 
    USING GIN(to_tsvector('english', title || ' ' || content));

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_feedback ENABLE ROW LEVEL SECURITY;

-- Support tickets policies
CREATE POLICY "support_tickets_select_policy" ON support_tickets
    FOR SELECT USING (
        auth.uid() = user_id 
        OR auth.uid() = assigned_to
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND (is_support = true OR is_admin = true)
        )
    );

CREATE POLICY "support_tickets_insert_policy" ON support_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "support_tickets_update_policy" ON support_tickets
    FOR UPDATE USING (
        auth.uid() = assigned_to
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND (is_support = true OR is_admin = true)
        )
    );

-- Support messages policies
CREATE POLICY "support_messages_select_policy" ON support_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM support_tickets 
            WHERE id = support_messages.ticket_id 
            AND (
                user_id = auth.uid() 
                OR assigned_to = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() AND (is_support = true OR is_admin = true)
                )
            )
        )
    );

CREATE POLICY "support_messages_insert_policy" ON support_messages
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND (
            EXISTS (
                SELECT 1 FROM support_tickets 
                WHERE id = support_messages.ticket_id 
                AND user_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND (is_support = true OR is_admin = true)
            )
        )
    );

-- Knowledge base policies
CREATE POLICY "knowledge_base_select_policy" ON knowledge_base_articles
    FOR SELECT USING (is_published = true);

CREATE POLICY "knowledge_base_manage_policy" ON knowledge_base_articles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND (is_support = true OR is_admin = true)
        )
    );

-- Article feedback policies
CREATE POLICY "article_feedback_select_policy" ON article_feedback
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "article_feedback_insert_policy" ON article_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "article_feedback_update_policy" ON article_feedback
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_support_tickets_updated_at 
    BEFORE UPDATE ON support_tickets 
    FOR EACH ROW EXECUTE FUNCTION update_support_updated_at_column();

CREATE TRIGGER update_support_messages_updated_at 
    BEFORE UPDATE ON support_messages 
    FOR EACH ROW EXECUTE FUNCTION update_support_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at 
    BEFORE UPDATE ON knowledge_base_articles 
    FOR EACH ROW EXECUTE FUNCTION update_support_updated_at_column();

-- Function to auto-assign tickets to available support agents
CREATE OR REPLACE FUNCTION auto_assign_ticket()
RETURNS TRIGGER AS $$
DECLARE
    agent_id UUID;
BEGIN
    -- Find available support agent with least active tickets
    SELECT p.id INTO agent_id
    FROM profiles p
    LEFT JOIN support_tickets st ON st.assigned_to = p.id AND st.status IN ('open', 'in-progress')
    WHERE p.is_support = true
    GROUP BY p.id
    ORDER BY COUNT(st.id) ASC, RANDOM()
    LIMIT 1;
    
    IF agent_id IS NOT NULL THEN
        NEW.assigned_to = agent_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for auto-assignment
CREATE TRIGGER auto_assign_support_ticket 
    BEFORE INSERT ON support_tickets 
    FOR EACH ROW EXECUTE FUNCTION auto_assign_ticket();

-- Function to update article helpful counts
CREATE OR REPLACE FUNCTION update_article_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_helpful THEN
            UPDATE knowledge_base_articles 
            SET helpful_count = helpful_count + 1 
            WHERE id = NEW.article_id;
        ELSE
            UPDATE knowledge_base_articles 
            SET not_helpful_count = not_helpful_count + 1 
            WHERE id = NEW.article_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle feedback change
        IF OLD.is_helpful != NEW.is_helpful THEN
            IF NEW.is_helpful THEN
                UPDATE knowledge_base_articles 
                SET helpful_count = helpful_count + 1, not_helpful_count = not_helpful_count - 1 
                WHERE id = NEW.article_id;
            ELSE
                UPDATE knowledge_base_articles 
                SET helpful_count = helpful_count - 1, not_helpful_count = not_helpful_count + 1 
                WHERE id = NEW.article_id;
            END IF;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.is_helpful THEN
            UPDATE knowledge_base_articles 
            SET helpful_count = helpful_count - 1 
            WHERE id = OLD.article_id;
        ELSE
            UPDATE knowledge_base_articles 
            SET not_helpful_count = not_helpful_count - 1 
            WHERE id = OLD.article_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Trigger for article feedback counts
CREATE TRIGGER update_article_feedback_count 
    AFTER INSERT OR UPDATE OR DELETE ON article_feedback 
    FOR EACH ROW EXECUTE FUNCTION update_article_helpful_count();

-- =============================================
-- SAMPLE DATA
-- =============================================

-- Insert sample knowledge base articles
INSERT INTO knowledge_base_articles (title, content, category, tags, is_published) VALUES
('How to Create Your First Loop', 'Step-by-step guide to creating your first loop on the platform...', 'getting-started', ARRAY['loops', 'tutorial', 'beginner'], true),
('Understanding Loop Branching', 'Learn how to branch from existing loops and create connected content...', 'features', ARRAY['branching', 'loops', 'collaboration'], true),
('Premium Features Overview', 'Discover all the exclusive features available with Premium subscription...', 'premium', ARRAY['premium', 'features', 'subscription'], true),
('Troubleshooting Login Issues', 'Common solutions for login and authentication problems...', 'technical', ARRAY['login', 'authentication', 'troubleshooting'], true),
('Community Guidelines', 'Rules and guidelines for participating in the Loop community...', 'community', ARRAY['guidelines', 'rules', 'community'], true);

-- Create a sample support agent
INSERT INTO profiles (id, username, display_name, is_support, support_level, support_specialties) 
VALUES (
    uuid_generate_v4(),
    'support_agent',
    'Support Agent',
    true,
    'agent',
    ARRAY['technical', 'billing', 'account']
) ON CONFLICT (username) DO NOTHING;
