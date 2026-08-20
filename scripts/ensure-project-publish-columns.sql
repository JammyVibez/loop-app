-- Ensure developer_projects has publish columns for the preview feature
-- Idempotent — safe to run multiple times.

ALTER TABLE public.developer_projects
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.developer_projects
  ADD COLUMN IF NOT EXISTS subdomain TEXT;

-- Unique index on subdomain (only for published projects)
CREATE UNIQUE INDEX IF NOT EXISTS idx_developer_projects_subdomain
  ON public.developer_projects(subdomain)
  WHERE subdomain IS NOT NULL AND subdomain != '';
