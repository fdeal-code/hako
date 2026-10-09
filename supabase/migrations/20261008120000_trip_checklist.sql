-- ═════════════════════════════════════════════════════════════
-- HAKO — Checklist « Prêt pour le départ ? » (écran Documents)
-- Une ligne par élément coché (passeport, billets, logements, eSIM,
-- assurance). Partagée par le groupe : qui a coché, et quand.
-- ═════════════════════════════════════════════════════════════

create table public.trip_checklist (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  item       text not null check (item in ('passport', 'tickets', 'lodging', 'esim', 'insurance')),
  done_by    uuid references public.profiles(id) on delete set null,
  done_at    timestamptz not null default now(),
  constraint trip_checklist_unique_item unique (trip_id, item)
);

alter table public.trip_checklist enable row level security;

-- is_trip_member() est créée par la migration trip_stops
create policy "trip_checklist_select_members"
  on public.trip_checklist for select using (public.is_trip_member(trip_id));
create policy "trip_checklist_insert_members"
  on public.trip_checklist for insert with check (public.is_trip_member(trip_id));
create policy "trip_checklist_delete_members"
  on public.trip_checklist for delete using (public.is_trip_member(trip_id));
-- Requis par l'upsert du client (re-cocher un élément déjà présent)
create policy "trip_checklist_update_members"
  on public.trip_checklist for update
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

alter publication supabase_realtime add table public.trip_checklist;
