-- Moments RLS fix
-- =================
-- The `moments` table had RLS enabled with ONLY a SELECT policy, so creating
-- a moment (POST /api/moments) failed with "new row violates row-level
-- security policy" whenever the request ran with the anon key (e.g. when
-- SUPABASE_SERVICE_ROLE_KEY is not set in the deploy environment, the server
-- client falls back to the anon key and RLS applies).
--
-- Fix: add owner-scoped INSERT/UPDATE/DELETE policies so authenticated
-- users can create/edit/delete their own moments, and keep moments in the
-- realtime publication so the MomentsStrip updates live.

ALTER TABLE moments ENABLE ROW LEVEL SECURITY;

-- Owner can create moments.
DROP POLICY IF EXISTS "moments_insert_own" ON moments;
CREATE POLICY "moments_insert_own" ON moments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Owner can edit their own moments (content/media).
DROP POLICY IF EXISTS "moments_update_own" ON moments;
CREATE POLICY "moments_update_own" ON moments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Owner can delete their own moments.
DROP POLICY IF EXISTS "moments_delete_own" ON moments;
CREATE POLICY "moments_delete_own" ON moments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Everyone can view moments (expiry is enforced by the API queries, which
-- always filter expires_at > now()).
DROP POLICY IF EXISTS "moments_select" ON moments;
CREATE POLICY "moments_select" ON moments
  FOR SELECT USING (true);

-- Realtime: make sure moments changes are broadcast.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE moments;
EXCEPTION WHEN duplicate_object OR unique_violation OR others THEN
  NULL;
END
$$;
