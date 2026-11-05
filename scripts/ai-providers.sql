-- Provider credentials for Loop AI.
--
-- Keys are stored encrypted (AES-256-GCM, lib/ai/keys.ts) and this table is
-- only ever read with the service role from server code; RLS with no policies
-- keeps it out of reach of anon/authenticated Supabase clients.
create table if not exists public.ai_providers (
  provider text primary key,
  label text not null,
  model text not null,
  api_key_cipher text not null,
  is_enabled boolean not null default true,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_providers enable row level security;

create index if not exists idx_ai_providers_enabled on public.ai_providers (is_enabled, created_at);
