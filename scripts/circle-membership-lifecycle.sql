-- LOOP Circle membership lifecycle.
-- Requires circles-schema-alignment.sql and account-status-appeals-schema.sql
-- to have been applied by the canonical production setup runner.

CREATE OR REPLACE FUNCTION public.join_circle(
  p_circle_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_circle public.circles%ROWTYPE;
  v_profile RECORD;
  v_member public.circle_members%ROWTYPE;
  v_status TEXT;
  v_role TEXT := 'member';
  v_active_count INTEGER;
BEGIN
  -- Serialize joins against the capacity of this Circle.
  SELECT * INTO v_circle
  FROM public.circles
  WHERE id = p_circle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Circle not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT is_banned, is_deleted
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_profile.is_banned IS TRUE OR v_profile.is_deleted IS TRUE THEN
    RAISE EXCEPTION 'Suspended or deleted accounts cannot join Circles'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_member
  FROM public.circle_members
  WHERE circle_id = p_circle_id AND user_id = p_user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_member.status IN ('active', 'approved') THEN
      RETURN jsonb_build_object(
        'status', 'active',
        'already_member', TRUE,
        'is_private', COALESCE(v_circle.is_private, FALSE),
        'member_id', v_member.id
      );
    END IF;
    IF v_member.status = 'pending' THEN
      RETURN jsonb_build_object(
        'status', 'pending',
        'already_member', TRUE,
        'is_private', COALESCE(v_circle.is_private, FALSE),
        'member_id', v_member.id
      );
    END IF;
    IF v_member.status = 'banned' THEN
      RAISE EXCEPTION 'You cannot rejoin this Circle' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_status := CASE WHEN COALESCE(v_circle.is_private, FALSE) THEN 'pending' ELSE 'active' END;

  -- A Circle owner is always restored with the owner role; other joiners can
  -- never choose an elevated role from this public endpoint.
  IF p_user_id = COALESCE(v_circle.owner_id, v_circle.creator_id)
     OR p_user_id = v_circle.creator_id THEN
    v_status := 'active';
    v_role := 'owner';
  END IF;

  IF v_status = 'active' AND v_role <> 'owner' AND v_circle.max_members IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.circle_members
    WHERE circle_id = p_circle_id
      AND status IN ('active', 'approved');

    IF v_active_count >= v_circle.max_members THEN
      RAISE EXCEPTION 'This Circle has reached its member limit' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.circle_members(circle_id, user_id, role, status, joined_at)
  VALUES (p_circle_id, p_user_id, v_role, v_status, NOW())
  ON CONFLICT (circle_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    joined_at = EXCLUDED.joined_at
  RETURNING * INTO v_member;

  SELECT COUNT(*)::INTEGER INTO v_active_count
  FROM public.circle_members
  WHERE circle_id = p_circle_id
    AND status IN ('active', 'approved');

  UPDATE public.circles
  SET member_count = v_active_count,
      updated_at = NOW()
  WHERE id = p_circle_id;

  RETURN jsonb_build_object(
    'status', v_status,
    'already_member', FALSE,
    'is_private', COALESCE(v_circle.is_private, FALSE),
    'member_id', v_member.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_circle(UUID, UUID) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.join_circle(UUID, UUID) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.join_circle(UUID, UUID) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.join_circle(UUID, UUID) TO service_role;
  END IF;
END
$$;
