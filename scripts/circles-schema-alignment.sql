-- Circle/community schema alignment for the realtime community system.
-- Run after scripts/setup-production.sql base scripts.

alter table if exists public.circles add column if not exists owner_id uuid references public.profiles(id) on delete cascade;
alter table if exists public.circles add column if not exists creator_id uuid references public.profiles(id) on delete cascade;
update public.circles set owner_id = coalesce(owner_id, creator_id) where owner_id is null;
update public.circles set creator_id = coalesce(creator_id, owner_id) where creator_id is null;

alter table if exists public.circle_members add column if not exists status text default 'active';
alter table if exists public.circle_members add column if not exists contribution_score integer default 0;
update public.circle_members set status = 'active' where status = 'approved';

alter table if exists public.circle_rooms add column if not exists type text default 'text';
alter table if exists public.circle_rooms add column if not exists is_private boolean default false;
alter table if exists public.circle_rooms add column if not exists member_count integer default 0;
alter table if exists public.circle_rooms add column if not exists created_by uuid references public.profiles(id) on delete set null;

create table if not exists public.circle_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.circle_rooms(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null,
  content text not null default '',
  media_url text,
  media_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.circle_post_interactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.circle_posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  interaction_type text not null,
  created_at timestamptz not null default now(),
  unique(post_id, user_id, interaction_type)
);

create or replace function public.increment_circle_post_count(circle_id uuid)
returns void language plpgsql as $$
begin
  update public.circles set post_count = coalesce(post_count, 0) + 1 where id = circle_id;
end;
$$;

create or replace function public.decrement_circle_post_count(circle_id uuid)
returns void language plpgsql as $$
begin
  update public.circles set post_count = greatest(coalesce(post_count, 0) - 1, 0) where id = circle_id;
end;
$$;

create or replace function public.decrement_circle_member_count(circle_id uuid)
returns void language plpgsql as $$
begin
  update public.circles set member_count = greatest(coalesce(member_count, 0) - 1, 0) where id = circle_id;
end;
$$;

alter publication supabase_realtime add table public.circle_room_messages;
alter publication supabase_realtime add table public.circle_posts;
alter publication supabase_realtime add table public.circle_members;
