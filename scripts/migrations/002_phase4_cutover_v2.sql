-- Phase 4: UUID to Snowflake ID Cutover (v2 - precise)
-- profiles.id stays UUID (Better Auth). profiles.snowflake_id = BIGINT (public).
-- All other tables: drop UUID id, rename snowflake_id to id (BIGINT).
-- Non-profile FK columns: convert from UUID to BIGINT (update values + type).
-- Profile-referencing FK columns: KEEP as UUID.

BEGIN;

-- ============================================================
-- STEP 1: Define which FK columns reference profiles (keep UUID)
-- ============================================================
-- Pattern: user_id, author_id, sender_id, recipient_id, owner_id,
-- created_by, moderator_id, reporter_id, reviewed_by, admin_id,
-- granted_by, added_by, invited_by, invitee_id, inviter_id,
-- actor_id, verified_by, deactivated_by, follower_id, following_id
-- Also: any column ending in _by or _user_id or _author_id

-- ============================================================
-- STEP 2: For NON-profile FK columns, backfill values
--         UUID -> snowflake_id of referenced row
-- ============================================================

DO $$
DECLARE
  r RECORD;
  ref_table TEXT;
  is_profile_ref BOOLEAN;
  suffixes TEXT[] := ARRAY['_user_id', '_author_id', '_sender_id', '_recipient_id', '_owner_id',
    '_created_by', '_moderator_id', '_reporter_id', '_reviewed_by', '_admin_id',
    '_granted_by', '_added_by', '_invited_by', '_invitee_id', '_inviter_id',
    '_actor_id', '_verified_by', '_deactivated_by', '_follower_id', '_following_id',
    '_by', 'user_id', 'author_id', 'sender_id', 'owner_id'];
  col_name TEXT;
  updated_count INT := 0;
  failed_count INT := 0;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    AND c.table_name != 'profiles'
    AND c.table_name NOT IN ('user', 'session', 'account', 'verification', 'subscription')
    AND c.data_type = 'uuid'
    AND c.column_name LIKE '%\_id' ESCAPE '\'
  LOOP
    col_name := r.column_name;

    -- Check if this column references profiles (user-related)
    is_profile_ref := FALSE;
    IF ANY(suffixes @> ARRAY[col_name]) THEN
      is_profile_ref := TRUE;
    END IF;

    -- Skip profile-referencing columns
    CONTINUE WHEN is_profile_ref;

    -- For entity FK columns, find the referenced table
    -- Try stripping _id suffix to get ref table name
    ref_table := regexp_replace(col_name, '(_id)$', '');
    -- Try common patterns: parent_loop_id -> loops, loop_id -> loops
    -- The ref table could be singular or plural
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ref_table
    ) THEN
      ref_table := ref_table || 's';
    END IF;

    -- Check if ref table exists and has snowflake_id
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ref_table
      AND column_name = 'snowflake_id'
    ) THEN
      BEGIN
        EXECUTE format(
          'UPDATE %I t SET %I = (SELECT r.snowflake_id FROM %I r WHERE r.id = t.%I::uuid)::bigint WHERE t.%I IS NOT NULL',
          r.table_name, r.column_name, ref_table, r.column_name, r.column_name
        );
        updated_count := updated_count + 1;
        RAISE NOTICE 'Updated %.% -> % (% values)', r.table_name, r.column_name, ref_table, updated_count;
      EXCEPTION WHEN OTHERS THEN
        failed_count := failed_count + 1;
        RAISE NOTICE 'FAILED %.%: %', r.table_name, r.column_name, SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'SKIP %.% (ref table % not found or no snowflake_id)', r.table_name, r.column_name, ref_table;
    END IF;
  END LOOP;
  RAISE NOTICE 'Total updated: %, failed: %', updated_count, failed_count;
END $$;

-- ============================================================
-- STEP 3: Also handle user_stats.user_id self-reference
-- ============================================================
-- user_stats.user_id references profiles.id (UUID) - keep as UUID

-- ============================================================
-- STEP 4: Convert non-profile FK column types from UUID to BIGINT
-- ============================================================

DO $$
DECLARE
  r RECORD;
  suffixes TEXT[] := ARRAY['_user_id', '_author_id', '_sender_id', '_recipient_id', '_owner_id',
    '_created_by', '_moderator_id', '_reporter_id', '_reviewed_by', '_admin_id',
    '_granted_by', '_added_by', '_invited_by', '_invitee_id', '_inviter_id',
    '_actor_id', '_verified_by', '_deactivated_by', '_follower_id', '_following_id',
    '_by', 'user_id', 'author_id', 'sender_id', 'owner_id'];
  is_profile_ref BOOLEAN;
  converted_count INT := 0;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    AND c.table_name != 'profiles'
    AND c.table_name NOT IN ('user', 'session', 'account', 'verification', 'subscription')
    AND c.data_type = 'uuid'
    AND c.column_name LIKE '%\_id' ESCAPE '\'
  LOOP
    is_profile_ref := FALSE;
    IF ANY(suffixes @> ARRAY[r.column_name]) THEN
      is_profile_ref := TRUE;
    END IF;
    CONTINUE WHEN is_profile_ref;

    BEGIN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE bigint USING %I::text::bigint',
        r.table_name, r.column_name, r.column_name);
      converted_count := converted_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FAILED converting %.%: %', r.table_name, r.column_name, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Converted % columns to BIGINT', converted_count;
END $$;

-- ============================================================
-- STEP 5: Drop old UUID id, rename snowflake_id to id
-- ============================================================

DO $$
DECLARE
  r RECORD;
  pk_constraint TEXT;
  done INT := 0;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name = 'id'
    AND data_type = 'uuid'
    AND table_name != 'profiles'
    AND table_name NOT IN ('user', 'session', 'account', 'verification', 'subscription')
    GROUP BY table_name
  LOOP
    -- Check snowflake_id exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.table_name
      AND column_name = 'snowflake_id'
    ) THEN
      CONTINUE;
    END IF;

    -- Drop any unique/partial constraints on snowflake_id
    BEGIN
      EXECUTE format(
        'DO $$ DECLARE c RECORD; BEGIN FOR c IN SELECT conname, contype FROM pg_constraint WHERE conrelid = %I::regclass AND contype IN (''u'', ''p'') LOOP BEGIN EXECUTE format(''ALTER TABLE %%I DROP CONSTRAINT IF EXISTS %%I'', %L, c.conname); EXCEPTION WHEN OTHERS THEN NULL; END; END LOOP; END $$',
        r.table_name, r.table_name
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Drop old PK
    SELECT con.conname INTO pk_constraint
    FROM pg_constraint con
    JOIN pg_class cls ON con.conrelid = cls.oid
    WHERE cls.relname = r.table_name AND con.contype = 'p'
    LIMIT 1;

    IF pk_constraint IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.table_name, pk_constraint);
    END IF;

    -- Drop old UUID id
    BEGIN
      EXECUTE format('ALTER TABLE %I DROP COLUMN id', r.table_name);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FAILED dropping id from %: %', r.table_name, SQLERRM;
      CONTINUE;
    END;

    -- Rename snowflake_id -> id
    EXECUTE format('ALTER TABLE %I RENAME COLUMN snowflake_id TO id', r.table_name);

    -- Set NOT NULL and PK
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET NOT NULL', r.table_name);
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id)', r.table_name);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FAILED PK on %: %', r.table_name, SQLERRM;
    END;

    done := done + 1;
  END LOOP;
  RAISE NOTICE 'Swapped id columns on % tables', done;
END $$;

-- ============================================================
-- STEP 6: Recreate FK constraints
-- ============================================================

DO $$
DECLARE
  r RECORD;
  suffixes TEXT[] := ARRAY['_user_id', '_author_id', '_sender_id', '_recipient_id', '_owner_id',
    '_created_by', '_moderator_id', '_reporter_id', '_reviewed_by', '_admin_id',
    '_granted_by', '_added_by', '_invited_by', '_invitee_id', '_inviter_id',
    '_actor_id', '_verified_by', '_deactivated_by', '_follower_id', '_following_id',
    '_by', 'user_id', 'author_id', 'sender_id', 'owner_id'];
  is_profile_ref BOOLEAN;
  ref_table TEXT;
  created INT := 0;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    AND c.table_name != 'profiles'
    AND c.table_name NOT IN ('user', 'session', 'account', 'verification', 'subscription')
    AND (c.column_name LIKE '%\_id' ESCAPE '\' OR c.column_name LIKE '%\_by')
  LOOP
    -- Determine if this references profiles or another table
    is_profile_ref := FALSE;
    IF ANY(suffixes @> ARRAY[r.column_name]) THEN
      is_profile_ref := TRUE;
    END IF;

    IF is_profile_ref THEN
      -- References profiles.id (UUID)
      IF r.data_type = 'uuid' THEN
        BEGIN
          EXECUTE format('ALTER TABLE %I ADD CONSTRAINT fk_%s_%s FOREIGN KEY (%I) REFERENCES profiles(id) ON DELETE CASCADE',
            r.table_name, r.table_name, r.column_name, r.column_name);
          created := created + 1;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'FK skip: %.% -> profiles: %', r.table_name, r.column_name, SQLERRM;
        END;
      END IF;
    ELSE
      -- References another table's id (now BIGINT)
      ref_table := regexp_replace(r.column_name, '(_id)$', '');
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ref_table
      ) THEN
        ref_table := ref_table || 's';
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ref_table
      ) AND ref_table != r.table_name THEN
        BEGIN
          EXECUTE format('ALTER TABLE %I ADD CONSTRAINT fk_%s_%s FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE CASCADE',
            r.table_name, r.table_name, r.column_name, r.column_name, ref_table);
          created := created + 1;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'FK skip: %.% -> %: %', r.table_name, r.column_name, ref_table, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;
  RAISE NOTICE 'Created % FK constraints', created;
END $$;

COMMIT;
