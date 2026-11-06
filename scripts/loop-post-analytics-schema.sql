-- Per-post analytics: view events.
--
-- loop_interactions records one 'view' row per viewer for the lifetime of a
-- post, which answers "how many people ever opened this" but cannot answer
-- "how many impressions yesterday", "where did they come from" or "were they
-- followers". Analytics needs a time-series event log, so this table stores one
-- row per qualifying view with the surface it came from.
--
-- Rows are written by the server only (service role); RLS keeps the log
-- unreadable by clients directly.

create table if not exists public.loop_view_events (
  id bigserial primary key,
  loop_id text not null,
  viewer_id uuid references public.profiles(id) on delete set null,
  -- Anonymous or logged-out views keep a session key instead.
  session_id text,
  -- feed | profile | circle | explore | shared | search | notification | detail
  surface text not null default 'feed',
  is_follower boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_loop_view_events_loop_created
  on public.loop_view_events (loop_id, created_at desc);

create index if not exists idx_loop_view_events_loop_viewer_created
  on public.loop_view_events (loop_id, viewer_id, created_at desc);

alter table public.loop_view_events enable row level security;

-- The owning author (and staff) can read their post's events through the API,
-- which uses the service role. No client-side policies are granted.
comment on table public.loop_view_events is
  'Deduplicated per-view events powering author post analytics (impressions, surfaces, follower split).';
