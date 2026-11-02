-- LOOP identity verification lifecycle
-- Idempotent schema migration. Run through scripts/run-production-setup.mjs.
-- Verification is an authenticity review, not a Premium entitlement.

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  real_name VARCHAR(255),
  username VARCHAR(100),
  social_links TEXT,
  reason TEXT,
  verification_type VARCHAR(50),
  documents_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name TEXT,
  category TEXT,
  website_url TEXT,
  additional_info TEXT,
  CONSTRAINT verification_requests_verification_type_check
    CHECK (verification_type IS NULL OR verification_type IN ('creator', 'business', 'public_figure', 'nonprofit', 'influencer', 'root')),
  CONSTRAINT verification_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS real_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS social_links TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS verification_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS documents_url TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS additional_info TEXT;

UPDATE public.verification_requests
SET status = 'pending'
WHERE status IS NULL;

ALTER TABLE public.verification_requests
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.verification_requests
  DROP CONSTRAINT IF EXISTS verification_requests_verification_type_check,
  DROP CONSTRAINT IF EXISTS verification_requests_status_check;

ALTER TABLE public.verification_requests
  ADD CONSTRAINT verification_requests_verification_type_check
    CHECK (verification_type IS NULL OR verification_type IN ('creator', 'business', 'public_figure', 'nonprofit', 'influencer', 'root')),
  ADD CONSTRAINT verification_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.verification_requests
    WHERE status = 'pending' AND user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Multiple pending verification requests exist for one or more users; reconcile them before applying the one-pending-request index'
      USING ERRCODE = '23505';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_requests_one_pending
  ON public.verification_requests(user_id)
  WHERE status = 'pending' AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verification_requests_status_created
  ON public.verification_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_requests_user_created
  ON public.verification_requests(user_id, created_at DESC);

-- Applications are accessed through authenticated server routes using the
-- server-only Supabase service role. Remove the old broad applicant policies
-- so clients cannot read legal names or evidence URLs directly.
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
DO $
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'verification_requests'
  LOOP
    EXECUTE FORMAT(
      'DROP POLICY %I ON public.verification_requests',
      policy_row.policyname
    );
  END LOOP;
END
$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.verification_requests FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.verification_requests FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.verification_requests TO service_role;
  END IF;
END
$$;

-- Review status and profile verification are committed together. If either
-- update fails, PostgreSQL rolls both changes back.
CREATE OR REPLACE FUNCTION public.review_verification_request(
  p_request_id UUID,
  p_reviewer_id UUID,
  p_action TEXT,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_request public.verification_requests%ROWTYPE;
  v_updated_profiles INTEGER;
  v_note TEXT := NULLIF(BTRIM(p_admin_notes), '');
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Action must be approved or rejected'
      USING ERRCODE = '22023';
  END IF;

  IF p_admin_notes IS NOT NULL AND LENGTH(p_admin_notes) > 2000 THEN
    RAISE EXCEPTION 'Reviewer note must be 2000 characters or fewer'
      USING ERRCODE = '22023';
  END IF;

  IF p_action = 'rejected' AND v_note IS NULL THEN
    RAISE EXCEPTION 'A rejection reason is required'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_reviewer_id AND is_admin IS TRUE
  ) THEN
    RAISE EXCEPTION 'Administrator access required'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
  FROM public.verification_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verification request not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_request.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Verification request is no longer pending'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.verification_requests
  SET status = p_action,
      admin_id = p_reviewer_id,
      reviewed_by = p_reviewer_id,
      admin_notes = v_note,
      rejection_reason = CASE WHEN p_action = 'rejected' THEN v_note ELSE NULL END,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  IF p_action = 'approved' THEN
    UPDATE public.profiles
    SET is_verified = TRUE
    WHERE id = v_request.user_id;

    GET DIAGNOSTICS v_updated_profiles = ROW_COUNT;
    IF v_updated_profiles <> 1 THEN
      RAISE EXCEPTION 'Applicant profile could not be verified'
        USING ERRCODE = '23503';
    END IF;
  END IF;

  RETURN TO_JSONB(v_request);
END;
$$;

REVOKE ALL ON FUNCTION public.review_verification_request(UUID, UUID, TEXT, TEXT) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.review_verification_request(UUID, UUID, TEXT, TEXT) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.review_verification_request(UUID, UUID, TEXT, TEXT) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.review_verification_request(UUID, UUID, TEXT, TEXT) TO service_role;
  END IF;
END
$$;
