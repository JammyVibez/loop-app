-- =============================================================================
-- FIX ALL FOREIGN KEY CONSTRAINTS REFERENCING auth.users
-- =============================================================================
-- Problem: Tables were created with REFERENCES auth.users(id) but the app
-- inserts rows before the auth user exists in auth.users table.
-- Solution: Change FK to reference profiles(id) which always exists first.
-- =============================================================================

-- 1. Fix user_pfp_frames.user_id (the error you're seeing)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'user_pfp_frames'::regclass 
    AND contype = 'f' 
    AND pg_get_constraintdef(oid) LIKE '%auth.users%'
  ) THEN
    ALTER TABLE user_pfp_frames 
      DROP CONSTRAINT IF EXISTS user_pfp_frames_user_id_fkey;
    ALTER TABLE user_pfp_frames 
      ADD CONSTRAINT user_pfp_frames_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Fixed: user_pfp_frames.user_id -> profiles(id)';
  ELSE
    RAISE NOTICE 'Skipped: user_pfp_frames FK already correct or missing';
  END IF;
END $$;

-- 2. Find and fix ALL other tables with FK to auth.users
DO $fix_all$ DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT 
      conrelid::regclass::text AS table_name,
      conname AS constraint_name,
      pg_get_constraintdef(oid) AS constraint_def
    FROM pg_constraint 
    WHERE contype = 'f' 
    AND connamespace = 'public'::regnamespace
    AND pg_get_constraintdef(oid) LIKE '%auth.users%'
  LOOP
    -- Extract the column name from the constraint definition
    -- Format: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
    DECLARE
      col_match TEXT[];
      col_name TEXT;
      new_constraint_name TEXT;
    BEGIN
      col_match := regexp_matches(r.constraint_def, 'FOREIGN KEY \((\w+)\)');
      IF col_match IS NOT NULL AND array_length(col_match, 1) > 0 THEN
        col_name := col_match[1];
        new_constraint_name := r.table_name || '_' || col_name || '_fkey';
        
        -- Drop old FK
        EXECUTE 'ALTER TABLE ' || r.table_name || ' DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
        
        -- Add new FK referencing profiles(id)
        EXECUTE 'ALTER TABLE ' || r.table_name || 
                ' ADD CONSTRAINT ' || new_constraint_name || 
                ' FOREIGN KEY (' || col_name || ') REFERENCES profiles(id) ON DELETE CASCADE';
        
        RAISE NOTICE 'Fixed: %.% -> profiles(id) [was: %]', r.table_name, col_name, r.constraint_name;
      END IF;
    END;
  END LOOP;
END $fix_all$;

-- 3. Verify no more auth.users FK references remain
DO $$ DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM pg_constraint 
  WHERE contype = 'f' 
  AND connamespace = 'public'::regnamespace
  AND pg_get_constraintdef(oid) LIKE '%auth.users%';
  
  IF remaining > 0 THEN
    RAISE WARNING 'Still have % FK references to auth.users - manual fix needed', remaining;
  ELSE
    RAISE NOTICE 'All FK references to auth.users have been fixed!';
  END IF;
END $$;

-- 4. Also fix any tables that reference auth.users with UUID columns that
-- should reference profiles instead
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT 
      t.table_name,
      c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name
    WHERE c.table_schema = 'public'
    AND c.column_name = 'user_id'
    AND c.data_type = 'uuid'
    AND t.table_name NOT IN ('profiles', 'user', 'session', 'account', 'verification')
  LOOP
    -- Check if profiles table has a matching id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'id'
    ) THEN
      -- Check if there's already an FK on this column
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = (r.table_name)::regclass 
        AND contype = 'f'
        AND pg_get_constraintdef(oid) LIKE '%user_id%'
      ) THEN
        -- Try to add FK (will skip if column type doesn't match)
        BEGIN
          EXECUTE 'ALTER TABLE ' || r.table_name || 
                  ' ADD CONSTRAINT fk_' || r.table_name || '_user_id' ||
                  ' FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE';
          RAISE NOTICE 'Added FK: %.user_id -> profiles(id)', r.table_name;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Skipped %.user_id (type mismatch or other issue): %', r.table_name, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;
END $$;

-- 5. Reload PostgREST schema
NOTIFY pgrst, 'reload schema';

-- 6. Final verification query
SELECT 
  conrelid::regclass::text AS table_name,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint 
WHERE contype = 'f' 
AND connamespace = 'public'::regnamespace
AND pg_get_constraintdef(oid) LIKE '%profiles%'
ORDER BY table_name;
