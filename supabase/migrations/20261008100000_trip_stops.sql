-- ═════════════════════════════════════════════════════════════
-- HAKO — Voyages multi-étapes : table trip_stops
-- Un trip = une suite d'étapes (ville + dates). Un trip "simple"
-- a exactement une étape, jamais affichée comme telle dans l'UI.
-- `trips.destination` reste le libellé affiché (ex. "Rome, Florence +1")
-- pour ne rien casser côté TripCard / dashboards existants.
-- Spec : docs/FEATURES.md → « Voyages multi-étapes ».
-- ═════════════════════════════════════════════════════════════

create table public.trip_stops (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  position     integer not null check (position >= 0),
  place_name   text not null,
  place_id     text,
  lat          double precision,
  lng          double precision,
  country_code text,
  start_date   date not null,
  end_date     date not null,
  created_at   timestamptz not null default now(),
  constraint trip_stops_dates_ordered check (end_date >= start_date),
  -- deferrable : permet de réordonner les étapes dans une même transaction
  constraint trip_stops_position_unique unique (trip_id, position) deferrable initially deferred
);

create index idx_trip_stops_trip_position on public.trip_stops (trip_id, position);

-- ─── RLS ─────────────────────────────────────────────────────
-- Helper SECURITY DEFINER : évite de dépendre des policies de trip_members.
create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = auth.uid()
  );
$$;

alter table public.trip_stops enable row level security;

create policy "trip_stops_select_members"
  on public.trip_stops for select
  using (public.is_trip_member(trip_id));

create policy "trip_stops_insert_members"
  on public.trip_stops for insert
  with check (public.is_trip_member(trip_id));

create policy "trip_stops_update_members"
  on public.trip_stops for update
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

create policy "trip_stops_delete_members"
  on public.trip_stops for delete
  using (public.is_trip_member(trip_id));

-- ─── Rattachement de l'existant (colonnes nullables) ─────────
alter table public.wishes         add column if not exists stop_id uuid references public.trip_stops(id) on delete set null;
alter table public.planning_items add column if not exists stop_id uuid references public.trip_stops(id) on delete set null;
alter table public.expenses       add column if not exists stop_id uuid references public.trip_stops(id) on delete set null;

-- ─── Backfill : une étape par trip existant ──────────────────
insert into public.trip_stops (trip_id, position, place_name, place_id, lat, lng, start_date, end_date)
select
  t.id,
  0,
  split_part(t.destination, ',', 1),
  t.destination_place_id,
  t.destination_lat,
  t.destination_lng,
  t.start_date,
  t.end_date
from public.trips t
where t.start_date is not null
  and t.end_date is not null
  and not exists (select 1 from public.trip_stops s where s.trip_id = t.id);

-- Realtime : un membre qui ajoute une étape met à jour les autres
alter publication supabase_realtime add table public.trip_stops;
