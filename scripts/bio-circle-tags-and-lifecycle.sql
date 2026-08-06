-- Bio community tags + circle lifecycle (activate / deactivate)
-- Safe to re-run.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tagged_circles jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN profiles.tagged_circles IS
  'Public community tags shown on profile bio. Array of {id, name, avatar_url?}';

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_circles_is_active ON circles (is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_tagged_circles ON profiles USING gin (tagged_circles);

-- Ensure child tables cascade when a circle is hard-deleted
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'circle_members',
    'circle_posts',
    'circle_rooms',
    'circle_events',
    'circle_invitations',
    'circle_join_requests',
    'circle_bots',
    'circle_challenges',
    'circle_room_presence',
    'circle_voice_channels'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
          tbl,
          tbl || '_circle_id_fkey'
        );
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (circle_id) REFERENCES circles(id) ON DELETE CASCADE',
          tbl,
          tbl || '_circle_id_fkey'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not harden FK cascade on %: %', tbl, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;
