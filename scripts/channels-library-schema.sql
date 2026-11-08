-- Channels library: movies and shows uploaded by staff.
--
-- The UltraSrc bridge still serves Asian dramas and novels, but movies and
-- shows are first-party: staff upload a poster and video through the admin
-- dashboard and the row shows up in /channels for everyone.
--
-- Reads go through the service-role client on the server, so RLS only has to
-- guarantee that a leaked anon key can read published rows and nothing else.

create extension if not exists "pgcrypto";

create table if not exists public.channel_titles (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('movie', 'series')),
  title text not null,
  synopsis text,
  poster_url text,
  backdrop_url text,
  -- Movies play this file; series play their episodes instead.
  video_url text,
  year integer,
  country text,
  language text,
  genres text[] not null default '{}',
  runtime_minutes integer,
  featured boolean not null default false,
  published boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_episodes (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.channel_titles(id) on delete cascade,
  season integer not null default 1,
  episode integer not null default 1,
  name text,
  synopsis text,
  video_url text not null,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists channel_titles_kind_published_idx
  on public.channel_titles (kind, published, created_at desc);

create index if not exists channel_titles_title_search_idx
  on public.channel_titles (lower(title));

create unique index if not exists channel_episodes_number_idx
  on public.channel_episodes (title_id, season, episode);

-- Replaces the former video-first live feature with audio rooms by default.
alter table public.live_streams
  add column if not exists stream_type text not null default 'audio';

do $$ begin
  alter table public.live_streams
    add constraint live_streams_stream_type_check check (stream_type in ('audio'));
exception when duplicate_object then null;
end $$;

-- Persistent, threaded discussions attached to published movie/show pages.
create table if not exists public.channel_comments (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.channel_titles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.channel_comments(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists channel_comments_title_created_idx
  on public.channel_comments (title_id, created_at asc);
create index if not exists channel_comments_parent_created_idx
  on public.channel_comments (parent_comment_id, created_at asc);

alter table public.channel_titles enable row level security;
alter table public.channel_episodes enable row level security;
alter table public.channel_comments enable row level security;

drop policy if exists "Published channel titles are readable" on public.channel_titles;
create policy "Published channel titles are readable"
  on public.channel_titles for select
  using (published = true);

drop policy if exists "Published channel episodes are readable" on public.channel_episodes;
create policy "Published channel episodes are readable"
  on public.channel_episodes for select
  using (
    exists (
      select 1 from public.channel_titles t
      where t.id = channel_episodes.title_id and t.published = true
    )
  );

drop policy if exists "Published channel discussions are readable" on public.channel_comments;
create policy "Published channel discussions are readable"
  on public.channel_comments for select
  using (
    exists (
      select 1 from public.channel_titles t
      where t.id = channel_comments.title_id and t.published = true
    )
  );
