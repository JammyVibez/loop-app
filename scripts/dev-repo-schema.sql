-- =============================================
-- Developer Hub: GitHub-style ZIP projects
-- Adds columns for ZIP-based project sharing (arranged file tree + the
-- original archive), fork lineage for the upcoming code sandbox, and keeps
-- realtime + RLS in sync. Safe to run multiple times (idempotent).
-- =============================================

-- 1) New columns (see lib/dev-project-zip.ts + components/developers/project-repo-browser.tsx)
ALTER TABLE developer_projects ADD COLUMN IF NOT EXISTS file_tree JSONB DEFAULT '[]'::jsonb;
ALTER TABLE developer_projects ADD COLUMN IF NOT EXISTS repo_zip_url TEXT;
ALTER TABLE developer_projects ADD COLUMN IF NOT EXISTS forked_from_id UUID REFERENCES developer_projects(id) ON DELETE SET NULL;

-- 2) Backfill fork lineage from existing fork records so "sandbox coming soon"
--    shows on every fork created before this migration.
UPDATE developer_projects dp
SET forked_from_id = pf.original_project_id
FROM project_forks pf
WHERE pf.forked_project_id = dp.id
  AND dp.forked_from_id IS NULL;

-- 3) Index used by the detail page to link a fork back to its original.
CREATE INDEX IF NOT EXISTS idx_developer_projects_forked_from ON developer_projects(forked_from_id);

-- 4) Realtime: file tree / visibility / fork changes stream to the gallery and
--    detail page without a refresh.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE developer_projects;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- 5) RLS: private projects stay readable only by the author + collaborators.
--    (Re-declared here so it is correct even on databases created before the
--    collaborator system existed.)
DROP POLICY IF EXISTS "developer_projects_select_policy" ON developer_projects;
CREATE POLICY "developer_projects_select_policy" ON developer_projects
  FOR SELECT USING (
    is_public = true
    OR auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_id = developer_projects.id AND user_id = auth.uid()
    )
  );
