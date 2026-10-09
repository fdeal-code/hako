-- ═════════════════════════════════════════════════════════════
-- HAKO — Lien d'invitation (WhatsApp) : rejoindre un voyage en 1 tap
-- L'invité voit un aperçu du voyage AVANT de créer son compte
-- (get_invite_preview, accessible au rôle anon), puis rejoint après
-- connexion (join_trip_with_token). Aucune donnée de trip n'est
-- exposée en dehors de ces deux fonctions SECURITY DEFINER.
-- ⚠️ Appliquer après trip_stops (is_trip_member) et trips_style_budget.
-- ═════════════════════════════════════════════════════════════

create table public.trip_invite_links (
  token      text primary key check (char_length(token) >= 16),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  revoked    boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_trip_invite_links_trip on public.trip_invite_links (trip_id) where not revoked;

alter table public.trip_invite_links enable row level security;

create policy "trip_invite_links_select_members"
  on public.trip_invite_links for select using (public.is_trip_member(trip_id));
create policy "trip_invite_links_insert_members"
  on public.trip_invite_links for insert
  with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy "trip_invite_links_update_members"
  on public.trip_invite_links for update
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- ─── Aperçu public (avant compte) ────────────────────────────
create or replace function public.get_invite_preview(p_token text)
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object(
    'trip_id',           t.id,
    'name',              t.name,
    'destination',       t.destination,
    'start_date',        t.start_date,
    'end_date',          t.end_date,
    'cover_image_url',   t.cover_image_url,
    'budget_per_person', t.budget_per_person,
    'inviter',           public.nickname_of(l.created_by),
    'member_count',      (select count(*) from public.trip_members tm where tm.trip_id = t.id),
    'member_names',      coalesce((
                           select json_agg(public.nickname_of(m.user_id))
                           from (select user_id from public.trip_members where trip_id = t.id limit 3) m
                         ), '[]'::json),
    'wish_count',        (select count(*) from public.wishes w where w.trip_id = t.id and w.status <> 'archived'),
    'already_member',    (auth.uid() is not null and public.is_trip_member(t.id))
  )
  from public.trip_invite_links l
  join public.trips t on t.id = l.trip_id
  where l.token = p_token and not l.revoked;
$$;

grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- ─── Rejoindre (connecté) ────────────────────────────────────
create or replace function public.join_trip_with_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select trip_id into v_trip
  from public.trip_invite_links
  where token = p_token and not revoked;
  if v_trip is null then
    raise exception 'invalid_token';
  end if;
  if not public.is_trip_member(v_trip) then
    insert into public.trip_members (trip_id, user_id, role) values (v_trip, auth.uid(), 'member');
  end if;
  return v_trip;
end;
$$;

grant execute on function public.join_trip_with_token(text) to authenticated;
