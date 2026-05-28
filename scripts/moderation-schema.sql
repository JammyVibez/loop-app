-- Moderation support tables and profile moderator flag.

alter table if exists public.profiles
  add column if not exists is_moderator boolean default false;

create table if not exists public.content_flags (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  content_id uuid not null,
  reporter_id uuid references public.profiles(id) on delete set null,
  flag_type text not null,
  description text default '',
  status text not null default 'pending',
  action_taken text,
  moderator_id uuid references public.profiles(id) on delete set null,
  moderator_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_flags_status_created
  on public.content_flags(status, created_at desc);

create index if not exists idx_content_flags_content
  on public.content_flags(content_type, content_id);
