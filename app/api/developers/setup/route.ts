import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

const SETUP_SQL = `
-- Developer Projects Table
CREATE TABLE IF NOT EXISTS developer_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    language VARCHAR(50) NOT NULL DEFAULT 'javascript',
    framework VARCHAR(50) DEFAULT 'None',
    tags TEXT[] DEFAULT '{}',
    code_snippet TEXT DEFAULT '',
    files JSONB DEFAULT '[]'::jsonb,
    file_tree JSONB DEFAULT '[]'::jsonb,
    repo_zip_url TEXT,
    repository_url TEXT,
    demo_url TEXT,
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    branches INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT false,
    subdomain TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add subdomain column if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='developer_projects' AND column_name='subdomain') THEN
        ALTER TABLE developer_projects ADD COLUMN subdomain TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='developer_projects' AND column_name='is_published') THEN
        ALTER TABLE developer_projects ADD COLUMN is_published BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='developer_projects' AND column_name='file_tree') THEN
        ALTER TABLE developer_projects ADD COLUMN file_tree JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='developer_projects' AND column_name='repo_zip_url') THEN
        ALTER TABLE developer_projects ADD COLUMN repo_zip_url TEXT;
    END IF;
END $$;

-- Project Stars
CREATE TABLE IF NOT EXISTS project_stars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES developer_projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Project Forks
CREATE TABLE IF NOT EXISTS project_forks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_project_id UUID REFERENCES developer_projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    forked_project_id UUID REFERENCES developer_projects(id) ON DELETE SET NULL,
    forked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(original_project_id, user_id)
);

-- Project Comments
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

-- Project Collaborators
CREATE TABLE IF NOT EXISTS project_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES developer_projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'contributor',
    permissions JSONB DEFAULT '{"read": true, "write": false, "admin": false}',
    invited_by UUID REFERENCES profiles(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dp_author ON developer_projects(author_id);
CREATE INDEX IF NOT EXISTS idx_dp_stars ON developer_projects(stars DESC);
CREATE INDEX IF NOT EXISTS idx_dp_created ON developer_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dp_language ON developer_projects(language);
CREATE INDEX IF NOT EXISTS idx_dp_subdomain ON developer_projects(subdomain) WHERE subdomain IS NOT NULL;

-- RLS policies
ALTER TABLE developer_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stars ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_forks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any, then recreate
DROP POLICY IF EXISTS "dp_select" ON developer_projects;
DROP POLICY IF EXISTS "dp_insert" ON developer_projects;
DROP POLICY IF EXISTS "dp_update" ON developer_projects;
DROP POLICY IF EXISTS "dp_delete" ON developer_projects;
DROP POLICY IF EXISTS "ps_select" ON project_stars;
DROP POLICY IF EXISTS "ps_insert" ON project_stars;
DROP POLICY IF EXISTS "ps_delete" ON project_stars;
DROP POLICY IF EXISTS "pf_select" ON project_forks;
DROP POLICY IF EXISTS "pf_insert" ON project_forks;
DROP POLICY IF EXISTS "pc_select" ON project_comments;
DROP POLICY IF EXISTS "pc_insert" ON project_comments;
DROP POLICY IF EXISTS "pcol_select" ON project_collaborators;
DROP POLICY IF EXISTS "pcol_insert" ON project_collaborators;

CREATE POLICY "dp_select" ON developer_projects FOR SELECT USING (is_public = true OR auth.uid() = author_id);
CREATE POLICY "dp_insert" ON developer_projects FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "dp_update" ON developer_projects FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "dp_delete" ON developer_projects FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "ps_select" ON project_stars FOR SELECT USING (true);
CREATE POLICY "ps_insert" ON project_stars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ps_delete" ON project_stars FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "pf_select" ON project_forks FOR SELECT USING (true);
CREATE POLICY "pf_insert" ON project_forks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pc_select" ON project_comments FOR SELECT USING (true);
CREATE POLICY "pc_insert" ON project_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pcol_select" ON project_collaborators FOR SELECT USING (true);
CREATE POLICY "pcol_insert" ON project_collaborators FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_dp_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_developer_projects_updated_at ON developer_projects;
CREATE TRIGGER update_developer_projects_updated_at
    BEFORE UPDATE ON developer_projects
    FOR EACH ROW EXECUTE FUNCTION update_dp_updated_at();
`

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    // Check admin
    const { data: profile } = await supabase
      .from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
    if (!profile?.is_admin) return NextResponse.json({ error: "Admin only" }, { status: 403 })

    // Execute the SQL setup
    const { error } = await supabase.rpc("exec_sql", { query: SETUP_SQL }).single()

    // If exec_sql doesn't exist, try direct query via service role
    if (error) {
      // Try using the Supabase SQL API endpoint directly
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({
          error: "Cannot auto-setup: missing SUPABASE_SERVICE_ROLE_KEY. Please run the SQL manually.",
          sql: SETUP_SQL,
        }, { status: 500 })
      }

      const projectId = supabaseUrl.replace("https://", "").replace(".supabase.co", "")
      const resp = await fetch(`https://${projectId}.supabase.co/rest/v1/rpc/exec`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: SETUP_SQL }),
      })

      if (!resp.ok) {
        // Return the SQL so admin can run it manually
        return NextResponse.json({
          success: false,
          message: "Auto-setup failed. Please run the SQL below in your Supabase SQL Editor.",
          sql: SETUP_SQL,
          apiError: await resp.text(),
        }, { status: 500 })
      }
    }

    // Verify the table exists now
    const { data: testProject, error: testError } = await supabase
      .from("developer_projects")
      .select("id")
      .limit(1)

    if (testError) {
      return NextResponse.json({
        success: false,
        message: "SQL executed but table still not accessible. Please run the SQL manually in Supabase SQL Editor.",
        sql: SETUP_SQL,
        verifyError: testError.message,
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Developer tables created successfully" })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Setup failed" }, { status: 500 })
  }
}

export async function GET() {
  // Check if developer_projects table exists
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from("developer_projects").select("id").limit(1)

    return NextResponse.json({
      tableExists: !error,
      error: error?.message || null,
    })
  } catch (err: any) {
    return NextResponse.json({ tableExists: false, error: err.message })
  }
}
