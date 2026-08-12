-- Co-Loop Sessions Table Definition
-- Tracks the owner and metadata for real-time collaborative sessions on Loop

CREATE TABLE IF NOT EXISTS co_loop_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    owner_username TEXT,
    title TEXT DEFAULT 'Untitled Co-Loop',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for lightning fast session resolution
CREATE INDEX IF NOT EXISTS idx_co_loop_sessions_session_id ON co_loop_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_co_loop_sessions_owner_id ON co_loop_sessions(owner_id);

-- Row Level Security
ALTER TABLE co_loop_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Co-Loop sessions are viewable by everyone" 
    ON co_loop_sessions FOR SELECT 
    USING (true);

CREATE POLICY "Authenticated users can create co-loop sessions" 
    ON co_loop_sessions FOR INSERT 
    WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);

CREATE POLICY "Session owners can update co-loop sessions" 
    ON co_loop_sessions FOR UPDATE 
    USING (auth.uid() = owner_id);
