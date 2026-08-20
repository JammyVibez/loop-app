-- Ensure is_team_member column exists in profiles table
-- Idempotent — safe to run multiple times.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_team_member BOOLEAN NOT NULL DEFAULT FALSE;

-- Also ensure team_permissions table exists
CREATE TABLE IF NOT EXISTS public.team_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted_by UUID REFERENCES public.profiles(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_team_permissions_user ON public.team_permissions(user_id);

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.is_team_member IS 'Whether this user has a Team role for the team dashboard.';
