-- VPS media storage
--
-- New uploads are written to /var/loop-uploads and served by Nginx at
-- /media/...; existing rows keep their Cloudinary URL. `storage_provider`
-- records which of the two owns each file so the old assets can be migrated
-- later without guessing.
--
-- Idempotent: safe to run repeatedly through scripts/apply-pending-schema.mjs.

ALTER TABLE IF EXISTS public.media_uploads ALTER COLUMN cloudinary_public_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.media_uploads ALTER COLUMN cloudinary_url DROP NOT NULL;

ALTER TABLE public.media_uploads
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'cloudinary';

ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS public_url TEXT;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS thumb_url TEXT;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS poster_url TEXT;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'ready';
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS processing_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS source_path TEXT;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS original_quality BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS uploaded_by_role TEXT;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS mime_detected TEXT;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE public.media_uploads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_uploads_storage_provider_check'
  ) THEN
    ALTER TABLE public.media_uploads
      ADD CONSTRAINT media_uploads_storage_provider_check
      CHECK (storage_provider IN ('cloudinary', 'vps'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_media_uploads_user_created
  ON public.media_uploads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_uploads_provider_created
  ON public.media_uploads(storage_provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_uploads_folder
  ON public.media_uploads(folder);
CREATE INDEX IF NOT EXISTS idx_media_uploads_processing
  ON public.media_uploads(processing_status)
  WHERE processing_status = 'processing';
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_uploads_storage_path
  ON public.media_uploads(storage_path)
  WHERE storage_path IS NOT NULL;

-- Storage usage per account for the Admin → Media → Storage view.
CREATE OR REPLACE FUNCTION public.media_storage_by_user(limit_rows INTEGER DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  media_count BIGINT,
  total_bytes BIGINT,
  last_upload TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    m.user_id,
    p.username::TEXT,
    p.display_name::TEXT,
    COUNT(*)::BIGINT,
    COALESCE(SUM(m.file_size), 0)::BIGINT,
    MAX(m.created_at)
  FROM public.media_uploads m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.storage_provider = 'vps'
  GROUP BY m.user_id, p.username, p.display_name
  ORDER BY COALESCE(SUM(m.file_size), 0) DESC
  LIMIT GREATEST(1, LEAST(COALESCE(limit_rows, 100), 500));
$$;

-- Upload policy defaults. Admins tune these from the dashboard; the app also
-- falls back to its built-in defaults when this row is absent.
INSERT INTO public.admin_settings (setting_key, setting_value, description)
VALUES (
  'media_upload_policy',
  '{"hard_max_mb":500,"image_max_mb":10,"video_free_mb":100,"video_pro_mb":250,"voice_max_mb":10,"new_account_video_mb":25,"new_account_min_age_hours":24,"new_account_min_posts":1,"post_files_free":4,"post_files_pro":10,"quota_free_mb":2048,"quota_pro_mb":10240,"uploads_per_hour":20,"daily_upload_mb_free":500,"daily_upload_mb_pro":2000,"admin_image_max_mb":25,"disk_warn_percent":80,"disk_block_percent":90}'::jsonb,
  'VPS media storage limits (per-file, per-post, quota, abuse caps, disk thresholds)'
)
ON CONFLICT (setting_key) DO NOTHING;
