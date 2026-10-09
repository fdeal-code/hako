-- ═════════════════════════════════════════════════════════════
-- HAKO — Événements sur place (cache par voyage et par étape)
-- Rempli par l'Edge Function `fetch-trip-events` (service_role, bypass RLS)
-- à partir de Ticketmaster Discovery. Les membres lisent ; personne
-- n'écrit côté client. Spec : docs/FEATURES.md → « Événements sur place ».
-- ⚠️ Appliquer après trip_stops.
-- ═════════════════════════════════════════════════════════════

create table public.trip_events (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  stop_id      uuid references public.trip_stops(id) on delete cascade,
  source       text not null default 'ticketmaster',
  external_id  text not null,
  title        text not null,
  category     text,
  starts_at    timestamptz,
  local_date   date,
  venue_name   text,
  lat          double precision,
  lng          double precision,
  price_min    numeric,
  currency     text,
  image_url    text,
  ticket_url   text,
  fetched_at   timestamptz not null default now(),
  constraint trip_events_unique unique (trip_id, source, external_id)
);

create index idx_trip_events_trip_date on public.trip_events (trip_id, local_date);

alter table public.trip_events enable row level security;

create policy "trip_events_select_members"
  on public.trip_events for select using (public.is_trip_member(trip_id));

-- Lien envie ← événement (ajout aux envies depuis « On t'aide »)
alter table public.wishes add column if not exists event_id uuid references public.trip_events(id) on delete set null;
