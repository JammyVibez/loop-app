-- =============================================
-- Developer Hub: project_collaborators wiring
-- RLS policies, realtime, owner backfill + trigger
-- Safe to run multiple times (idempotent).
-- =============================================

-- 1) Realtime: collaborator changes stream to the project detail page.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE project_collaborators;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- 2) RLS policies (table must exist before this — created in developer-features.sql)
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;

-- Anyone can read who collaborates on a project (usernames are public).
DROP POLICY IF EXISTS "project_collaborators_select_policy" ON project_collaborators;
CREATE POLICY "project_collaborators_select_policy" ON project_collaborators
  FOR SELECT USING (true);

-- Only the project author or an admin-level collaborator can invite someone.
DROP POLICY IF EXISTS "project_collaborators_insert_policy" ON project_collaborators;
CREATE POLICY "project_collaborators_insert_policy" ON project_collaborators
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT author_id FROM developer_projects WHERE id = project_id)
    OR EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_id
        AND pc.user_id = auth.uid()
        AND pc.role IN ('owner', 'maintainer')
    )
  );

-- Owner / maintainer can change roles.
DROP POLICY IF EXISTS "project_collaborators_update_policy" ON project_collaborators;
CREATE POLICY "project_collaborators_update_policy" ON project_collaborators
  FOR UPDATE USING (
    auth.uid() = (SELECT author_id FROM developer_projects WHERE id = project_id)
    OR EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_id
        AND pc.user_id = auth.uid()
        AND pc.role IN ('owner', 'maintainer')
    )
  );

-- Owner / maintainer can remove anyone; a collaborator can remove themselves (leave).
DROP POLICY IF EXISTS "project_collaborators_delete_policy" ON project_collaborators;
CREATE POLICY "project_collaborators_delete_policy" ON project_collaborators
  FOR DELETE USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT author_id FROM developer_projects WHERE id = project_id)
    OR EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_id
        AND pc.user_id = auth.uid()
        AND pc.role IN ('owner', 'maintainer')
    )
  );

-- 3) Backfill: make sure every existing project's author shows up as the owner.
INSERT INTO project_collaborators (project_id, user_id, role, permissions, invited_by, joined_at)
SELECT dp.id, dp.author_id, 'owner', '{"read": true, "write": true, "admin": true}', dp.author_id, dp.created_at
FROM developer_projects dp
ON CONFLICT (project_id, user_id) DO NOTHING;

-- 4) Trigger: automatically add the author as owner when a project is created.
CREATE OR REPLACE FUNCTION auto_add_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_collaborators (project_id, user_id, role, permissions, invited_by, joined_at)
  VALUES (NEW.id, NEW.author_id, 'owner', '{"read": true, "write": true, "admin": true}', NEW.author_id, NOW())
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_add_project_owner ON developer_projects;
CREATE TRIGGER trg_auto_add_project_owner
  AFTER INSERT ON developer_projects
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_project_owner();
