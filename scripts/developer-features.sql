-- Developer Features Database Schema
-- This script creates tables for the developer collaboration features

-- =============================================
-- DEVELOPER PROJECTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS developer_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    framework VARCHAR(50) DEFAULT 'None',
    tags TEXT[] DEFAULT '{}',
    code_snippet TEXT NOT NULL,
    repository_url TEXT,
    demo_url TEXT,
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    branches INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PROJECT STARS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS project_stars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES developer_projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- =============================================
-- PROJECT FORKS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS project_forks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_project_id UUID REFERENCES developer_projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    forked_project_id UUID REFERENCES developer_projects(id) ON DELETE SET NULL,
    forked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(original_project_id, user_id)
);

-- =============================================
-- PROJECT COMMENTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS project_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES developer_projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES project_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PROJECT COLLABORATORS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS project_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES developer_projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'contributor' CHECK (role IN ('owner', 'maintainer', 'contributor')),
    permissions JSONB DEFAULT '{"read": true, "write": false, "admin": false}',
    invited_by UUID REFERENCES profiles(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- =============================================
-- CODE SNIPPETS TABLE (for sharing individual snippets)
-- =============================================

CREATE TABLE IF NOT EXISTS code_snippets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    language VARCHAR(50) NOT NULL,
    code TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    likes INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SNIPPET LIKES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS snippet_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snippet_id UUID REFERENCES code_snippets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(snippet_id, user_id)
);

-- =============================================
-- DEVELOPER SKILLS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS developer_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    skill_name VARCHAR(100) NOT NULL,
    skill_level VARCHAR(20) DEFAULT 'beginner' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    years_experience INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, skill_name)
);

-- =============================================
-- DEVELOPER PORTFOLIO TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS developer_portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    website_url TEXT,
    github_url TEXT,
    linkedin_url TEXT,
    resume_url TEXT,
    skills TEXT[] DEFAULT '{}',
    experience_years INTEGER DEFAULT 0,
    hourly_rate DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    is_available_for_hire BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_developer_projects_author_id ON developer_projects(author_id);
CREATE INDEX IF NOT EXISTS idx_developer_projects_language ON developer_projects(language);
CREATE INDEX IF NOT EXISTS idx_developer_projects_framework ON developer_projects(framework);
CREATE INDEX IF NOT EXISTS idx_developer_projects_stars ON developer_projects(stars DESC);
CREATE INDEX IF NOT EXISTS idx_developer_projects_created_at ON developer_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_developer_projects_tags ON developer_projects USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_project_stars_project_id ON project_stars(project_id);
CREATE INDEX IF NOT EXISTS idx_project_stars_user_id ON project_stars(user_id);

CREATE INDEX IF NOT EXISTS idx_project_forks_original_project_id ON project_forks(original_project_id);
CREATE INDEX IF NOT EXISTS idx_project_forks_user_id ON project_forks(user_id);

CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_user_id ON project_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_parent_comment_id ON project_comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_code_snippets_author_id ON code_snippets(author_id);
CREATE INDEX IF NOT EXISTS idx_code_snippets_language ON code_snippets(language);
CREATE INDEX IF NOT EXISTS idx_code_snippets_likes ON code_snippets(likes DESC);
CREATE INDEX IF NOT EXISTS idx_code_snippets_tags ON code_snippets USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_developer_skills_user_id ON developer_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_developer_skills_skill_name ON developer_skills(skill_name);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_developer_projects_search ON developer_projects 
    USING GIN(to_tsvector('english', title || ' ' || description));

CREATE INDEX IF NOT EXISTS idx_code_snippets_search ON code_snippets 
    USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE developer_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stars ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_forks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE snippet_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_portfolios ENABLE ROW LEVEL SECURITY;

-- Developer projects policies
CREATE POLICY "developer_projects_select_policy" ON developer_projects
    FOR SELECT USING (
        is_public = true 
        OR auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM project_collaborators 
            WHERE project_id = developer_projects.id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "developer_projects_insert_policy" ON developer_projects
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "developer_projects_update_policy" ON developer_projects
    FOR UPDATE USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM project_collaborators 
            WHERE project_id = developer_projects.id 
            AND user_id = auth.uid() 
            AND (permissions->>'admin')::boolean = true
        )
    );

-- Project stars policies
CREATE POLICY "project_stars_select_policy" ON project_stars
    FOR SELECT USING (true);

CREATE POLICY "project_stars_insert_policy" ON project_stars
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "project_stars_delete_policy" ON project_stars
    FOR DELETE USING (auth.uid() = user_id);

-- Project forks policies
CREATE POLICY "project_forks_select_policy" ON project_forks
    FOR SELECT USING (true);

CREATE POLICY "project_forks_insert_policy" ON project_forks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Project comments policies
CREATE POLICY "project_comments_select_policy" ON project_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM developer_projects 
            WHERE id = project_comments.project_id 
            AND (
                is_public = true 
                OR author_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_collaborators 
                    WHERE project_id = developer_projects.id 
                    AND user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "project_comments_insert_policy" ON project_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "project_comments_update_policy" ON project_comments
    FOR UPDATE USING (auth.uid() = user_id);

-- Code snippets policies
CREATE POLICY "code_snippets_select_policy" ON code_snippets
    FOR SELECT USING (
        is_public = true 
        OR auth.uid() = author_id
    );

CREATE POLICY "code_snippets_insert_policy" ON code_snippets
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "code_snippets_update_policy" ON code_snippets
    FOR UPDATE USING (auth.uid() = author_id);

-- Developer skills policies
CREATE POLICY "developer_skills_select_policy" ON developer_skills
    FOR SELECT USING (true);

CREATE POLICY "developer_skills_insert_policy" ON developer_skills
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "developer_skills_update_policy" ON developer_skills
    FOR UPDATE USING (auth.uid() = user_id);

-- Developer portfolios policies
CREATE POLICY "developer_portfolios_select_policy" ON developer_portfolios
    FOR SELECT USING (true);

CREATE POLICY "developer_portfolios_insert_policy" ON developer_portfolios
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "developer_portfolios_update_policy" ON developer_portfolios
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_developer_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_developer_projects_updated_at 
    BEFORE UPDATE ON developer_projects 
    FOR EACH ROW EXECUTE FUNCTION update_developer_updated_at_column();

CREATE TRIGGER update_project_comments_updated_at 
    BEFORE UPDATE ON project_comments 
    FOR EACH ROW EXECUTE FUNCTION update_developer_updated_at_column();

CREATE TRIGGER update_code_snippets_updated_at 
    BEFORE UPDATE ON code_snippets 
    FOR EACH ROW EXECUTE FUNCTION update_developer_updated_at_column();

CREATE TRIGGER update_developer_portfolios_updated_at 
    BEFORE UPDATE ON developer_portfolios 
    FOR EACH ROW EXECUTE FUNCTION update_developer_updated_at_column();

-- Function to update project stats when starred/forked
CREATE OR REPLACE FUNCTION update_project_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'project_stars' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE developer_projects 
            SET stars = stars + 1 
            WHERE id = NEW.project_id;
            RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE developer_projects 
            SET stars = GREATEST(0, stars - 1) 
            WHERE id = OLD.project_id;
            RETURN OLD;
        END IF;
    ELSIF TG_TABLE_NAME = 'project_forks' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE developer_projects 
            SET forks = forks + 1 
            WHERE id = NEW.original_project_id;
            RETURN NEW;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Triggers for project stats
CREATE TRIGGER update_project_star_count 
    AFTER INSERT OR DELETE ON project_stars 
    FOR EACH ROW EXECUTE FUNCTION update_project_stats();

CREATE TRIGGER update_project_fork_count 
    AFTER INSERT ON project_forks 
    FOR EACH ROW EXECUTE FUNCTION update_project_stats();

-- =============================================
-- SAMPLE DATA
-- =============================================

-- Insert sample developer projects
INSERT INTO developer_projects (
    author_id, 
    title, 
    description, 
    language, 
    framework, 
    tags, 
    code_snippet,
    repository_url,
    demo_url
) VALUES (
    (SELECT id FROM profiles WHERE username = 'admin' LIMIT 1),
    'React Loop Tree Component',
    'A reusable React component for rendering interactive loop trees with animations',
    'JavaScript',
    'React',
    ARRAY['react', 'components', 'trees', 'animation'],
    'import React, { useState } from ''react'';

export const LoopTree = ({ data, onBranch }) => {
  const [expanded, setExpanded] = useState(new Set());
  
  const toggleNode = (nodeId) => {
    setExpanded(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  return (
    <div className="loop-tree">
      <TreeNode 
        node={data} 
        expanded={expanded}
        onToggle={toggleNode}
        onBranch={onBranch}
      />
    </div>
  );
};',
    'https://github.com/example/react-loop-tree',
    'https://react-loop-tree-demo.vercel.app'
) ON CONFLICT DO NOTHING;
