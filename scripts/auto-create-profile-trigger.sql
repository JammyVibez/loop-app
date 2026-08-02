-- Auto-create a profile whenever a new auth user signs up.
-- Run this in Supabase SQL Editor.

create extension if not exists "pgcrypto";

alter table if exists public.profiles
  add column if not exists onboarding_completed boolean not null default false;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    username,
    display_name,
    avatar_url,
    loop_coins,
    is_premium,
    is_verified,
    is_admin,
    onboarding_completed,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
    ),
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Loop User'
    ),
    new.raw_user_meta_data->>'avatar_url',
    500,
    false,
    false,
    false,
    false,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Optional backfill for already-created auth users missing profiles:
insert into public.profiles (
  id,
  email,
  username,
  display_name,
  loop_coins,
  is_premium,
  is_verified,
  is_admin,
  onboarding_completed,
  created_at,
  updated_at
)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data->>'username', ''),
    split_part(coalesce(u.email, ''), '@', 1),
    'user_' || substr(replace(u.id::text, '-', ''), 1, 8)
  ),
  coalesce(
    nullif(u.raw_user_meta_data->>'display_name', ''),
    nullif(u.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(u.email, ''), '@', 1),
    'Loop User'
  ),
  500,
  false,
  false,
  false,
  false,
  now(),
  now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
