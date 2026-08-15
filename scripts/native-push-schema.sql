-- ============================================================================
-- Native push (Capacitor + FCM) device tokens
-- The web app uses Web Push (push_subscriptions); native Android/iOS shells
-- register FCM tokens here so lib/fcm.ts can deliver the same notifications.
-- Idempotent — safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.native_push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_native_push_tokens_user ON public.native_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_native_push_tokens_platform ON public.native_push_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_native_push_tokens_updated ON public.native_push_tokens(updated_at DESC);

-- Users can only read/delete their own tokens; the service role manages writes.
ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'native_push_tokens' AND policyname = 'native_push_tokens_select_own'
  ) THEN
    CREATE POLICY native_push_tokens_select_own
      ON public.native_push_tokens FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'native_push_tokens' AND policyname = 'native_push_tokens_delete_own'
  ) THEN
    CREATE POLICY native_push_tokens_delete_own
      ON public.native_push_tokens FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
