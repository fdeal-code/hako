-- ═════════════════════════════════════════════════════════════
-- HAKO — Règles d'accès de l'album et des avis
-- trip_photos et activity_reviews avaient la RLS activée SANS aucune
-- règle : lecture vide et écriture refusée pour tout le monde (album
-- vide, import impossible, avis non enregistrés, récap sans données).
-- Même logique que trip_stops : réservé aux membres du voyage.
-- ═════════════════════════════════════════════════════════════

-- ─── trip_photos ─────────────────────────────────────────────
alter table public.trip_photos enable row level security;

drop policy if exists "trip_photos_select_members" on public.trip_photos;
create policy "trip_photos_select_members"
  on public.trip_photos for select
  using (public.is_trip_member(trip_id));

drop policy if exists "trip_photos_insert_members" on public.trip_photos;
create policy "trip_photos_insert_members"
  on public.trip_photos for insert
  with check (public.is_trip_member(trip_id) and uploaded_by = auth.uid());

drop policy if exists "trip_photos_delete_own" on public.trip_photos;
create policy "trip_photos_delete_own"
  on public.trip_photos for delete
  using (uploaded_by = auth.uid());

-- ─── activity_reviews (pas de trip_id : on passe par l'envie) ─
alter table public.activity_reviews enable row level security;

drop policy if exists "activity_reviews_select_members" on public.activity_reviews;
create policy "activity_reviews_select_members"
  on public.activity_reviews for select
  using (exists (select 1 from public.wishes w where w.id = wish_id and public.is_trip_member(w.trip_id)));

drop policy if exists "activity_reviews_insert_own" on public.activity_reviews;
create policy "activity_reviews_insert_own"
  on public.activity_reviews for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.wishes w where w.id = wish_id and public.is_trip_member(w.trip_id))
  );

drop policy if exists "activity_reviews_update_own" on public.activity_reviews;
create policy "activity_reviews_update_own"
  on public.activity_reviews for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "activity_reviews_delete_own" on public.activity_reviews;
create policy "activity_reviews_delete_own"
  on public.activity_reviews for delete
  using (user_id = auth.uid());
