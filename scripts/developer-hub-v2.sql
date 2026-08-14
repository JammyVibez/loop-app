-- Developer Hub v2 schema
-- 1) Link a developer project to its published Marketplace listing
-- 2) Realtime for project comments / code snippets / project stats updates
-- 3) Missing RLS delete policies + perf indexes

-- =============================================
-- Link projects to their Marketplace listing
-- =============================================
ALTER TABLE developer_projects
    ADD COLUMN IF NOT EXISTS published_listing_id UUID
    REFERENCES community_marketplace_listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_developer_projects_published_listing
    ON developer_projects(published_listing_id)
    WHERE published_listing_id IS NOT NULL;

-- =============================================
-- Realtime publications (idempotent)
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE developer_projects; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE project_comments; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE code_snippets; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- =============================================
-- RLS delete policies (owners can remove their own content)
-- =============================================
DROP POLICY IF EXISTS "code_snippets_delete_policy" ON code_snippets;
CREATE POLICY "code_snippets_delete_policy" ON code_snippets
    FOR DELETE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "project_comments_delete_policy" ON project_comments;
CREATE POLICY "project_comments_delete_policy" ON project_comments
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "snippet_likes_delete_policy" ON snippet_likes;
CREATE POLICY "snippet_likes_delete_policy" ON snippet_likes
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- Perf indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_code_snippets_created_at ON code_snippets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_comments_created_at ON project_comments(project_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_snippet_likes_snippet_id ON snippet_likes(snippet_id);
