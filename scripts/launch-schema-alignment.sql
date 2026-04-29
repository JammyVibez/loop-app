-- Launch schema alignment
-- Adds missing fields and feature tables referenced by API routes.

create extension if not exists "pgcrypto";

alter table if exists profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists active_theme text default 'default',
  add column if not exists xp_points integer not null default 0,
  add column if not exists level integer not null default 1,
  add column if not exists premium_expires_at timestamptz;

create table if not exists payment_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  payment_intent_id text not null,
  amount integer not null,
  currency text not null default 'usd',
  status text not null default 'created',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists payment_logs_payment_intent_id_idx on payment_logs(payment_intent_id);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  conversation_type text not null default 'direct',
  created_by uuid references profiles(id) on delete set null,
  last_message_id uuid,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique(conversation_id, user_id)
);

create table if not exists reels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  parent_reel_id uuid references reels(id) on delete set null,
  content text,
  media_url text,
  thumbnail_url text,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reel_interactions (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references reels(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  interaction_type text not null,
  created_at timestamptz not null default now(),
  unique(reel_id, user_id, interaction_type)
);

create table if not exists reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references reels(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  parent_comment_id uuid references reel_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists circle_rooms (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles(id) on delete cascade,
  name text not null,
  description text,
  room_type text not null default 'text',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists circle_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references circle_rooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text,
  reply_to_id uuid references circle_room_messages(id) on delete set null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists circle_room_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references circle_room_messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);

create table if not exists media_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  file_url text not null,
  file_type text,
  bytes bigint,
  provider text not null default 'cloudinary',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists earnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  amount integer not null,
  currency text not null default 'coins',
  created_at timestamptz not null default now()
);

create table if not exists live_streams (
  id uuid primary key default gen_random_uuid(),
  streamer_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  status text not null default 'offline',
  stream_key text,
  viewer_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
