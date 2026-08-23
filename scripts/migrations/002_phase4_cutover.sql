-- Phase 4: UUID to Snowflake ID Cutover
-- Safe approach: profiles.id stays UUID (Better Auth needs it)
-- All other tables: snowflake_id becomes the primary id
-- FK columns referencing non-profile tables: converted to BIGINT (snowflake_id values)
-- FK columns referencing profiles: remain UUID

BEGIN;

-- ============================================================
-- STEP 1: Drop ALL foreign key constraints (except on profiles)
-- We'll recreate them at the end with the new BIGINT types
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name != 'profiles'
    AND tc.table_name NOT IN ('user', 'session', 'account', 'verification', 'subscription')
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
  END LOOP;
  RAISE NOTICE 'Dropped all non-profile FK constraints';
END $$;

-- ============================================================
-- STEP 2: For FK columns that reference NON-profile tables,
--         backfill values from UUID to snowflake_id
-- ============================================================

DO $$
DECLARE
  r RECORD;
  ref_table TEXT;
  col_type TEXT;
BEGIN
  FOR r IN
    SELECT
      kcu.table_name AS source_table,
      kcu.column_name AS fk_column,
      ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name != 'profiles'
    AND tc.table_name NOT IN ('user', 'session', 'account', 'verification', 'subscription')
    AND ccu.table_name NOT IN ('profiles', 'user', 'session', 'account', 'verification', 'subscription')
  LOOP
    -- Check if the ref table has snowflake_id
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = r.ref_table
      AND column_name = 'snowflake_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = r.source_table
      AND column_name = r.fk_column
    ) THEN
      -- Get the current column type
      SELECT data_type INTO col_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = r.source_table
      AND column_name = r.fk_column;

      -- If column is UUID type, we need to update values
      IF col_type = 'uuid' THEN
        BEGIN
          EXECUTE format(
            'UPDATE %I SET %I = (SELECT snowflake_id FROM %I WHERE id = %I.%I)::bigint WHERE %I IS NOT NULL',
            r.source_table, r.fk_column, r.ref_table, r.source_table, r.fk_column, r.fk_column
          );
          RAISE NOTICE 'Updated %.% (was UUID -> snowflake_id from %)', r.source_table, r.fk_column, r.ref_table;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'FAILED updating %.%: %', r.source_table, r.fk_column, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Also handle self-referencing FKs and any remaining text/uuid FKs
-- that reference non-profile tables by doing a broader sweep

DO $$
DECLARE
  r RECORD;
  col_type TEXT;
BEGIN
  FOR r IN
    SELECT
      c.table_name,
      c.column_name,
      pg_get_constraintdef(con.oid) AS condef
    FROM information_schema.columns c
    JOIN pg_class cls ON cls.relname = c.table_name
    JOIN pg_namespace n ON n.oid = cls.relnamespace AND n.nspname = 'public'
    JOIN pg_constraint con ON con.conrelid = cls.oid AND con.contype = 'f'
    WHERE c.table_schema = 'public'
    AND c.table_name != 'profiles'
    AND c.table_name NOT IN ('user', 'session', 'account', 'verification', 'subscription')
    AND con.conkey[1] = (
      SELECT attnum FROM pg_attribute
      WHERE attrelid = cls.oid AND attname = c.column_name
    )
    AND (pg_get_constraintdef(con.oid) NOT LIKE '%profiles%' OR pg_get_constraintdef(con.oid) IS NULL)
  LOOP
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = r.table_name
    AND column_name = r.column_name;

    IF col_type = 'uuid' THEN
      BEGIN
        -- Try to find what table this FK references via the constraint def
        -- For now just log what we find
        RAISE NOTICE 'Remaining UUID FK: %.% (% type)', r.table_name, r.column_name, col_type;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- STEP 3: Drop old UUID id columns and UNIQUE constraints on snowflake_id
--         from all non-profile tables, then rename snowflake_id to id
-- ============================================================

DO $$
DECLARE
  r RECORD;
  has_snowflake BOOLEAN;
  has_pk BOOLEAN;
  pk_constraint TEXT;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name = 'id'
    AND data_type = 'uuid'
    AND table_name != 'profiles'
    AND table_name NOT IN ('user', 'session', 'account', 'verification', 'subscription')
    AND table_name NOT LIKE 'pg_%'
    GROUP BY table_name
  LOOP
    -- Check if snowflake_id exists
    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = r.table_name
      AND column_name = 'snowflake_id'
    ) INTO has_snowflake;

    IF NOT has_snowflake THEN
      RAISE NOTICE 'SKIP %: no snowflake_id column', r.table_name;
      CONTINUE;
    END IF;

    -- Drop any existing constraints on snowflake_id (unique, partial index, etc.)
    BEGIN
      EXECUTE format(
        'DO $$ DECLARE c RECORD; BEGIN FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = %I::regclass AND (SELECT attname FROM pg_attribute WHERE attrelid = conrelid AND attnum = ANY(conkey)) = ''snowflake_id'' LOOP EXECUTE format(''ALTER TABLE %%I DROP CONSTRAINT %%I'', %L, c.conname); END LOOP; END $$',
        r.table_name, r.table_name
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Get the PK constraint name
    SELECT con.conname INTO pk_constraint
    FROM pg_constraint con
    JOIN pg_class cls ON con.conrelid = cls.oid
    WHERE cls.relname = r.table_name
    AND con.contype = 'p'
    LIMIT 1;

    -- Drop old UUID id column
    BEGIN
      EXECUTE format('ALTER TABLE %I DROP COLUMN id CASCADE', r.table_name);
      RAISE NOTICE 'Dropped UUID id from %', r.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FAILED dropping id from %: %', r.table_name, SQLERRM;
      CONTINUE;
    END;

    -- Drop old PK if exists
    IF pk_constraint IS NOT NULL THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.table_name, pk_constraint);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;

    -- Rename snowflake_id to id
    BEGIN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN snowflake_id TO id', r.table_name);
      RAISE NOTICE 'Renamed snowflake_id -> id on %', r.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FAILED renaming on %: %', r.table_name, SQLERRM;
      CONTINUE;
    END;

    -- Add NOT NULL and PRIMARY KEY
    BEGIN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET NOT NULL', r.table_name);
      EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id)', r.table_name);
      RAISE NOTICE 'Set PK on %', r.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FAILED PK on %: %', r.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- STEP 4: Convert FK column types from UUID to BIGINT
--         for columns that now reference BIGINT ids
-- ============================================================

DO $$
DECLARE
  r RECORD;
  col_type TEXT;
BEGIN
  FOR r IN
    SELECT
      kcu.table_name AS source_table,
      kcu.column_name AS fk_column,
      ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name != 'profiles'
    AND tc.table_name NOT IN ('user', 'session', 'account', 'verification', 'subscription')
    AND ccu.table_name NOT IN ('profiles', 'user', 'session', 'account', 'verification', 'subscription')
  LOOP
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = r.source_table
    AND column_name = r.fk_column;

    -- If column is still UUID type (shouldn't be after step 2, but just in case)
    IF col_type = 'uuid' THEN
      BEGIN
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE bigint USING %I::text::bigint', r.source_table, r.fk_column, r.fk_column);
        RAISE NOTICE 'Converted %.% to BIGINT', r.source_table, r.fk_column;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'FAILED converting %.%: %', r.source_table, r.fk_column, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- STEP 5: Recreate foreign key constraints
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT
      kcu.table_name AS source_table,
      kcu.column_name AS fk_column,
      ccu.table_name AS ref_table,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name != 'profiles'
    AND tc.table_name NOT IN ('user', 'session', 'account', 'verification', 'subscription')
    AND ccu.table_name NOT IN ('user', 'session', 'account', 'verification', 'subscription')
  LOOP
    BEGIN
      -- Check if both columns are now the same type
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = r.source_table
        AND column_name = r.fk_column AND data_type = 'uuid'
      ) THEN
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE CASCADE',
          r.source_table, r.constraint_name, r.fk_column, r.ref_table
        );
        RAISE NOTICE 'Recreated FK: %.% -> %', r.source_table, r.fk_column, r.ref_table;
      ELSE
        RAISE NOTICE 'SKIP FK (still UUID): %.% -> %', r.source_table, r.fk_column, r.ref_table;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FAILED FK %.% -> %: %', r.source_table, r.fk_column, r.ref_table, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- STEP 6: Rebuild indexes on id columns
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name = 'id'
    AND table_name != 'profiles'
    AND table_name NOT IN ('user', 'session', 'account', 'verification', 'subscription')
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%s_id ON %I(id)',
        r.table_name, r.table_name
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- STEP 7: Ensure profiles still has snowflake_id for reference
-- ============================================================

-- profiles.id stays as UUID (Better Auth references it)
-- profiles.snowflake_id stays as BIGINT (public-facing ID)
-- Add index if not exists
CREATE INDEX IF NOT EXISTS idx_profiles_snowflake_id ON profiles(snowflake_id) WHERE snowflake_id IS NOT NULL;

COMMIT;
