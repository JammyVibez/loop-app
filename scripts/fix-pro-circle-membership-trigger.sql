-- Fix: every INSERT into `profiles` failed with
--   invalid input syntax for type uuid: "6"
--
-- `public.sync_pro_circle_membership()` (AFTER INSERT OR UPDATE OF is_premium,
-- premium_expires_at ON profiles) declared its `pro_circle_id` variable as
-- UUID, but `circles.id` is bigint. PL/pgSQL assigns across types via the
-- type's I/O functions, so selecting the premium-only circle — id 6,
-- "Loop Pro Lounge" — into that variable tried to parse the text "6" as a
-- uuid and raised. The trigger fire order meant the failure happened before
-- anything else in the insert, so:
--   * new signups never got a profile row (Better Auth user created, no
--     profiles row), and
--   * onboarding step 1 (profile setup) always failed.
--
-- The variable is now BIGINT to match circles.id, and the upsert no longer
-- relies on an `ON CONFLICT (circle_id, user_id)` target — that unique
-- constraint/index does not exist on circle_members, so it would have raised
-- "no unique or exclusion constraint matching the ON CONFLICT specification"
-- as soon as a Pro user hit the insert branch. Same behaviour, no schema
-- change beyond this function.
CREATE OR REPLACE FUNCTION public.sync_pro_circle_membership()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  pro_circle_id BIGINT;
  is_pro BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.is_premium IS NOT DISTINCT FROM OLD.is_premium
     AND NEW.premium_expires_at IS NOT DISTINCT FROM OLD.premium_expires_at THEN
    RETURN NEW;
  END IF;

  SELECT id INTO pro_circle_id
  FROM circles
  WHERE is_premium_only = TRUE AND is_active = TRUE
  ORDER BY created_at ASC
  LIMIT 1;

  IF pro_circle_id IS NULL THEN
    RETURN NEW;
  END IF;

  is_pro := NEW.is_premium = TRUE
            AND (NEW.premium_expires_at IS NULL OR NEW.premium_expires_at > now());

  IF is_pro THEN
    UPDATE circle_members
       SET status = 'active', role = 'member'
     WHERE circle_id = pro_circle_id AND user_id = NEW.id;

    IF NOT FOUND THEN
      INSERT INTO circle_members (circle_id, user_id, role, status, joined_at)
      VALUES (pro_circle_id, NEW.id, 'member', 'active', now());
    END IF;
  ELSE
    DELETE FROM circle_members
    WHERE circle_id = pro_circle_id AND user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
