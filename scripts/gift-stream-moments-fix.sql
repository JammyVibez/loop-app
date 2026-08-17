-- Gift context fix + Moments RLS fix
-- ====================================
--
-- 1) GIFTS — livestream gifting failed with:
--    "new row for relation \"gifts\" violates check constraint
--     gifts_context_type_check"
--    The CHECK constraint only allowed post/profile/comment/reel/loop, but the
--    livestream GiftModal sends context_type='stream' (and the modal also
--    supports 'branch'). Recreate the constraint including both values.
ALTER TABLE gifts DROP CONSTRAINT IF EXISTS gifts_context_type_check;
ALTER TABLE gifts ADD CONSTRAINT gifts_context_type_check
  CHECK (
    context_type IS NULL OR
    context_type IN ('post','profile','comment','reel','loop','branch','stream')
  );

-- 2) MOMENTS — the table had RLS enabled with ONLY a SELECT policy, so creating
--    a moment failed with "new row violates row-level security policy" whenever
--    the request ran without the service-role key. Add owner-scoped write
--    policies.
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moments_insert_own" ON moments;
CREATE POLICY "moments_insert_own" ON moments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "moments_update_own" ON moments;
CREATE POLICY "moments_update_own" ON moments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "moments_delete_own" ON moments;
CREATE POLICY "moments_delete_own" ON moments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "moments_select" ON moments;
CREATE POLICY "moments_select" ON moments
  FOR SELECT USING (true);

-- Realtime: make sure moments changes are broadcast.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE moments;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;
