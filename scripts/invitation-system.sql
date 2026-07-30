-- Invitation System Database Schema
-- This script creates tables for the collaborative invitation system

-- =============================================
-- INVITATIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inviter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('circle_collaboration', 'loop_collaboration', 'project_collaboration')),
    resource_id UUID NOT NULL, -- ID of the circle, loop, or project
    message TEXT DEFAULT '',
    permissions JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- LOOP COLLABORATORS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS loop_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'contributor' CHECK (role IN ('owner', 'contributor', 'viewer')),
    permissions JSONB DEFAULT '{"read": true, "write": true, "delete": false}',
    invited_by UUID REFERENCES profiles(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(loop_id, user_id)
);

-- =============================================
-- COLLABORATION SESSIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('loop', 'project', 'circle')),
    resource_id UUID NOT NULL,
    host_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    max_participants INTEGER DEFAULT 10,
    current_participants INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    session_data JSONB DEFAULT '{}', -- Store session-specific data
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SESSION PARTICIPANTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'participant' CHECK (role IN ('host', 'moderator', 'participant')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(session_id, user_id)
);

-- =============================================
-- COLLABORATION ACTIVITIES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS collaboration_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'join', 'leave', 'edit', 'comment', 'share_screen', etc.
    activity_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SHARED WORKSPACES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS shared_workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    workspace_type VARCHAR(20) DEFAULT 'general' CHECK (workspace_type IN ('general', 'code', 'design', 'writing')),
    workspace_data JSONB DEFAULT '{}', -- Store workspace content and settings
    is_public BOOLEAN DEFAULT false,
    max_collaborators INTEGER DEFAULT 5,
    current_collaborators INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- WORKSPACE COLLABORATORS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS workspace_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES shared_workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'editor' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    permissions JSONB DEFAULT '{"read": true, "write": true, "delete": false, "invite": false}',
    invited_by UUID REFERENCES profiles(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_invitations_inviter_id ON invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee_id ON invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_invitations_type ON invitations(type);
CREATE INDEX IF NOT EXISTS idx_invitations_resource_id ON invitations(resource_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);

CREATE INDEX IF NOT EXISTS idx_loop_collaborators_loop_id ON loop_collaborators(loop_id);
CREATE INDEX IF NOT EXISTS idx_loop_collaborators_user_id ON loop_collaborators(user_id);

CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_resource ON collaboration_sessions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_host_id ON collaboration_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_active ON collaboration_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_active ON session_participants(is_active);

CREATE INDEX IF NOT EXISTS idx_shared_workspaces_owner_id ON shared_workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_workspaces_type ON shared_workspaces(workspace_type);
CREATE INDEX IF NOT EXISTS idx_shared_workspaces_public ON shared_workspaces(is_public);

CREATE INDEX IF NOT EXISTS idx_workspace_collaborators_workspace_id ON workspace_collaborators(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_collaborators_user_id ON workspace_collaborators(user_id);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE loop_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_collaborators ENABLE ROW LEVEL SECURITY;

-- Invitations policies
CREATE POLICY "invitations_select_policy" ON invitations
    FOR SELECT USING (
        auth.uid() = inviter_id 
        OR auth.uid() = invitee_id
    );

CREATE POLICY "invitations_insert_policy" ON invitations
    FOR INSERT WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "invitations_update_policy" ON invitations
    FOR UPDATE USING (
        auth.uid() = invitee_id 
        OR auth.uid() = inviter_id
    );

-- Loop collaborators policies
CREATE POLICY "loop_collaborators_select_policy" ON loop_collaborators
    FOR SELECT USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM loops 
            WHERE id = loop_collaborators.loop_id 
            AND user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM loop_collaborators lc2
            WHERE lc2.loop_id = loop_collaborators.loop_id 
            AND lc2.user_id = auth.uid()
            AND lc2.role IN ('owner', 'contributor')
        )
    );

CREATE POLICY "loop_collaborators_insert_policy" ON loop_collaborators
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM loops 
            WHERE id = loop_collaborators.loop_id 
            AND user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM loop_collaborators 
            WHERE loop_id = loop_collaborators.loop_id 
            AND user_id = auth.uid() 
            AND role = 'owner'
        )
    );

-- Collaboration sessions policies
CREATE POLICY "collaboration_sessions_select_policy" ON collaboration_sessions
    FOR SELECT USING (
        auth.uid() = host_id
        OR EXISTS (
            SELECT 1 FROM session_participants 
            WHERE session_id = collaboration_sessions.id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "collaboration_sessions_insert_policy" ON collaboration_sessions
    FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "collaboration_sessions_update_policy" ON collaboration_sessions
    FOR UPDATE USING (
        auth.uid() = host_id
        OR EXISTS (
            SELECT 1 FROM session_participants 
            WHERE session_id = collaboration_sessions.id 
            AND user_id = auth.uid() 
            AND role IN ('host', 'moderator')
        )
    );

-- Session participants policies
CREATE POLICY "session_participants_select_policy" ON session_participants
    FOR SELECT USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM collaboration_sessions 
            WHERE id = session_participants.session_id 
            AND host_id = auth.uid()
        )
    );

CREATE POLICY "session_participants_insert_policy" ON session_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "session_participants_update_policy" ON session_participants
    FOR UPDATE USING (auth.uid() = user_id);

-- Shared workspaces policies
CREATE POLICY "shared_workspaces_select_policy" ON shared_workspaces
    FOR SELECT USING (
        is_public = true
        OR auth.uid() = owner_id
        OR EXISTS (
            SELECT 1 FROM workspace_collaborators 
            WHERE workspace_id = shared_workspaces.id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "shared_workspaces_insert_policy" ON shared_workspaces
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "shared_workspaces_update_policy" ON shared_workspaces
    FOR UPDATE USING (
        auth.uid() = owner_id
        OR EXISTS (
            SELECT 1 FROM workspace_collaborators 
            WHERE workspace_id = shared_workspaces.id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );

-- Workspace collaborators policies
CREATE POLICY "workspace_collaborators_select_policy" ON workspace_collaborators
    FOR SELECT USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM shared_workspaces 
            WHERE id = workspace_collaborators.workspace_id 
            AND owner_id = auth.uid()
        )
    );

CREATE POLICY "workspace_collaborators_insert_policy" ON workspace_collaborators
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM shared_workspaces 
            WHERE id = workspace_collaborators.workspace_id 
            AND owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM workspace_collaborators 
            WHERE workspace_id = workspace_collaborators.workspace_id 
            AND user_id = auth.uid() 
            AND (permissions->>'invite')::boolean = true
        )
    );

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invitation_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_invitations_updated_at 
    BEFORE UPDATE ON invitations 
    FOR EACH ROW EXECUTE FUNCTION update_invitation_updated_at_column();

CREATE TRIGGER update_shared_workspaces_updated_at 
    BEFORE UPDATE ON shared_workspaces 
    FOR EACH ROW EXECUTE FUNCTION update_invitation_updated_at_column();

-- Function to auto-expire invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
    UPDATE invitations 
    SET status = 'expired' 
    WHERE status = 'pending' 
    AND expires_at < NOW();
END;
$$ language 'plpgsql';

-- Function to update collaboration session participant count
CREATE OR REPLACE FUNCTION update_session_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE collaboration_sessions 
        SET current_participants = current_participants + 1 
        WHERE id = NEW.session_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE collaboration_sessions 
        SET current_participants = GREATEST(0, current_participants - 1) 
        WHERE id = OLD.session_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle active status changes
        IF OLD.is_active = true AND NEW.is_active = false THEN
            UPDATE collaboration_sessions 
            SET current_participants = GREATEST(0, current_participants - 1) 
            WHERE id = NEW.session_id;
        ELSIF OLD.is_active = false AND NEW.is_active = true THEN
            UPDATE collaboration_sessions 
            SET current_participants = current_participants + 1 
            WHERE id = NEW.session_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Triggers for participant count
CREATE TRIGGER update_session_participant_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON session_participants 
    FOR EACH ROW EXECUTE FUNCTION update_session_participant_count();

-- Function to update workspace collaborator count
CREATE OR REPLACE FUNCTION update_workspace_collaborator_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE shared_workspaces 
        SET current_collaborators = current_collaborators + 1 
        WHERE id = NEW.workspace_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE shared_workspaces 
        SET current_collaborators = GREATEST(1, current_collaborators - 1) 
        WHERE id = OLD.workspace_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Triggers for workspace collaborator count
CREATE TRIGGER update_workspace_collaborator_count_trigger
    AFTER INSERT OR DELETE ON workspace_collaborators 
    FOR EACH ROW EXECUTE FUNCTION update_workspace_collaborator_count();

-- Create a scheduled job to expire old invitations (if using pg_cron)
-- SELECT cron.schedule('expire-invitations', '0 * * * *', 'SELECT expire_old_invitations();');
