-- ============================================================================
-- Realtime delivery + chat wallpaper schema
-- ----------------------------------------------------------------------------
-- 1) Broadcast / presence authorization: Supabase Realtime authorizes broadcast
--    and presence events against RLS policies on the realtime.messages table.
--    With RLS enabled and zero policies, every chat broadcast channel is denied
--    and instant message delivery silently stops. These policies mirror the
--    documented Supabase pattern (permissive for anon + authenticated).
-- 2) Participant-scoped RLS on public.messages so authenticated clients can
--    SELECT messages they belong to (needed for postgres_changes delivery and
--    safe client reads). API routes keep using the service role key.
-- 3) conversation_settings: per-user, per-conversation chat wallpaper.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Realtime broadcast / presence authorization
-- ----------------------------------------------------------------------------
drop policy if exists "anon can insert into realtime messages" on realtime.messages;
drop policy if exists "anon can read realtime messages" on realtime.messages;
drop policy if exists "authenticated can insert into realtime messages" on realtime.messages;
drop policy if exists "authenticated can read realtime messages" on realtime.messages;

create policy "anon can insert into realtime messages"
  on realtime.messages for insert to anon
  with check (true);

create policy "anon can read realtime messages"
  on realtime.messages for select to anon
  using (true);

create policy "authenticated can insert into realtime messages"
  on realtime.messages for insert to authenticated
  with check (true);

create policy "authenticated can read realtime messages"
  on realtime.messages for select to authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- 2. Participant-scoped RLS on public.messages
-- ----------------------------------------------------------------------------
drop policy if exists "Participants can view messages" on public.messages;
drop policy if exists "Participants can insert messages" on public.messages;
drop policy if exists "Participants can update messages" on public.messages;
drop policy if exists "Participants can delete messages" on public.messages;

create policy "Participants can view messages"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "Participants can insert messages"
  on public.messages for insert to authenticated
  with check (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "Participants can update messages"
  on public.messages for update to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "Participants can delete messages"
  on public.messages for delete to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 3. conversation_settings — per-user chat wallpaper (and future per-chat prefs)
-- ----------------------------------------------------------------------------
create table if not exists public.conversation_settings (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wallpaper jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_settings enable row level security;

drop policy if exists "Participants can view conversation settings" on public.conversation_settings;
drop policy if exists "Participants can upsert conversation settings" on public.conversation_settings;

create policy "Participants can view conversation settings"
  on public.conversation_settings for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_settings.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "Participants can upsert conversation settings"
  on public.conversation_settings for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_settings.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "Participants can update conversation settings"
  on public.conversation_settings for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_settings.conversation_id
        and cp.user_id = auth.uid()
    )
  );

-- Real-time delivery for conversation_settings (so a user's wallpaper choice
-- follows them across devices instantly).
alter publication supabase_realtime add table public.conversation_settings;
