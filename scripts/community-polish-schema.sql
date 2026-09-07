-- Community final-polish migration
-- Adds priority + due_date to community project tasks so task cards can show
-- priority, due dates, and overdue states like a real collaborative workspace.

ALTER TABLE community_project_tasks
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;