-- LOOP profile custom CSS. Apply before deploying the feature.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_profile_css text;

UPDATE public.profiles
SET custom_profile_css = ''
WHERE custom_profile_css IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN custom_profile_css SET DEFAULT '',
  ALTER COLUMN custom_profile_css SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_custom_profile_css_byte_limit'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_custom_profile_css_byte_limit
      CHECK (octet_length(custom_profile_css) <= 21000);
  END IF;
END
$$;

COMMIT;
