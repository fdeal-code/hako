-- ═════════════════════════════════════════════════════════════
-- HAKO — Mesure d'usage et suivi des plantages (bêta)
-- Sans service tiers : l'app écrit dans deux tables, que personne ne peut
-- relire depuis l'app (pas de politique SELECT). Lecture depuis le tableau
-- de bord Supabase ou `npx supabase db query --linked -f
-- supabase/queries/beta_metrics.sql`.
--   • app_events : étapes clés (voyage créé, invitation, vote…), écrans vus.
--     Jamais de contenu personnel (pas de titres, pas de textes).
--   • app_errors : plantages et erreurs JavaScript.
-- ═════════════════════════════════════════════════════════════

create table if not exists public.app_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id  text not null check (char_length(session_id) <= 64),
  name        text not null check (name ~ '^[a-z][a-z0-9_]{1,48}$'),
  trip_id     uuid,
  props       jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2048),
  platform    text check (platform in ('ios', 'android', 'web')),
  app_version text check (char_length(app_version) <= 32),
  is_dev      boolean not null default false
);
create index if not exists app_events_created_idx on public.app_events (created_at);
create index if not exists app_events_name_idx on public.app_events (name, created_at);
create index if not exists app_events_user_idx on public.app_events (user_id, created_at);

alter table public.app_events enable row level security;
drop policy if exists app_events_insert on public.app_events;
create policy app_events_insert on public.app_events for insert to authenticated
  with check (user_id = auth.uid());

create table if not exists public.app_errors (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid default auth.uid() references auth.users(id) on delete cascade,
  session_id  text check (char_length(session_id) <= 64),
  message     text not null check (char_length(message) <= 2000),
  stack       text check (char_length(stack) <= 8000),
  screen      text check (char_length(screen) <= 200),
  fatal       boolean not null default false,
  platform    text check (platform in ('ios', 'android', 'web')),
  app_version text check (char_length(app_version) <= 32),
  is_dev      boolean not null default false
);
create index if not exists app_errors_created_idx on public.app_errors (created_at);

alter table public.app_errors enable row level security;
-- Un plantage peut arriver avant la connexion (écran de connexion) : envoi
-- anonyme autorisé, mais jamais au nom de quelqu'un d'autre.
drop policy if exists app_errors_insert on public.app_errors;
create policy app_errors_insert on public.app_errors for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
