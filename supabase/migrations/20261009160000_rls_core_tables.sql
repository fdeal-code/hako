-- ═════════════════════════════════════════════════════════════
-- HAKO — Sécurité (RLS) des tables principales
-- Jusqu'ici, 11 tables étaient ouvertes : avec la clé publique de l'app,
-- n'importe qui pouvait lire ou supprimer les voyages de tout le monde.
--
-- Principe : on ne voit et ne modifie que les voyages dont on est membre.
-- Exceptions voulues :
--   • créer un voyage (l'organisateur le relit avant d'en être membre) ;
--   • une invitation reçue (par e-mail) donne accès à l'aperçu du voyage
--     et permet de s'ajouter soi-même comme membre ;
--   • l'organisateur ajoute les membres (clôture d'un Trip Match) ;
--   • les profils sont lisibles par les utilisateurs connectés (amis,
--     avatars des membres), modifiables seulement par leur propriétaire.
-- Les fonctions SECURITY DEFINER évitent la récursion entre politiques.
-- ═════════════════════════════════════════════════════════════

-- ─── Helpers ─────────────────────────────────────────────────
create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips where id = p_trip_id and owner_id = auth.uid());
$$;

create or replace function public.my_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.has_trip_invitation(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.invitations
    where trip_id = p_trip_id
      and lower(invited_email) = public.my_email()
      and status in ('pending', 'accepted')
  );
$$;

create or replace function public.is_wish_member(p_wish_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.wishes w where w.id = p_wish_id and public.is_trip_member(w.trip_id));
$$;

create or replace function public.is_expense_member(p_expense_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.expenses e where e.id = p_expense_id and public.is_trip_member(e.trip_id));
$$;

-- L'organisateur par défaut = l'utilisateur connecté
alter table public.trips alter column owner_id set default auth.uid();

-- ─── trips ───────────────────────────────────────────────────
alter table public.trips enable row level security;
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select
  using (owner_id = auth.uid() or public.is_trip_member(id) or public.has_trip_invitation(id));
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert
  with check (owner_id = auth.uid());
drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips for update
  using (public.is_trip_member(id)) with check (public.is_trip_member(id));
drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips for delete
  using (owner_id = auth.uid());

-- ─── trip_members ────────────────────────────────────────────
alter table public.trip_members enable row level security;
drop policy if exists trip_members_select on public.trip_members;
create policy trip_members_select on public.trip_members for select
  using (user_id = auth.uid() or public.is_trip_member(trip_id));
drop policy if exists trip_members_insert on public.trip_members;
create policy trip_members_insert on public.trip_members for insert
  with check (
    public.is_trip_owner(trip_id)                                    -- l'organisateur ajoute (création, Trip Match)
    or (user_id = auth.uid() and public.has_trip_invitation(trip_id)) -- j'accepte une invitation
  );
drop policy if exists trip_members_update on public.trip_members;
create policy trip_members_update on public.trip_members for update
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
drop policy if exists trip_members_delete on public.trip_members;
create policy trip_members_delete on public.trip_members for delete
  using (user_id = auth.uid() or public.is_trip_owner(trip_id));    -- quitter, ou retiré par l'organisateur

-- ─── invitations ─────────────────────────────────────────────
alter table public.invitations enable row level security;
drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations for select
  using (public.is_trip_member(trip_id) or lower(invited_email) = public.my_email());
drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations for insert
  with check (public.is_trip_member(trip_id) and invited_by = auth.uid());
drop policy if exists invitations_update on public.invitations;
create policy invitations_update on public.invitations for update
  using (public.is_trip_member(trip_id) or lower(invited_email) = public.my_email())
  with check (public.is_trip_member(trip_id) or lower(invited_email) = public.my_email());
drop policy if exists invitations_delete on public.invitations;
create policy invitations_delete on public.invitations for delete
  using (public.is_trip_member(trip_id));

-- ─── Contenu d'un voyage : réservé aux membres ───────────────
do $$
declare
  t text;
begin
  foreach t in array array['wishes', 'planning_items', 'documents', 'expenses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_members', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id))',
      t || '_members', t);
  end loop;
end $$;

-- ─── wish_votes : on vote pour soi, dans ses voyages ─────────
alter table public.wish_votes enable row level security;
drop policy if exists wish_votes_select on public.wish_votes;
create policy wish_votes_select on public.wish_votes for select
  using (public.is_wish_member(wish_id));
drop policy if exists wish_votes_write on public.wish_votes;
create policy wish_votes_write on public.wish_votes for all
  using (user_id = auth.uid() and public.is_wish_member(wish_id))
  with check (user_id = auth.uid() and public.is_wish_member(wish_id));

-- ─── expense_splits : via la dépense ─────────────────────────
alter table public.expense_splits enable row level security;
drop policy if exists expense_splits_members on public.expense_splits;
create policy expense_splits_members on public.expense_splits for all
  using (public.is_expense_member(expense_id))
  with check (public.is_expense_member(expense_id));

-- ─── friendships : les deux personnes concernées ─────────────
alter table public.friendships enable row level security;
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships for insert
  with check (requester_id = auth.uid());
drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships for update
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ─── profiles : lisibles par les connectés, modifiables par soi ─
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Profil créé côté base à l'inscription (l'app ne peut plus l'écrire
-- avant d'avoir une session, ex. si l'e-mail doit être confirmé)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nickname, avatar_url)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'nickname', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Stockage : covers et avatars n'étaient protégés par rien ─
-- Lecture publique ; écriture seulement dans son propre dossier
-- (chemins « <id utilisateur>/... » utilisés par l'app).
drop policy if exists "Allow all on covers" on storage.objects;
drop policy if exists "allow all 1oj01fe_0" on storage.objects;
drop policy if exists "allow all 1oj01fe_1" on storage.objects;
drop policy if exists "allow all 1oj01fe_2" on storage.objects;
drop policy if exists "allow all 1oj01fe_3" on storage.objects;

drop policy if exists "covers/avatars: lecture" on storage.objects;
create policy "covers/avatars: lecture" on storage.objects for select
  using (bucket_id in ('covers', 'avatars'));
drop policy if exists "covers/avatars: envoi dans son dossier" on storage.objects;
create policy "covers/avatars: envoi dans son dossier" on storage.objects for insert to authenticated
  with check (bucket_id in ('covers', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "covers/avatars: mise à jour de son dossier" on storage.objects;
create policy "covers/avatars: mise à jour de son dossier" on storage.objects for update to authenticated
  using (bucket_id in ('covers', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('covers', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "covers/avatars: suppression de son dossier" on storage.objects;
create policy "covers/avatars: suppression de son dossier" on storage.objects for delete to authenticated
  using (bucket_id in ('covers', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
