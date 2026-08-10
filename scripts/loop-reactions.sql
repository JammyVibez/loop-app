-- Persistent Quick React emoji reactions on loops
CREATE TABLE IF NOT EXISTS public.loop_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loop_id UUID NOT NULL REFERENCES public.loops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_loop_reactions_loop_id ON public.loop_reactions(loop_id);
CREATE INDEX IF NOT EXISTS idx_loop_reactions_user_id ON public.loop_reactions(user_id);

ALTER TABLE public.loop_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read loop reactions" ON public.loop_reactions;
CREATE POLICY "Anyone can read loop reactions"
  ON public.loop_reactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users manage own loop reactions" ON public.loop_reactions;
CREATE POLICY "Users manage own loop reactions"
  ON public.loop_reactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
