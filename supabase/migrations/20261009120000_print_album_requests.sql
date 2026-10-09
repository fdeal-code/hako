-- ═════════════════════════════════════════════════════════════
-- HAKO — Album souvenir imprimé : demandes (liste d'attente)
-- Pas encore de partenaire d'impression : « Je le veux » enregistre la
-- demande (format choisi, nombre de photos) pour mesurer l'intérêt et
-- prévenir le groupe quand l'impression ouvre.
-- ═════════════════════════════════════════════════════════════

create table if not exists public.print_album_requests (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  format      text not null check (format in ('square', 'landscape')),
  photo_count integer not null check (photo_count >= 0),
  created_at  timestamptz not null default now(),
  unique (trip_id, user_id)
);

alter table public.print_album_requests enable row level security;

drop policy if exists "print_album_requests_select_members" on public.print_album_requests;
create policy "print_album_requests_select_members"
  on public.print_album_requests for select
  using (public.is_trip_member(trip_id));

drop policy if exists "print_album_requests_insert_own" on public.print_album_requests;
create policy "print_album_requests_insert_own"
  on public.print_album_requests for insert
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "print_album_requests_update_own" on public.print_album_requests;
create policy "print_album_requests_update_own"
  on public.print_album_requests for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "print_album_requests_delete_own" on public.print_album_requests;
create policy "print_album_requests_delete_own"
  on public.print_album_requests for delete
  using (user_id = auth.uid());
